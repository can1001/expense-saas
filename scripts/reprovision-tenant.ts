/**
 * 기존 테넌트 재프로비저닝 스크립트 (M4 게이트 — ARC-001 §4)
 *
 * 템플릿 시스템(A1~A3) 이전에 생성된 테넌트에 orgType 템플릿을 소급 적용한다.
 * provisionTenant()의 2·3단계(계정과목·결재선 복제)와 settings 기본값 채움만 수행하며,
 * 운영 중 테넌트를 다루므로 전부 추가 전용이다 — 기존 데이터를 덮어쓰지 않는다:
 *   - AccountCategory: 테넌트에 없는 code만 생성 (sourceTemplateId 기록)
 *   - settings.labels/features: 저장 안 된 키만 orgType 기본값으로 채움
 *   - settings.approvalLines: 스냅샷이 아예 없을 때만 템플릿에서 복제
 *
 * 실행 방법 (TS_NODE_BASEURL은 lib/의 '@/...' 경로 별칭 해석용):
 *   # Dry-run (변경 없이 확인만)
 *   TS_NODE_BASEURL=. pnpm exec ts-node -r tsconfig-paths/register \
 *     --project tsconfig.scripts.json scripts/reprovision-tenant.ts --tenant=<subdomain> --dry-run
 *
 *   # 실제 적용
 *   TS_NODE_BASEURL=. pnpm exec ts-node -r tsconfig-paths/register \
 *     --project tsconfig.scripts.json scripts/reprovision-tenant.ts --tenant=<subdomain>
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { resolveTenantSettings } from '../lib/tenant/settings';
import type { ApprovalLineSnapshot } from '../lib/services/provision-tenant';

// .env 파일 로드 (Prisma 7: 어댑터에 연결 문자열 직접 전달)
config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const isDryRun = process.argv.includes('--dry-run');
const tenantArg = process.argv.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length);

async function main() {
  if (!tenantArg) {
    console.error('사용법: reprovision-tenant.ts --tenant=<subdomain> [--dry-run]');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { subdomain: tenantArg } });
  if (!tenant) {
    console.error(`테넌트를 찾을 수 없습니다: subdomain=${tenantArg}`);
    process.exit(1);
  }

  console.log(
    `=== 재프로비저닝 ${isDryRun ? '(dry-run — 변경 없음)' : ''} ===\n` +
      `대상: ${tenant.name} (${tenant.subdomain}, ${tenant.orgType})\n`
  );

  // 1. 계정과목 — 테넌트에 없는 code만 복제
  const categoryTemplates = await prisma.accountCategoryTemplate.findMany({
    where: { orgType: tenant.orgType, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  const existingCodes = new Set(
    (
      await prisma.accountCategory.findMany({
        where: { tenantId: tenant.id },
        select: { code: true },
      })
    ).map((c) => c.code)
  );
  const missingCategories = categoryTemplates.filter((t) => !existingCodes.has(t.code));
  console.log(
    `계정과목: 템플릿 ${categoryTemplates.length}건 중 신규 ${missingCategories.length}건, ` +
      `기존 유지 ${existingCodes.size}건`
  );

  // 2. settings — 저장 안 된 labels/features 키만 기본값으로 채움 (저장값 우선 딥머지)
  const storedSettings = (tenant.settings ?? {}) as Record<string, unknown>;
  const mergedSettings: Record<string, unknown> = {
    ...storedSettings,
    ...resolveTenantSettings(tenant),
  };

  // 3. 결재선 스냅샷 — 없을 때만 템플릿에서 복제
  const hasApprovalLines =
    Array.isArray(storedSettings.approvalLines) && storedSettings.approvalLines.length > 0;
  let approvalLinesCloned = 0;
  if (hasApprovalLines) {
    console.log('결재선: 기존 스냅샷 있음 — 건너뜀');
  } else {
    const lineTemplates = await prisma.approvalLineTemplate.findMany({
      where: { orgType: tenant.orgType },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    const hasDefault = lineTemplates.some((t) => t.isDefault);
    const approvalLines: ApprovalLineSnapshot[] = lineTemplates.map((template, index) => ({
      name: template.name,
      description: template.description ?? null,
      isDefault: hasDefault ? template.isDefault : index === 0,
      sortOrder: template.sortOrder,
      sourceTemplateId: template.id,
      steps: template.steps.map((s) => ({ stepOrder: s.stepOrder, roleLabel: s.roleLabel })),
    }));
    mergedSettings.approvalLines = approvalLines;
    approvalLinesCloned = approvalLines.length;
    console.log(
      `결재선: 템플릿 ${approvalLinesCloned}종 복제 예정 — ` +
        lineTemplates.map((t) => `'${t.name}'`).join(', ')
    );
  }

  if (isDryRun) {
    console.log('\n(dry-run) 변경을 적용하지 않았습니다.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (missingCategories.length > 0) {
      await tx.accountCategory.createMany({
        data: missingCategories.map((t) => ({
          tenantId: tenant.id,
          code: t.code,
          name: t.name,
          group: t.group,
          kind: t.kind,
          sortOrder: t.sortOrder,
          isActive: t.isActive,
          sourceTemplateId: t.id,
        })),
      });
    }
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { settings: mergedSettings as object },
    });
  });

  console.log(
    `\n=== 완료 — 계정과목 ${missingCategories.length}건 생성, ` +
      `결재선 ${approvalLinesCloned}종 복제, settings 기본값 채움 ===`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
