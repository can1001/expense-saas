/**
 * @jest-environment node
 *
 * B3: 세션 검증의 Membership 폴백.
 * switch-tenant로 발급된 토큰의 tenantId는 User.tenantId(백필 전 호환용)와 다를 수 있다.
 * - 일치: 기존 동작 그대로 통과
 * - 불일치: 활성 테넌트의 Membership 소속일 때만 통과, 미소속/비활성 테넌트/조회 실패(테이블 미생성)는 거부
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock @/lib/prisma (실제 user.ts 구현이 사용할 DB 접근)
vi.mock('@/lib/prisma', () => ({
  prismaBase: {
    user: { findUnique: vi.fn() },
    membership: { findFirst: vi.fn() },
  },
}));

// 전역 mock(test/setup.ts)을 우회하고 실제 구현을 사용
const actual = await vi.importActual<typeof import('../user')>('../user');
const { createUserToken, getUserFromRequest } = actual;

import { prismaBase } from '@/lib/prisma';

const mockPrisma = prismaBase as any;

function sessionFor(tenantId: string) {
  return {
    id: 'user-1',
    tenantId,
    userid: 'testuser',
    username: '테스트유저',
    role: 'user',
    roles: ['user'],
    roleId: null,
    department: null,
    granted: [],
    canApprove: false,
    canManageExpense: false,
    canAccessAdmin: false,
    canExportData: false,
    canRegisterUsers: false,
  } as Parameters<typeof createUserToken>[0];
}

async function requestWithToken(tenantId: string): Promise<NextRequest> {
  const token = await createUserToken(sessionFor(tenantId));
  return new NextRequest('http://localhost/api/test', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // User.tenantId는 tenant-1 (백필 전 호환용 유지값), 홈 테넌트는 활성
  mockPrisma.user.findUnique.mockResolvedValue({
    isActive: true,
    tenantId: 'tenant-1',
    tenant: { isActive: true },
  });
  mockPrisma.membership.findFirst.mockResolvedValue(null);
});

describe('getUserFromRequest — Membership 폴백 (B3)', () => {
  it('토큰 tenantId가 User.tenantId와 일치하면 기존처럼 통과한다', async () => {
    const session = await getUserFromRequest(await requestWithToken('tenant-1'));

    expect(session?.id).toBe('user-1');
    expect(session?.tenantId).toBe('tenant-1');
    // 일치 시 Membership 조회 없음 (기존 경로 그대로)
    expect(mockPrisma.membership.findFirst).not.toHaveBeenCalled();
  });

  it('불일치여도 활성 테넌트 Membership 소속이면 통과한다 (조직 전환 토큰)', async () => {
    mockPrisma.membership.findFirst.mockResolvedValue({ id: 'membership-1' });

    const session = await getUserFromRequest(await requestWithToken('tenant-2'));

    expect(session?.tenantId).toBe('tenant-2');
    // 폴백 조회는 활성 테넌트(tenant.isActive) 조건을 포함해야 한다
    expect(mockPrisma.membership.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        tenantId: 'tenant-2',
        tenant: { isActive: true },
      },
      select: { id: true },
    });
  });

  it('불일치 + 미소속이면 거부한다', async () => {
    mockPrisma.membership.findFirst.mockResolvedValue(null);

    const session = await getUserFromRequest(await requestWithToken('tenant-2'));

    expect(session).toBeNull();
  });

  it('불일치 + 비활성 테넌트 소속이면 거부한다 (테넌트 비활성화 시 세션 무효)', async () => {
    // tenant.isActive 필터로 조회 결과가 null → 거부
    mockPrisma.membership.findFirst.mockResolvedValue(null);

    const session = await getUserFromRequest(await requestWithToken('tenant-2'));

    expect(session).toBeNull();
  });

  it('불일치 + Membership 조회 실패(테이블 미생성)도 기존처럼 거부한다', async () => {
    mockPrisma.membership.findFirst.mockRejectedValue(
      new Error('relation "Membership" does not exist')
    );

    const session = await getUserFromRequest(await requestWithToken('tenant-2'));

    expect(session).toBeNull();
  });

  it('비활성 사용자는 일치 여부와 무관하게 거부한다', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: false,
      tenantId: 'tenant-1',
      tenant: { isActive: true },
    });

    const session = await getUserFromRequest(await requestWithToken('tenant-1'));

    expect(session).toBeNull();
  });

  it('홈 테넌트가 비활성이면 일치해도 거부한다 (비활성 시 즉시 무효, 게스트 경로와 동일)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isActive: true,
      tenantId: 'tenant-1',
      tenant: { isActive: false },
    });

    const session = await getUserFromRequest(await requestWithToken('tenant-1'));

    expect(session).toBeNull();
    // 홈 일치 경로에서 걸러지므로 Membership 폴백 조회는 하지 않는다
    expect(mockPrisma.membership.findFirst).not.toHaveBeenCalled();
  });
});
