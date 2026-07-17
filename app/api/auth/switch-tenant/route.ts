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
import { assertMembership } from '@/lib/services/membership';
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
    try {
      await assertMembership(userId, tenantId);
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
    const roles = [user.role];
    const granted = user.canRegisterUsers ? [PERMISSIONS.USER_REGISTER] : [];
    const flags = deriveLegacyFlags(roles, granted);

    const newSession: UserSession = {
      id: user.id,
      tenantId: tenant.id,
      userid: user.userid,
      username: user.username,
      role: user.role,
      roles,
      roleId: user.roleId,
      department: user.department,
      granted,
      ...flags,
    };

    const newToken = await createUserToken(newSession);

    // 응답: 최소 유저/테넌트 정보 (로그인/me 응답 관례)
    const response = NextResponse.json({
      success: true,
      message: '조직이 전환되었습니다.',
      user: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        role: user.role,
        department: user.department,
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
