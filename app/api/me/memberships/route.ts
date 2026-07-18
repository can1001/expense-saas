import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { getMemberships } from '@/lib/services/membership';

/**
 * GET /api/me/memberships — 현재 사용자의 소속 조직 목록 (ARC-002 §2.2, B5)
 *
 * 헤더의 "조직 전환" 메뉴 노출 판단(복수 소속만 노출)과 전환 대상 목록에 사용한다.
 * Membership 백필(M2) 전에는 테이블이 없을 수 있으므로 조회 실패는 0건으로 간주 —
 * 0건/1건이면 클라이언트는 전환 메뉴를 노출하지 않는다 (기존 UX 무변경).
 */
const handleGet: UserApiHandler = async (_request, { user }) => {
  try {
    const memberships = await getMemberships(user.id).catch(() => []);

    return NextResponse.json({
      memberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        orgType: m.tenant.orgType,
        role: m.role,
        isCurrent: m.tenantId === user.tenantId,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAuth(handleGet);
