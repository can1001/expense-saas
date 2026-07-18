import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import {
  COOKIE_NAME,
  createUserToken,
  createUserTokenCookie,
  deriveLegacyFlags,
  verifyPendingSelectionToken,
  verifyUserToken,
  UserSession,
} from '@/lib/auth/user';
import { assertMembership, membershipRoleToRoleCode } from '@/lib/services/membership';
import type { Membership } from '@prisma/client';
import { fcmProvider } from '@/lib/services/notification/fcm-provider';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { z } from 'zod';

const switchTenantSchema = z.object({
  tenantId: z.string().min(1, '전환할 조직을 선택해주세요'),
});

// 요청에서 토큰 원문 추출 (Authorization 헤더 → user_token 쿠키 순)
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

// POST /api/auth/switch-tenant - 조직 전환 (ARC-002 §3.2, B3)
// tenantId를 바디로 받는 유일한 예외 경로: 전환 "대상" 지정이 목적이고,
// 서버가 Membership으로 소속을 검증한 뒤에만 새 토큰을 발급한다 (공통 원칙 2).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId } = switchTenantSchema.parse(body);

    // 1. 현재 토큰 검증 — 정식 토큰 또는 로그인(B2)의 조직 선택용 임시 토큰
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const session = await verifyUserToken(token);
    const pending = session ? null : await verifyPendingSelectionToken(token);
    const userId = session?.id ?? pending?.id;
    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 2. Membership 검증 — 미소속이면 403 (토큰·쿠키 무변경)
    let membership: Membership;
    try {
      membership = await assertMembership(userId, tenantId);
    } catch {
      return NextResponse.json(
        { error: '해당 조직에 소속되어 있지 않습니다.' },
        { status: 403 }
      );
    }

    // 3. 사용자·대상 테넌트 활성 상태 확인
    const [user, tenant] = await Promise.all([
      prismaBase.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          userid: true,
          username: true,
          role: true,
          roleId: true,
          department: true,
          tenantId: true,
          isActive: true,
          canRegisterUsers: true,
        },
      }),
      prismaBase.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          subdomain: true,
          orgType: true,
          isActive: true,
        },
      }),
    ]);

    if (!user?.isActive) {
      return NextResponse.json(
        { error: '계정이 비활성화되어 있습니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    if (!tenant?.isActive) {
      return NextResponse.json(
        { error: '이 조직은 현재 이용할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 4. 새 tenantId 클레임으로 정식 토큰 재발급 (로그인과 동일한 roles-only 방식)
    //
    // 대상 테넌트에서의 역할 결정 (권한 상승 방지):
    // - 홈 테넌트(User.tenantId와 동일): 기존 User.role/roleId/department·개별 권한을 그대로 유지.
    //   백필로 세밀한 역할(finance_head 등)이 Membership에는 MEMBER로만 남으므로 홈은 User가 진실.
    // - 게스트 소속(홈이 아닌 테넌트): Membership.role(TENANT_ADMIN/MEMBER)에서만 역할을 파생하고
    //   홈 테넌트의 roleId/department/canRegisterUsers는 넘기지 않는다 — 홈 관리자 권한이
    //   다른 테넌트로 상승하는 것을 막고, 타 테넌트 Role 행 참조(roleId) 유출도 방지.
    const isHomeTenant = tenant.id === user.tenantId;
    const effectiveRole = isHomeTenant
      ? user.role
      : membershipRoleToRoleCode(membership.role);
    const effectiveRoleId = isHomeTenant ? user.roleId : null;
    const effectiveDepartment = isHomeTenant ? user.department : null;
    const canRegisterUsers = isHomeTenant ? user.canRegisterUsers : false;

    const roles = [effectiveRole];
    const granted = canRegisterUsers ? [PERMISSIONS.USER_REGISTER] : [];
    const flags = deriveLegacyFlags(roles, granted);

    const newSession: UserSession = {
      id: user.id,
      tenantId: tenant.id,
      userid: user.userid,
      username: user.username,
      role: effectiveRole,
      roles,
      roleId: effectiveRoleId,
      department: effectiveDepartment,
      granted,
      ...flags,
    };

    const newToken = await createUserToken(newSession);

    // 5. FCM 토큰/토픽 테넌트 재스코프 (B6) — 이전 테넌트 토픽 해제 → 새 테넌트 구독.
    // resubscribeTenantTopics는 내부에서 오류를 흡수하므로 전환 자체를 막지 않는다.
    await fcmProvider.resubscribeTenantTopics(user.id, tenant.id);

    // 응답: 최소 유저/테넌트 정보 (로그인/me 응답 관례)
    const response = NextResponse.json({
      success: true,
      message: '조직이 전환되었습니다.',
      user: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        role: effectiveRole,
        department: effectiveDepartment,
        permissions: {
          canApprove: newSession.canApprove,
          canManageExpense: newSession.canManageExpense,
          canAccessAdmin: newSession.canAccessAdmin,
          canExportData: newSession.canExportData,
          canRegisterUsers: newSession.canRegisterUsers,
        },
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        orgType: tenant.orgType,
      },
      token: newToken,
    });

    response.headers.set('Set-Cookie', createUserTokenCookie(newToken));

    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '전환할 조직을 지정해주세요.' },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}
