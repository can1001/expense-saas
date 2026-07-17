/**
 * 테넌트 프로비저닝 서비스 (ARC-001 §4)
 *
 * 단일 트랜잭션으로 수행하여 부분 생성을 방지한다:
 * 1. Tenant 생성 — orgType별 기본 settings 복사
 * 2. AccountCategoryTemplate → AccountCategory 복제 (sourceTemplateId는 String만 기록, FK 없음 — "복제 후 독립")
 * 3. ApprovalLineTemplate → 테넌트 결재선 복제
 *    기존 ApprovalLine/ApprovalStep은 지출결의서 단위 모델(expenseId 필수·unique)이라
 *    프로비저닝 시점에는 물리 행을 만들 수 없다. 기존 결재선 스냅샷 관례(ApprovalLine.snapshot Json)를 따라
 *    Tenant.settings.approvalLines에 roleLabel 텍스트를 보존한 JSON으로 복제한다.
 *    실제 결재자 연결은 지출결의서 제출 시점의 몫 — 프로비저닝에서 자동 역할 매칭을 시도하지 않는다.
 * 4. 테넌트 어드민 User 생성 (hashPassword 관례 사용)
 */

import type { Tenant, User, Prisma } from '@prisma/client';
import { prismaBase } from '@/lib/prisma';
import { hashPassword } from '@/lib/services/user-service';
import { createTenantSchema, planLimits } from '@/lib/validators/tenant';
import { defaultSettingsForOrgType } from '@/lib/tenant/settings';
import { z } from 'zod';

// A6 표준화로 `lib/tenant/settings.ts`로 이동 — 기존 호출부 호환을 위한 재수출
export { defaultSettingsForOrgType } from '@/lib/tenant/settings';
export type { TenantSettings as TenantDefaultSettings } from '@/lib/tenant/settings';

// 프로비저닝 입력 — 플랫폼 테넌트 생성 계약(createTenantSchema)과 동일
export const provisionTenantInputSchema = createTenantSchema;
export type ProvisionTenantInput = z.input<typeof provisionTenantInputSchema>;

// settings.approvalLines에 저장되는 결재선 스냅샷 항목
// (Prisma Json 입력과 호환되도록 interface가 아닌 type으로 선언 — 암묵적 인덱스 시그니처)
export type ApprovalLineSnapshot = {
  name: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  sourceTemplateId: string;
  steps: Array<{ stepOrder: number; roleLabel: string }>;
};

export interface ProvisionTenantOptions {
  /**
   * 코어 프로비저닝(테넌트·계정과목·결재선·어드민) 이후 같은 트랜잭션에서 실행할 추가 단계.
   * 호출측 고유 관례(기본 역할 생성, Budget 5단계 기본 데이터 시딩 등)를 원자성을 깨지 않고 유지하기 위한 훅.
   */
  extend?: (tx: Prisma.TransactionClient, tenant: Tenant) => Promise<void>;
}

export interface ProvisionTenantResult {
  tenant: Tenant;
  adminUser: Pick<User, 'id' | 'userid' | 'username'> | null;
  accountCategoriesCreated: number;
  approvalLinesCloned: number;
  warnings: string[];
}

/**
 * 테넌트 프로비저닝 — Tenant + 계정과목 + 결재선 + 어드민 User를 단일 트랜잭션으로 생성한다.
 *
 * - 해당 orgType의 템플릿이 0건이어도 Tenant/User는 생성하고 warnings로 알린다.
 * - 어느 단계든 실패하면 트랜잭션 전체가 롤백된다 (부분 생성 방지).
 */
