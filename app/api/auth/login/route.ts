import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import {
  createPendingSelectionToken,
  createUserToken,
  createUserTokenCookie,
  deriveLegacyFlags,
  PENDING_SELECTION_MAX_AGE_SECONDS,
  UserSession,
} from '@/lib/auth/user';
import { getMemberships, membershipRoleToRoleCode } from '@/lib/services/membership';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { findTenantBySubdomain } from '@/lib/tenant';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginAttempts,
  getClientIp,
  getRateLimitKey,
} from '@/lib/rate-limit';

const loginSchema = z.object({
  userid: z.string().min(1, '아이디를 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

// POST /api/auth/login - 사용자 로그인
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const body = await request.json();

    // 유효성 검사
    const { userid, password } = loginSchema.parse(body);

    // Rate limit 확인
    const rateLimitKey = getRateLimitKey(clientIp, userid);
    const rateLimitResult = checkLoginRateLimit(rateLimitKey);

    if (!rateLimitResult.allowed) {
      const retryAfterSeconds = Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000);
      return NextResponse.json(
        {
          error: '로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      );
    }

    // 테넌트 확인 (헤더 또는 쿼리에서)
    const subdomain = request.headers.get('x-tenant-subdomain');
    const tenantParam = request.headers.get('x-tenant-param');
    const tenantIdentifier = subdomain || tenantParam;

    let tenant = null;

    // 테넌트 식별자가 있는 경우 (멀티테넌트 모드)
    if (tenantIdentifier) {
      tenant = await findTenantBySubdomain(tenantIdentifier);

      // findTenantBySubdomain은 비활성 테넌트도 null 반환
      if (!tenant) {
        return NextResponse.json(
          { error: '존재하지 않거나 비활성화된 조직입니다.' },
          { status: 404 }
        );
      }
    }

    // 사용자 조회
    const user = await prismaBase.user.findFirst({
      where: {
        ...(tenant ? { tenantId: tenant.tenantId } : {}),
        userid,
      },
      select: {
        id: true,
        tenantId: true,
        userid: true,
        username: true,
        password: true,
        role: true,
        roleId: true,
        department: true,
        isActive: true,
        canRegisterUsers: true,
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      recordLoginFailure(rateLimitKey);
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 활성 상태 확인
    if (!user.isActive) {
      recordLoginFailure(rateLimitKey);
      return NextResponse.json(
        { error: '계정이 비활성화되어 있습니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    // 비밀번호 확인
    if (!user.password) {
      recordLoginFailure(rateLimitKey);
      return NextResponse.json(
        { error: '비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      recordLoginFailure(rateLimitKey);
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 로그인 성공 - Rate limit 초기화
    clearLoginAttempts(rateLimitKey);

    // Membership 조회 (ARC-002 §2.2, B2)
    // DB push/백필(M1·M2) 전에는 Membership 테이블이 없을 수 있으므로
    // 조회 실패는 0건으로 간주 — 0건이면 기존 User.tenantId 동작 그대로 (회귀 방지 최우선)
    const memberships = await getMemberships(user.id).catch(() => []);

    // 홈 테넌트 비활성 처리 — 진입할 활성 조직이 전혀 없을 때만 차단한다.
    // getMemberships는 활성 테넌트만 반환하므로, 소속이 하나라도 있으면 그 활성 조직으로 진입한다.
    // (서브도메인 지정 로그인은 findTenantBySubdomain이 이미 활성 테넌트만 반환하므로 무관)
    if (!tenant && memberships.length === 0 && user.tenant && !user.tenant.isActive) {
      return NextResponse.json(
        { error: '이 조직은 현재 이용할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 복수 소속: 최종 토큰 대신 선택용 임시 토큰 발급 → 최종 토큰은 switch-tenant(B3)에서
    // (서브도메인 지정 로그인은 대상 조직이 이미 확정이므로 기존처럼 바로 발급)
    if (!tenant && memberships.length > 1) {
      const pendingToken = await createPendingSelectionToken({
        id: user.id,
        userid: user.userid,
        username: user.username,
      });

      const response = NextResponse.json({
        success: true,
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

    // 단일 소속은 Membership의 tenantId로, 0건은 기존 User.tenantId 그대로
    // (서브도메인 지정 로그인은 이미 해당 테넌트로 스코프된 조회 결과이므로 기존 값 유지)
    const soleMembership =
      !tenant && memberships.length === 1 ? memberships[0] : null;
    const sessionTenantId = soleMembership
      ? soleMembership.tenantId
      : user.tenantId || '';

    // 세션 테넌트에서의 역할 결정 (switch-tenant와 동일한 권한 상승 방지 규칙):
    // 유일 소속이 홈이 아닌 게스트 테넌트면 홈 User.role/roleId/부서·개별권한을 넘기지 않고
    // Membership.role에서만 파생한다. 홈 테넌트(또는 0건 폴백)는 기존 User 값 유지.
    const isGuestTenant =
      soleMembership !== null && soleMembership.tenantId !== user.tenantId;
    const effectiveRole = isGuestTenant
      ? membershipRoleToRoleCode(soleMembership!.role)
      : user.role;
    const effectiveRoleId = isGuestTenant ? null : user.roleId;
    const effectiveDepartment = isGuestTenant ? null : user.department;
    const canRegisterUsers = isGuestTenant ? false : user.canRegisterUsers;

    // roles-only: 유효 역할 코드로부터 권한 파생 (JWT에 권한을 굽지 않음)
    const roles = [effectiveRole];
    const granted = canRegisterUsers ? [PERMISSIONS.USER_REGISTER] : [];
    const flags = deriveLegacyFlags(roles, granted);

    // 세션 생성
    const session: UserSession = {
      id: user.id,
      tenantId: sessionTenantId,
      userid: user.userid,
      username: user.username,
      role: effectiveRole,
      roles,
      roleId: effectiveRoleId,
      department: effectiveDepartment,
      granted,
      ...flags,
    };

    // JWT 토큰 생성
    const token = await createUserToken(session);

    // 응답의 tenant/user는 발급 토큰의 tenantId와 일치시킨다 — 게스트 테넌트로 자동 진입한 경우
    // 홈 테넌트 정보를 보여주면 클라이언트 표시·캐시와 토큰 스코프가 어긋난다.
    const responseTenant = isGuestTenant
      ? {
          id: soleMembership!.tenant.id,
          name: soleMembership!.tenant.name,
          subdomain: soleMembership!.tenant.subdomain,
        }
      : user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            subdomain: user.tenant.subdomain,
          }
        : null;

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      message: '로그인 성공',
      user: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        role: effectiveRole,
        department: effectiveDepartment,
        permissions: {
          canApprove: session.canApprove,
          canManageExpense: session.canManageExpense,
          canAccessAdmin: session.canAccessAdmin,
          canExportData: session.canExportData,
          canRegisterUsers: session.canRegisterUsers,
        },
      },
      tenant: responseTenant,
      token,
    });

    // 쿠키 설정
    response.headers.set('Set-Cookie', createUserTokenCookie(token));

    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}
