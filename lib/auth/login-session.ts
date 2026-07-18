/**
 * 로그인류 세션·응답 조립 (로그인 B2 · 카카오 C2 · 조직전환 B3 공용)
 *
 * 로그인·카카오 로그인·조직 전환은 "세션 테넌트에서의 역할 결정 → 정식 토큰 발급 →
 * 표준 응답/쿠키" 흐름이 동일하다. 이 로직이 라우트마다 복제되면 한쪽만 고쳐져
 * (예: 게스트 테넌트 권한 상승 방지) 계약이 어긋나므로 단일 출처로 모은다.
 */

import { NextResponse } from 'next/server';
import {
  UserSession,
  createUserToken,
  createUserTokenCookie,
  createPendingSelectionToken,
  deriveLegacyFlags,
  PENDING_SELECTION_MAX_AGE_SECONDS,
} from './user';
import { PERMISSIONS } from './permissions';
import {
  membershipRoleToRoleCode,
  type MembershipWithTenant,
} from '@/lib/services/membership';

/** 세션 조립에 필요한 사용자 최소 필드 */
export interface TenantSessionUser {
  id: string;
  tenantId: string | null;
  userid: string;
  username: string;
  role: string;
  roleId: string | null;
  department: string | null;
  canRegisterUsers: boolean;
}

/** 응답 tenant 블록 (orgType은 조직전환 응답에서만 포함) */
export interface SessionTenant {
  id: string;
  name: string;
  subdomain: string | null;
  orgType?: string;
}

/**
 * 세션 테넌트에서의 역할을 결정해 UserSession을 만든다.
 *
 * - 홈 테넌트(sessionTenantId === user.tenantId): 기존 User.role/roleId/부서·개별권한 유지.
 *   백필로 세밀한 역할(finance_head 등)이 Membership에는 MEMBER로만 남으므로 홈은 User가 진실.
 * - 게스트 소속(홈이 아닌 테넌트): Membership.role(TENANT_ADMIN/MEMBER)에서만 역할을 파생하고
 *   홈 테넌트의 roleId/부서/개별권한은 넘기지 않는다 — 홈 관리자 권한이 다른 테넌트로 상승하거나
 *   타 테넌트 Role 행(roleId)이 유출되는 것을 막는다.
 *
 * membershipRole은 게스트 판정 시에만 사용되며, 없으면 최소 권한(MEMBER)으로 간주한다.
 */
export function buildTenantSession(
  user: TenantSessionUser,
  sessionTenantId: string,
  membershipRole: string | null
): UserSession {
  const isGuest = sessionTenantId !== (user.tenantId ?? '');
  const role = isGuest
    ? membershipRoleToRoleCode(membershipRole ?? 'MEMBER')
    : user.role;
  const roleId = isGuest ? null : user.roleId;
  const department = isGuest ? null : user.department;
  const canRegisterUsers = isGuest ? false : user.canRegisterUsers;

  const roles = [role];
  const granted = canRegisterUsers ? [PERMISSIONS.USER_REGISTER] : [];
  const flags = deriveLegacyFlags(roles, granted);

  return {
    id: user.id,
    tenantId: sessionTenantId,
    userid: user.userid,
    username: user.username,
    role,
    roles,
    roleId,
    department,
    granted,
    ...flags,
  };
}

/**
 * 정식 세션 토큰 발급 + 표준 응답/쿠키 구성 (로그인·카카오·조직전환 공용).
 * 응답의 user.role/department·tenant는 발급 세션과 항상 일치한다(표시·캐시 불일치 방지).
 * extra로 라우트별 추가 필드(linked 등)를, status로 상태코드를 지정한다.
 */
export async function issueSessionResponse(
  session: UserSession,
  tenant: SessionTenant | null,
  options?: { message?: string; status?: number; extra?: Record<string, unknown> }
): Promise<NextResponse> {
  const token = await createUserToken(session);

  const response = NextResponse.json(
    {
      success: true,
      message: options?.message ?? '로그인 성공',
      ...options?.extra,
      user: {
        id: session.id,
        userid: session.userid,
        username: session.username,
        role: session.role,
        department: session.department,
        permissions: {
          canApprove: session.canApprove,
          canManageExpense: session.canManageExpense,
          canAccessAdmin: session.canAccessAdmin,
          canExportData: session.canExportData,
          canRegisterUsers: session.canRegisterUsers,
        },
      },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            subdomain: tenant.subdomain,
            ...(tenant.orgType !== undefined ? { orgType: tenant.orgType } : {}),
          }
        : null,
      token,
    },
    options?.status ? { status: options.status } : undefined
  );

  response.headers.set('Set-Cookie', createUserTokenCookie(token));

  return response;
}

/**
 * 복수 소속 시 조직 선택용 임시 토큰 응답 (로그인·카카오 공용, B2).
 * 최종 토큰은 발급하지 않으며 switch-tenant(B3)에서 선택 완료 후 발급된다.
 */
export async function buildPendingSelectionResponse(
  user: { id: string; userid: string; username: string },
  memberships: MembershipWithTenant[],
  extra?: Record<string, unknown>
): Promise<NextResponse> {
  const pendingToken = await createPendingSelectionToken({
    id: user.id,
    userid: user.userid,
    username: user.username,
  });

  const response = NextResponse.json({
    success: true,
    ...extra,
    message: '소속 조직을 선택해주세요.',
    requiresTenantSelection: true,
    memberships: memberships.map((m) => ({
      tenantId: m.tenantId,
      tenantName: m.tenant.name,
      orgType: m.tenant.orgType,
      role: m.role,
    })),
    token: pendingToken,
  });

  response.headers.set(
    'Set-Cookie',
    createUserTokenCookie(pendingToken, PENDING_SELECTION_MAX_AGE_SECONDS)
  );

  return response;
}