export async function provisionTenant(
  input: ProvisionTenantInput,
  options?: ProvisionTenantOptions
): Promise<ProvisionTenantResult> {
  const data = provisionTenantInputSchema.parse(input);
  const limits = planLimits[data.plan];
  const warnings: string[] = [];

  const result = await prismaBase.$transaction(async (tx) => {
    // 1. Tenant 생성 — orgType 기본 settings 복사
    const settings = defaultSettingsForOrgType(data.orgType);
    let tenant = await tx.tenant.create({
      data: {
        name: data.name,
        subdomain: data.subdomain,
        customDomain: data.customDomain ?? null,
        orgType: data.orgType,
        description: data.description ?? null,
        logoUrl: data.logoUrl ?? null,
        plan: data.plan,
        maxUsers: limits.maxUsers,
        maxStorageMB: limits.maxStorageMB,
        planStartAt: new Date(),
        settings,
      },
    });

    // 2. 계정과목 템플릿 → AccountCategory 복제 (sourceTemplateId 기록)
    const categoryTemplates = await tx.accountCategoryTemplate.findMany({
      where: { orgType: data.orgType, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    let accountCategoriesCreated = 0;
    if (categoryTemplates.length === 0) {
      warnings.push(
        `orgType ${data.orgType}의 계정과목 템플릿이 없습니다. 계정과목 없이 테넌트를 생성했습니다.`
      );
    } else {
      await tx.accountCategory.createMany({
        data: categoryTemplates.map((template) => ({
          tenantId: tenant.id,
          code: template.code,
          name: template.name,
          group: template.group,
          kind: template.kind,
          sortOrder: template.sortOrder,
          isActive: template.isActive,
          sourceTemplateId: template.id,
        })),
      });
      accountCategoriesCreated = categoryTemplates.length;
    }

    // 3. 결재선 템플릿 → settings.approvalLines 스냅샷 복제 (첫 번째/isDefault를 기본값으로)
    const lineTemplates = await tx.approvalLineTemplate.findMany({
      where: { orgType: data.orgType },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    let approvalLinesCloned = 0;
    if (lineTemplates.length === 0) {
      warnings.push(
        `orgType ${data.orgType}의 결재선 템플릿이 없습니다. 결재선 없이 테넌트를 생성했습니다.`
      );
    } else {
      const hasDefault = lineTemplates.some((template) => template.isDefault);
      const approvalLines: ApprovalLineSnapshot[] = lineTemplates.map((template, index) => ({
        name: template.name,
        description: template.description ?? null,
        // isDefault 템플릿이 없으면 첫 번째를 기본값으로 지정
        isDefault: hasDefault ? template.isDefault : index === 0,
        sortOrder: template.sortOrder,
        sourceTemplateId: template.id,
        steps: template.steps.map((step) => ({
          stepOrder: step.stepOrder,
          roleLabel: step.roleLabel,
        })),
      }));

      tenant = await tx.tenant.update({
        where: { id: tenant.id },
        data: { settings: { ...settings, approvalLines } },
      });
      approvalLinesCloned = approvalLines.length;
    }

    // 4. 테넌트 어드민 User 생성
    let adminUser: Pick<User, 'id' | 'userid' | 'username'> | null = null;
    if (data.adminEmail && data.adminName && data.adminPassword) {
      const hashedPassword = await hashPassword(data.adminPassword);
      const createdUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          userid: data.adminEmail,
          username: data.adminName,
          password: hashedPassword,
          role: 'admin',
          isActive: true,
        },
      });
      adminUser = {
        id: createdUser.id,
        userid: createdUser.userid,
        username: createdUser.username,
      };

      tenant = await tx.tenant.update({
        where: { id: tenant.id },
        data: { currentUsers: 1 },
      });
    } else {
      warnings.push(
        '어드민 계정 정보(adminEmail/adminName/adminPassword)가 없어 어드민 User를 생성하지 않았습니다.'
      );
    }

    // 5. 호출측 추가 단계 — 같은 트랜잭션에서 실행해 부분 생성 방지 원칙을 유지한다
    if (options?.extend) {
      await options.extend(tx, tenant);
    }

    return { tenant, adminUser, accountCategoriesCreated, approvalLinesCloned };
  });

  return { ...result, warnings };
}
