/**
 * 대량 사용자 업로드 — Membership 이중 기록 (ARC-002 §2.2)
 *
 * User createMany 이후 생성된 사용자마다 Membership을 함께 기록하는지 검증한다.
 * (회귀 시 벌크 유저가 Membership 없이 생성돼 /api/me/memberships·switch-tenant에서 누락)
 * 실제 ExcelJS로 xlsx 버퍼를 만들어 라우트가 파싱하도록 하고, DB·tenant 컨텍스트만 모킹한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { resetMockUser } from '@/test/setup';

// tenant 컨텍스트 — withPermissions 전역 mock은 AsyncLocalStorage를 세팅하지 않으므로 직접 모킹
const mockGetTenantId = vi.fn<() => string | undefined>();
vi.mock('@/lib/tenant-context', () => ({
  getTenantIdOptional: () => mockGetTenantId(),
}));

// DB 모킹 — 분류용 prisma.user.findMany + 쓰기용 prismaBase.$transaction
const txUserCreateMany = vi.fn();
const txUserFindMany = vi.fn();
const txMembershipCreateMany = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
  },
  prismaBase: {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        user: { createMany: txUserCreateMany, findMany: txUserFindMany },
        membership: { createMany: txMembershipCreateMany },
      })
    ),
  },
}));

// 역할 코드 → id 맵 (roleId 채우기)
vi.mock('@/lib/services/user-service', () => ({
  getAllRoles: vi.fn().mockResolvedValue([
    { code: 'admin', id: 'role-admin' },
    { code: 'user', id: 'role-user' },
  ]),
}));

// roleCodeToMembershipRole은 실제 구현 사용 (순수 함수)
import { POST } from '../route';

// jsdom의 File/FormData(arrayBuffer 미구현, multipart 파싱 hang)를 피하려고,
// 라우트가 실제로 쓰는 인터페이스(formData().get(), file.arrayBuffer())만 갖춘 순수 객체로 대체.
async function xlsxRequest(
  rows: Array<{ userid: string; username: string; role?: string }>,
  opts?: { dryRun?: boolean }
): Promise<NextRequest> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('users');
  ws.addRow(['userid', 'username', 'role']);
  for (const r of rows) ws.addRow([r.userid, r.username, r.role ?? '']);
  const buffer = await wb.xlsx.writeBuffer();

  const fields: Record<string, unknown> = {
    file: { arrayBuffer: async () => buffer },
    mode: 'add',
    ...(opts?.dryRun ? { dryRun: 'true' } : {}),
  };
  const formData = { get: (k: string) => fields[k] ?? null };

  return { formData: async () => formData } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetMockUser(); // admin, tenantId 'test-tenant-id', USER_MANAGE 권한 보유
  mockGetTenantId.mockReturnValue('test-tenant-id');
  // 생성 후 재조회 — 방금 만든 유저들
  txUserFindMany.mockResolvedValue([
    { id: 'u-admin', role: 'admin' },
    { id: 'u-user', role: 'user' },
  ]);
});

describe('대량 업로드 — Membership 이중 기록', () => {
  it('생성된 사용자마다 Membership을 tenantId·역할 tier와 함께 기록한다', async () => {
    const res = await POST(
      await xlsxRequest([
        { userid: 'admin1', username: '관리자', role: 'admin' },
        { userid: 'member1', username: '일반', role: '' }, // 역할 없음 → user
      ]),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    expect(txUserCreateMany).toHaveBeenCalledOnce();
    // Membership 이중 기록 — admin→TENANT_ADMIN, user→MEMBER, 첫 소속이므로 isDefault
    expect(txMembershipCreateMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u-admin', tenantId: 'test-tenant-id', role: 'TENANT_ADMIN', isDefault: true },
        { userId: 'u-user', tenantId: 'test-tenant-id', role: 'MEMBER', isDefault: true },
      ],
      skipDuplicates: true,
    });
  });

  it('생성 User 행에 tenantId와 roleId가 채워진다', async () => {
    await POST(
      await xlsxRequest([{ userid: 'admin1', username: '관리자', role: 'admin' }]),
      { params: Promise.resolve({}) }
    );

    expect(txUserCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            userid: 'admin1',
            tenantId: 'test-tenant-id',
            roleId: 'role-admin',
          }),
        ]),
        skipDuplicates: true,
      })
    );
  });

  it('tenant 컨텍스트가 없으면 Membership을 만들지 않는다 (레거시 경로 유지)', async () => {
    mockGetTenantId.mockReturnValue(undefined);

    const res = await POST(
      await xlsxRequest([{ userid: 'x', username: '엑스', role: 'admin' }]),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    expect(txUserCreateMany).toHaveBeenCalledOnce();
    expect(txMembershipCreateMany).not.toHaveBeenCalled();
  });

  it('dryRun이면 어떤 쓰기도 하지 않는다', async () => {
    const res = await POST(
      await xlsxRequest([{ userid: 'admin1', username: '관리자', role: 'admin' }], {
        dryRun: true,
      }),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    expect(txUserCreateMany).not.toHaveBeenCalled();
    expect(txMembershipCreateMany).not.toHaveBeenCalled();
  });
});
