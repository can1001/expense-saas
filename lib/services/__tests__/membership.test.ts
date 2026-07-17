/**
 * Membership 서비스 테스트 (ARC-002 §2.2, B1)
 *
 * DB 무실행 원칙 — prismaBase를 모킹하여 조회 조건·검증 로직만 확인한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockMembership } = vi.hoisted(() => ({
  mockMembership: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
  prismaBase: {
    membership: mockMembership,
  },
}));

import { getMemberships, assertMembership } from '../membership';

const membership = {
  id: 'membership-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'MEMBER',
  isDefault: true,
  createdAt: new Date('2026-07-18'),
  updatedAt: new Date('2026-07-18'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMemberships', () => {
  it('활성 테넌트 소속만 기본 조직 우선으로 조회한다', async () => {
    const withTenant = {
      ...membership,
      tenant: { id: 'tenant-1', name: '청연교회', orgType: 'CHURCH', isActive: true },
    };
    mockMembership.findMany.mockResolvedValue([withTenant]);

    const result = await getMemberships('user-1');

    expect(mockMembership.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', tenant: { isActive: true } },
      include: {
        tenant: { select: { id: true, name: true, orgType: true, isActive: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    expect(result).toEqual([withTenant]);
  });

  it('소속이 없으면 빈 배열을 반환한다 (백필 전 회귀 방지 — 호출측 폴백용)', async () => {
    mockMembership.findMany.mockResolvedValue([]);

    await expect(getMemberships('user-없음')).resolves.toEqual([]);
  });
});

describe('assertMembership', () => {
  it('소속이면 Membership을 반환한다', async () => {
    mockMembership.findUnique.mockResolvedValue(membership);

    const result = await assertMembership('user-1', 'tenant-1');

    expect(mockMembership.findUnique).toHaveBeenCalledWith({
      where: { userId_tenantId: { userId: 'user-1', tenantId: 'tenant-1' } },
    });
    expect(result).toEqual(membership);
  });

  it('미소속이면 한국어 메시지로 throw한다', async () => {
    mockMembership.findUnique.mockResolvedValue(null);

    await expect(assertMembership('user-1', 'tenant-다른곳')).rejects.toThrow(
      '해당 조직에 소속되어 있지 않습니다.'
    );
  });
});
