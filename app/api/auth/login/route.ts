import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import {
  createUserToken,
  createUserTokenCookie,
  deriveLegacyFlags,
  UserSession,
} from '@/lib/auth/user';
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

    // 테넌트 활성 상태 확인
    if (user.tenant && !user.tenant.isActive) {
      recordLoginFailure(rateLimitKey);
      return NextResponse.json(
        { error: '이 조직은 현재 이용할 수 없습니다.' },
        { status: 403 }
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

    // roles-only: 유효 역할 코드로부터 권한 파생 (JWT에 권한을 굽지 않음)
    const roles = [user.role];
    const granted = user.canRegisterUsers ? [PERMISSIONS.USER_REGISTER] : [];
    const flags = deriveLegacyFlags(roles, granted);

    // 세션 생성
    const session: UserSession = {
      id: user.id,
      tenantId: user.tenantId || '',
      userid: user.userid,
      username: user.username,
      role: user.role,
      roles,
      roleId: user.roleId,
      department: user.department,
      granted,
      ...flags,
    };

    // JWT 토큰 생성
    const token = await createUserToken(session);

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      message: '로그인 성공',
      user: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        role: user.role,
        department: user.department,
        permissions: {
          canApprove: session.canApprove,
          canManageExpense: session.canManageExpense,
          canAccessAdmin: session.canAccessAdmin,
          canExportData: session.canExportData,
          canRegisterUsers: session.canRegisterUsers,
        },
      },
      tenant: user.tenant ? {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain,
      } : null,
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
