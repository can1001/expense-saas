/**
 * 테넌트 프로비저닝 서비스 테스트 (ARC-001 §4)
 *
 * DB 무실행 원칙 — prisma를 모킹하여 트랜잭션 사용·복제 로직만 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 트랜잭션 클라이언트 모킹 — $transaction 콜백에 그대로 전달된다
const { tx } = vi.hoisted(() => ({
  tx: {
    tenant: {
      create: vi.fn(),
      update: vi.fn(),
    },
    accountCategoryTemplate: {
      findMany: vi.fn(),
    },
    accountCategory: {
      createMany: vi.fn(),
    },
    approvalLineTemplate: {
      findMany: vi.fn(),
    },
    user: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
  prismaBase: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));

vi.mock('@/lib/services/user-service', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

// Import after mocking
import { prismaBase } from '@/lib/prisma';
import { hashPassword } from '@/lib/services/user-service';
import { provisionTenant, defaultSettingsForOrgType } from '../provision-tenant';

const mockTransaction = prismaBase.$transaction as ReturnType<typeof vi.fn>;

// 기본 입력 (CHURCH + 어드민 포함)
const baseInput = {
  name: '청연교회',
  subdomain: 'chungyeon-church',
  orgType: 'CHURCH' as const,
  plan: 'FREE' as const,
  adminEmail: 'admin@chungyeon.org',
  adminName: '관리자',
  adminPassword: 'password1234',
};

const categoryTemplates = [
  {
    id: 'tpl-cat-1',
    orgType: 'CHURCH',
    code: '1001',
    name: '십일조헌금',
    group: '헌금수입',
    kind: 'INCOME',
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'tpl-cat-2',
    orgType: 'CHURCH',
    code: '5101',
    name: '예배용품비',
    group: '예배비',
    kind: 'EXPENSE',
    sortOrder: 2,
    isActive: true,
  },
];

const lineTemplates = [
  {
    id: 'tpl-line-1',
    orgType: 'CHURCH',
    name: '일반 지출 결재선',
    description: null,
    isDefault: true,
    sortOrder: 1,
    steps: [
      { id: 's1', stepOrder: 1, roleLabel: '부서장' },
      { id: 's2', stepOrder: 2, roleLabel: '재정부장' },
      { id: 's3', stepOrder: 3, roleLabel: '담임목사' },
    ],
  },
  {
    id: 'tpl-line-2',
    orgType: 'CHURCH',
    name: '고액 지출 결재선',
    description: '100만원 이상',
    isDefault: false,
    sortOrder: 2,
    steps: [
      { id: 's4', stepOrder: 1, roleLabel: '부서장' },
      { id: 's5', stepOrder: 2, roleLabel: '재정부장' },
      { id: 's6', stepOrder: 3, roleLabel: '담임목사' },
      { id: 's7', stepOrder: 4, roleLabel: '당회서기' },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();

  tx.tenant.create.mockImplementation(async ({ data }) => ({
    id: 'tenant-1',
    ...data,
  }));
  tx.tenant.update.mockImplementation(async ({ data }) => ({
    id: 'tenant-1',
    ...data,
  }));
  tx.accountCategoryTemplate.findMany.mockResolvedValue(categoryTemplates);
  tx.accountCategory.createMany.mockResolvedValue({ count: categoryTemplates.length });
  tx.approvalLineTemplate.findMany.mockResolvedValue(lineTemplates);
  tx.user.create.mockImplementation(async ({ data }) => ({
    id: 'user-1',
    ...data,
  }));
});

describe('defaultSettingsForOrgType', () => {
  it('CHURCH — 수입 모듈·헌금 연동 활성, 부가세·세금계산서 비활성 (§3.3)', () => {
    const settings = defaultSettingsForOrgType('CHURCH');
    expect(settings.features).toEqual({
      incomeModule: true,
      budgetModule: true,
      vat: false,
      taxInvoice: false,
      offeringLink: true,
    });
    expect(settings.labels.department).toBe('사역팀');
    expect(settings.labels.position).toBe('직분');
  });

  it('COMPANY — 부가세·세금계산서 활성, 수입 모듈·헌금 연동 비활성 (§3.3)', () => {
    const settings = defaultSettingsForOrgType('COMPANY');
    expect(settings.features).toEqual({
      incomeModule: false,
      budgetModule: true,
      vat: true,
      taxInvoice: true,
      offeringLink: false,
    });
    expect(settings.labels.department).toBe('팀');
    expect(settings.labels.position).toBe('직급');
  });

  it('NONPROFIT — §3.3 미정의 유형은 부가세·세금계산서 보수적 비활성', () => {
    const settings = defaultSettingsForOrgType('NONPROFIT');
    expect(settings.features.vat).toBe(false);
    expect(settings.features.taxInvoice).toBe(false);
    expect(settings.features.incomeModule).toBe(false);
  });
});

describe('provisionTenant', () => {
  it('단일 $transaction으로 Tenant·계정과목·결재선·어드민 User를 생성한다', async () => {
    const result = await provisionTenant(baseInput);

    // 단일 트랜잭션
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // 1. Tenant 생성 — orgType 기본 settings 복사
    expect(tx.tenant.create).toHaveBeenCalledTimes(1);
    const tenantData = tx.tenant.create.mock.calls[0][0].data;
    expect(tenantData.name).toBe('청연교회');
    expect(tenantData.orgType).toBe('CHURCH');
    expect(tenantData.settings.features.incomeModule).toBe(true);
    expect(tenantData.maxUsers).toBe(10); // FREE planLimits

    // 2. 계정과목 복제
    expect(tx.accountCategory.createMany).toHaveBeenCalledTimes(1);
    expect(result.accountCategoriesCreated).toBe(2);

    // 3. 결재선 스냅샷 복제
    expect(result.approvalLinesCloned).toBe(2);

    // 4. 어드민 User 생성 + currentUsers 갱신
    expect(hashPassword).toHaveBeenCalledWith('password1234');
    const userData = tx.user.create.mock.calls[0][0].data;
    expect(userData).toMatchObject({
      tenantId: 'tenant-1',
      userid: 'admin@chungyeon.org',
      username: '관리자',
      password: 'hashed:password1234',
      role: 'admin',
      isActive: true,
    });
    expect(tx.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentUsers: 1 } })
    );

    expect(result.adminUser).toEqual({
      id: 'user-1',
      userid: 'admin@chungyeon.org',
      username: '관리자',
    });
    expect(result.warnings).toEqual([]);
  });

  it('복제된 계정과목마다 sourceTemplateId를 기록한다 (FK 없는 String)', async () => {
    await provisionTenant(baseInput);

    const created = tx.accountCategory.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      tenantId: 'tenant-1',
      code: '1001',
      name: '십일조헌금',
      group: '헌금수입',
      kind: 'INCOME',
      sourceTemplateId: 'tpl-cat-1',
    });
    expect(created[1].sourceTemplateId).toBe('tpl-cat-2');
  });

  it('결재선 스냅샷은 roleLabel 텍스트를 보존하고 isDefault 템플릿을 기본값으로 표시한다', async () => {
    await provisionTenant(baseInput);

    // 결재선 스냅샷은 settings.approvalLines로 저장 (첫 번째 tenant.update)
    const settingsUpdate = tx.tenant.update.mock.calls[0][0].data;
    const approvalLines = settingsUpdate.settings.approvalLines;
    expect(approvalLines).toHaveLength(2);
    expect(approvalLines[0]).toMatchObject({
      name: '일반 지출 결재선',
      isDefault: true,
      sourceTemplateId: 'tpl-line-1',
    });
    expect(approvalLines[0].steps).toEqual([
      { stepOrder: 1, roleLabel: '부서장' },
      { stepOrder: 2, roleLabel: '재정부장' },
      { stepOrder: 3, roleLabel: '담임목사' },
    ]);
    expect(approvalLines[1].isDefault).toBe(false);
    expect(approvalLines[1].steps[3]).toEqual({ stepOrder: 4, roleLabel: '당회서기' });
  });

  it('isDefault 템플릿이 없으면 첫 번째 결재선을 기본값으로 지정한다', async () => {
    tx.approvalLineTemplate.findMany.mockResolvedValue(
      lineTemplates.map((template) => ({ ...template, isDefault: false }))
    );

    await provisionTenant(baseInput);

    const settingsUpdate = tx.tenant.update.mock.calls[0][0].data;
    const approvalLines = settingsUpdate.settings.approvalLines;
    expect(approvalLines[0].isDefault).toBe(true);
    expect(approvalLines[1].isDefault).toBe(false);
  });

  it('템플릿 0건이어도 Tenant와 어드민 User는 생성하고 경고를 반환한다', async () => {
    tx.accountCategoryTemplate.findMany.mockResolvedValue([]);
    tx.approvalLineTemplate.findMany.mockResolvedValue([]);

    const result = await provisionTenant(baseInput);

    expect(tx.tenant.create).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.accountCategory.createMany).not.toHaveBeenCalled();
    expect(result.accountCategoriesCreated).toBe(0);
    expect(result.approvalLinesCloned).toBe(0);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('계정과목 템플릿이 없습니다');
    expect(result.warnings[1]).toContain('결재선 템플릿이 없습니다');
  });

  it('어드민 정보가 없으면 User를 만들지 않고 경고를 반환한다', async () => {
    const result = await provisionTenant({
      name: '청연교회',
      subdomain: 'chungyeon-church',
      orgType: 'CHURCH',
    });

    expect(tx.user.create).not.toHaveBeenCalled();
    expect(result.adminUser).toBeNull();
    expect(result.warnings.some((w) => w.includes('어드민 계정 정보'))).toBe(true);
    // currentUsers 갱신 없음 — settings 스냅샷 update만 존재
    const updateCalls = tx.tenant.update.mock.calls;
    expect(updateCalls.every((call) => call[0].data.currentUsers === undefined)).toBe(true);
  });

  it('중간 단계 실패 시 에러가 전파된다 (트랜잭션 전체 롤백)', async () => {
    tx.user.create.mockRejectedValue(new Error('DB 오류'));

    await expect(provisionTenant(baseInput)).rejects.toThrow('DB 오류');
    // 실패도 단일 트랜잭션 안에서 발생 — Prisma가 전체 롤백을 보장한다
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('유효하지 않은 입력은 zod 검증에서 거부된다', async () => {
    await expect(
      provisionTenant({ name: '청', subdomain: 'x', orgType: 'CHURCH' })
    ).rejects.toThrow();
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
