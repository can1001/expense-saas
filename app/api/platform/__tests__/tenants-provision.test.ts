/**
 * 플랫폼 테넌트 생성 API — provisionTenant() 경유 검증 (A5)
 *
 * DB 무실행 원칙 — prisma를 모킹하고 실제 라우트 핸들러(POST)를 호출하여
 * ① 기존 API 계약(요청 바디·응답 형태) 유지,
 * ② 생성 시 orgType 템플릿 복제(계정과목·결재선)가 함께 일어남,
 * ③ 기존 관례(기본 역할 생성·Budget 5단계 시딩·활동 로그)가 같은 트랜잭션에서 유지됨을 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// 트랜잭션 클라이언트 모킹 — $transaction 콜백에 그대로 전달된다
const { tx, tenantStore } = vi.hoisted(() => {
  const tenantStore: { row: Record<string, unknown> } = { row: {} };
  return {
    tenantStore,
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
      membership: {
        create: vi.fn(),
      },
      role: {
        createMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {},
  Prisma: {},
  prismaBase: {
    tenant: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));

vi.mock('@/lib/auth/super-admin', () => ({
  withSuperAdmin: (
    handler: (req: NextRequest, ctx: { superAdmin: { id: string; email: string; name: string } }) => Promise<Response>
  ) => (req: NextRequest) =>
    handler(req, {
      superAdmin: { id: 'super-1', email: 'admin@platform.com', name: '플랫폼 관리자' },
    }),
}));

vi.mock('@/lib/platform/activity-log', () => ({
  logPlatformActivity: vi.fn(async () => undefined),
}));

vi.mock('@/lib/tenant/seed-default-data', () => ({
  seedDefaultData: vi.fn(async () => ({
    committeesCreated: 2,
    departmentsCreated: 4,
    budgetCategoriesCreated: 3,
    budgetSubcategoriesCreated: 6,
    budgetDetailsCreated: 12,
  })),
}));

vi.mock('@/lib/services/user-service', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

// Import after mocking
import { prismaBase } from '@/lib/prisma';
import { logPlatformActivity } from '@/lib/platform/activity-log';
import { seedDefaultData } from '@/lib/tenant/seed-default-data';
import { POST } from '../tenants/route';

const mockFindUnique = prismaBase.tenant.findUnique as ReturnType<typeof vi.fn>;
const mockTransaction = prismaBase.$transaction as ReturnType<typeof vi.fn>;
const mockLogActivity = logPlatformActivity as ReturnType<typeof vi.fn>;
const mockSeedDefaultData = seedDefaultData as ReturnType<typeof vi.fn>;

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
];

const baseBody = {
  name: '청연교회',
  subdomain: 'chungyeon-church',
  orgType: 'CHURCH',
  plan: 'FREE',
  adminEmail: 'admin@chungyeon.org',
  adminName: '관리자',
  adminPassword: 'password1234',
};

// Next.js 16 Route Handler 시그니처(request, context) 호환
const routeContext = { params: Promise.resolve({}) };

function callPost(body: unknown) {
  const request = new NextRequest('http://localhost/api/platform/tenants', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return POST(request, routeContext);
}

beforeEach(() => {
  vi.clearAllMocks();

  // 중복 없음이 기본
  mockFindUnique.mockResolvedValue(null);

  // tenant 행을 저장해 create/update가 실제 DB처럼 전체 행을 반환하도록 시뮬레이션
  tenantStore.row = {};
  tx.tenant.create.mockImplementation(async ({ data }) => {
    tenantStore.row = { id: 'tenant-1', currentUsers: 0, isActive: true, ...data };
    return { ...tenantStore.row };
  });
  tx.tenant.update.mockImplementation(async ({ data }) => {
    tenantStore.row = { ...tenantStore.row, ...data };
    return { ...tenantStore.row };
  });
  tx.accountCategoryTemplate.findMany.mockResolvedValue(categoryTemplates);
  tx.accountCategory.createMany.mockResolvedValue({ count: categoryTemplates.length });
  tx.approvalLineTemplate.findMany.mockResolvedValue(lineTemplates);
  tx.user.create.mockImplementation(async ({ data }) => ({ id: 'user-1', ...data }));
  tx.membership.create.mockImplementation(async ({ data }) => ({ id: 'membership-1', ...data }));
  tx.role.createMany.mockResolvedValue({ count: 5 });
});

describe('POST /api/platform/tenants — provisionTenant() 경유', () => {
  it('테넌트 생성 시 orgType 템플릿 복제(계정과목·결재선)가 함께 일어난다', async () => {
    const response = await callPost(baseBody);

    expect(response.status).toBe(201);

    // 계정과목 템플릿 → AccountCategory 복제 (sourceTemplateId 기록)
    expect(tx.accountCategory.createMany).toHaveBeenCalledTimes(1);
    const cloned = tx.accountCategory.createMany.mock.calls[0][0].data;
    expect(cloned).toHaveLength(2);
    expect(cloned[0]).toMatchObject({
      tenantId: 'tenant-1',
      code: '1001',
      kind: 'INCOME',
      sourceTemplateId: 'tpl-cat-1',
    });

    // 결재선 템플릿 → settings.approvalLines 스냅샷 복제
    const settingsUpdate = tx.tenant.update.mock.calls[0][0].data;
    expect(settingsUpdate.settings.approvalLines).toHaveLength(1);
    expect(settingsUpdate.settings.approvalLines[0]).toMatchObject({
      name: '일반 지출 결재선',
      isDefault: true,
      sourceTemplateId: 'tpl-line-1',
    });
  });

  it('기존 관례를 유지한다 — 역할 생성·Budget 기본 시딩이 같은 단일 트랜잭션에서 수행된다', async () => {
    const response = await callPost(baseBody);

    expect(response.status).toBe(201);
    // 단일 트랜잭션 (부분 생성 방지)
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // 기본 역할 5종 생성
    expect(tx.role.createMany).toHaveBeenCalledTimes(1);
    const roles = tx.role.createMany.mock.calls[0][0].data;
    expect(roles).toHaveLength(5);
    expect(roles.map((r: { code: string }) => r.code)).toEqual([
      'admin',
      'finance_head',
      'accountant',
      'team_leader',
      'user',
    ]);
    expect(roles.every((r: { tenantId: string }) => r.tenantId === 'tenant-1')).toBe(true);

    // Budget 5단계 기본 계정과목 시딩 — 트랜잭션 클라이언트로 호출
    expect(mockSeedDefaultData).toHaveBeenCalledTimes(1);
    expect(mockSeedDefaultData).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      orgType: 'CHURCH',
      tx,
    });
  });

  it('기존 응답 계약을 유지한다 — 201 + 테넌트 객체, 어드민 제공 시 currentUsers 1', async () => {
    const response = await callPost(baseBody);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      id: 'tenant-1',
      name: '청연교회',
      subdomain: 'chungyeon-church',
      orgType: 'CHURCH',
      plan: 'FREE',
      maxUsers: 10, // FREE planLimits
      currentUsers: 1,
    });

    // 어드민 User 생성 (기존 계약: adminEmail/adminName/adminPassword)
    const userData = tx.user.create.mock.calls[0][0].data;
    expect(userData).toMatchObject({
      tenantId: 'tenant-1',
      userid: 'admin@chungyeon.org',
      username: '관리자',
      role: 'admin',
      isActive: true,
    });
  });

  it('활동 로그 관례를 유지하고 템플릿 복제 결과를 함께 기록한다', async () => {
    await callPost(baseBody);

    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    const logged = mockLogActivity.mock.calls[0][0];
    expect(logged).toMatchObject({
      superAdminId: 'super-1',
      action: 'CREATE_TENANT',
      entityType: 'tenant',
      entityId: 'tenant-1',
      tenantName: '청연교회',
    });
    expect(logged.details.hasInitialAdmin).toBe(true);
    expect(logged.details.defaultDataSeeded).toMatchObject({ committeesCreated: 2 });
    expect(logged.details.templatesCloned).toEqual({
      accountCategories: 2,
      approvalLines: 1,
    });
  });

  it('중복 서브도메인은 409를 반환한다 (기존 계약)', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'tenant-existing', subdomain: 'chungyeon-church' });

    const response = await callPost(baseBody);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('이미 사용 중인 서브도메인입니다');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('유효하지 않은 바디는 400을 반환한다 (기존 계약)', async () => {
    const response = await callPost({ name: '청' });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('입력 데이터가 유효하지 않습니다');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('트랜잭션 내부 단계(역할 생성) 실패 시 에러가 전파된다 — 부분 생성 방지', async () => {
    tx.role.createMany.mockRejectedValueOnce(new Error('DB 오류'));

    const response = await callPost(baseBody);

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});
