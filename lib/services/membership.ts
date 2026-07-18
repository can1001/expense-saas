/**
 * Membership 서비스 (ARC-002 §2.2)
 *
 * 소속 조회는 한 유저의 모든 테넌트를 가로지르는 조회이므로
 * 테넌트 필터링이 없는 prismaBase를 사용한다.
 *
 * 원칙 (공통 원칙 2): tenantId 스코프는 JWT 클레임에서만 온다.
 * assertMembership은 switch-tenant(B3) 등에서 "요청 유저가 해당 테넌트 소속인가"를
 * 서버측에서 검증하는 용도다.
 */

import type { Membership, Tenant } from '@prisma/client';
import { prismaBase } from '@/lib/prisma';

// Membership.role 값 — TENANT_ADMIN(테넌트 관리자) / MEMBER(일반 구성원)
export const MEMBERSHIP_ROLES = ['TENANT_ADMIN', 'MEMBER'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/**
 * Membership.role(TENANT_ADMIN/MEMBER) → 인가용 역할 코드(Role.code).
 *
 * 백필(scripts/backfill-memberships.ts)의 `admin → TENANT_ADMIN` 매핑을 역으로 되돌린다.
 * 'admin'/'user'는 PROTECTED_SYSTEM_ROLE_CODES라 모든 테넌트에 존재하므로(프리셋 폴백 포함)
 * 게스트 소속 세션도 안전한 기본 권한으로 해석된다.
 *
 * 게스트 테넌트(홈이 아닌 소속)의 토큰 역할은 홈 User.role이 아니라 반드시 이 값으로 파생해야
 * 홈 테넌트의 관리자 권한이 다른 테넌트로 넘어가지 않는다 (권한 상승 방지).
 */
export function membershipRoleToRoleCode(role: string): 'admin' | 'user' {
  return role === 'TENANT_ADMIN' ? 'admin' : 'user';
}

export type MembershipWithTenant = Membership & {
  tenant: Pick<Tenant, 'id' | 'name' | 'orgType' | 'isActive'>;
};

/**
 * 유저의 소속 목록 조회 — 활성 테넌트만, 기본 조직 우선 정렬.
 * Membership이 0건이면 빈 배열 (호출측은 기존 User.tenantId 동작으로 폴백 — 백필 전 회귀 방지).
 */
export async function getMemberships(userId: string): Promise<MembershipWithTenant[]> {
  return prismaBase.membership.findMany({
    where: { userId, tenant: { isActive: true } },
    include: {
      tenant: { select: { id: true, name: true, orgType: true, isActive: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

/**
 * 유저가 해당 테넌트 소속인지 검증 — 미소속이면 throw.
 * 검증 통과 시 Membership을 반환한다.
 */
export async function assertMembership(userId: string, tenantId: string): Promise<Membership> {
  const membership = await prismaBase.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });

  if (!membership) {
    throw new Error('해당 조직에 소속되어 있지 않습니다.');
  }

  return membership;
}
