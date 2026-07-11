import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { TenantContext, withTenantAsync } from '@/lib/tenant-context';
import { findTenantBySubdomain } from '@/lib/tenant';

// JWT 설정
const JWT_SECRET = new TextEncoder().encode(
  process.env.USER_JWT_SECRET || 'user-secret-key-change-in-production'
);
const JWT_ISSUER = 'expense-saas';
const JWT_AUDIENCE = 'tenant-user';
const TOKEN_EXPIRY = '24h'; // 24시간
const COOKIE_NAME = 'user_token';

// 사용자 세션 타입
export interface UserSession {
  id: string;
  tenantId: string;
  userid: string;
  username: string;
  role: string;
  roleId: string | null;
  department: string | null;
  canApprove: boolean;
  canManageExpense: boolean;
  canAccessAdmin: boolean;
  canExportData: boolean;
  canRegisterUsers: boolean;
}

// JWT Payload 타입
interface UserJWTPayload extends JWTPayload {
  sub: string;
  tenantId: string;
  userid: string;
  username: string;
  role: string;
  roleId: string | null;
  department: string | null;
  permissions: {
    canApprove: boolean;
    canManageExpense: boolean;
    canAccessAdmin: boolean;
    canExportData: boolean;
    canRegisterUsers: boolean;
  };
}

/**
 * 사용자용 JWT 토큰 생성
 */
export async function createUserToken(user: UserSession): Promise<string> {
  const token = await new SignJWT({
    sub: user.id,
    tenantId: user.tenantId,
    userid: user.userid,
    username: user.username,
    role: user.role,
    roleId: user.roleId,
    department: user.department,
    permissions: {
      canApprove: user.canApprove,
      canManageExpense: user.canManageExpense,
      canAccessAdmin: user.canAccessAdmin,
      canExportData: user.canExportData,
      canRegisterUsers: user.canRegisterUsers,
    },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

/**
 * JWT 토큰 검증 및 파싱
 */
export async function verifyUserToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const typedPayload = payload as UserJWTPayload;

    return {
      id: typedPayload.sub!,
      tenantId: typedPayload.tenantId,
      userid: typedPayload.userid,
      username: typedPayload.username,
      role: typedPayload.role,
      roleId: typedPayload.roleId,
      department: typedPayload.department,
      canApprove: typedPayload.permissions.canApprove,
      canManageExpense: typedPayload.permissions.canManageExpense,
      canAccessAdmin: typedPayload.permissions.canAccessAdmin,
      canExportData: typedPayload.permissions.canExportData,
      canRegisterUsers: typedPayload.permissions.canRegisterUsers,
    };
  } catch {
    return null;
  }
}

/**
 * 요청에서 사용자 세션 가져오기
 */
export async function getUserFromRequest(request: NextRequest): Promise<UserSession | null> {
  // 1. Authorization 헤더에서 토큰 확인
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = await verifyUserToken(token);
    if (session) {
      // DB에서 활성 상태 확인
      const user = await prismaBase.user.findUnique({
        where: { id: session.id },
        select: { isActive: true, tenantId: true },
      });
      if (user?.isActive && user.tenantId === session.tenantId) {
        return session;
      }
    }
  }

  // 2. 쿠키에서 토큰 확인
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const session = await verifyUserToken(cookieToken);
    if (session) {
      // DB에서 활성 상태 확인
      const user = await prismaBase.user.findUnique({
        where: { id: session.id },
        select: { isActive: true, tenantId: true },
      });
      if (user?.isActive && user.tenantId === session.tenantId) {
        return session;
      }
    }
  }

  return null;
}

/**
 * 서버 컴포넌트(페이지)에서 쿠키 기반으로 현재 사용자 세션 조회
 * - NextRequest가 없는 RSC 환경에서 사용
 * - 로그인 시 설정한 user_token 쿠키를 검증한다
 */
export async function getCurrentUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifyUserToken(token);
  if (!session) return null;

  // DB에서 활성 상태 확인
  const user = await prismaBase.user.findUnique({
    where: { id: session.id },
    select: { isActive: true, tenantId: true },
  });
  if (user?.isActive && user.tenantId === session.tenantId) {
    return session;
  }

  return null;
}

/**
 * 사용자 인증이 필요한 API 래퍼
 * - 인증된 사용자만 접근 가능
 * - 자동으로 테넌트 컨텍스트 설정
 */
export type UserApiHandler = (
  request: NextRequest,
  context: {
    params: Promise<Record<string, string>>;
    user: UserSession;
  }
) => Promise<NextResponse>;

// Next.js 16 Route Handler 타입과 호환을 위한 RouteContext 타입
type RouteContext = { params: Promise<Record<string, string>> };

export function withAuth(handler: UserApiHandler) {
  return async (
    request: NextRequest,
    context: RouteContext
  ): Promise<NextResponse> => {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 요청 헤더에서 서브도메인/테넌트 파라미터 확인
    const subdomain = request.headers.get('x-tenant-subdomain');
    const tenantParam = request.headers.get('x-tenant-param');
    const requestedTenant = subdomain || tenantParam;

    // 서브도메인이 지정된 경우 사용자 테넌트와 일치하는지 검증
    if (requestedTenant) {
      const resolvedTenant = await findTenantBySubdomain(requestedTenant);

      if (!resolvedTenant) {
        return NextResponse.json(
          { error: '존재하지 않거나 비활성화된 조직입니다.' },
          { status: 404 }
        );
      }

      // 사용자의 테넌트와 요청된 테넌트 불일치 확인
      if (resolvedTenant.tenantId !== user.tenantId) {
        return NextResponse.json(
          { error: '이 조직에 대한 접근 권한이 없습니다.' },
          { status: 403 }
        );
      }
    }

    // 테넌트 컨텍스트 설정 후 핸들러 실행
    const tenantContext: TenantContext = {
      tenantId: user.tenantId,
      subdomain: requestedTenant || '',
    };

    return withTenantAsync(tenantContext, async () => {
      return handler(request, {
        params: context.params,
        user,
      });
    });
  };
}

/**
 * 특정 권한이 필요한 API 래퍼
 */
export type Permission = 'canApprove' | 'canManageExpense' | 'canAccessAdmin' | 'canExportData' | 'canRegisterUsers';

export function withPermission(permission: Permission, handler: UserApiHandler) {
  return withAuth(async (request, context) => {
    if (!context.user[permission]) {
      return NextResponse.json(
        { error: '이 작업을 수행할 권한이 없습니다.' },
        { status: 403 }
      );
    }
    return handler(request, context);
  });
}

/**
 * 관리자 권한이 필요한 API 래퍼
 */
export function withAdmin(handler: UserApiHandler) {
  return withPermission('canAccessAdmin', handler);
}

/**
 * 쿠키에 토큰 설정
 */
export function createUserTokenCookie(token: string): string {
  const maxAge = 24 * 60 * 60; // 24시간 (초)
  const secure = process.env.NODE_ENV === 'production';

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

/**
 * 쿠키에서 토큰 삭제
 */
export function createUserLogoutCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * 역할에서 권한 가져오기
 */
export async function getRolePermissions(roleId: string | null, roleCode: string): Promise<{
  canApprove: boolean;
  canManageExpense: boolean;
  canAccessAdmin: boolean;
  canExportData: boolean;
  canRegisterUsers: boolean;
}> {
  // roleId가 있으면 Role 테이블에서 권한 조회
  if (roleId) {
    const role = await prismaBase.role.findUnique({
      where: { id: roleId },
      select: {
        canApprove: true,
        canManageExpense: true,
        canAccessAdmin: true,
        canExportData: true,
        canRegisterUsers: true,
      },
    });
    if (role) {
      return role;
    }
  }

  // roleCode로 기본 권한 반환 (호환성)
  switch (roleCode) {
    case 'admin':
      return {
        canApprove: true,
        canManageExpense: true,
        canAccessAdmin: true,
        canExportData: true,
        canRegisterUsers: true,
      };
    case 'finance_head':
      return {
        canApprove: true,
        canManageExpense: true,
        canAccessAdmin: true,
        canExportData: true,
        canRegisterUsers: false,
      };
    case 'accountant':
      return {
        canApprove: true,
        canManageExpense: true,
        canAccessAdmin: false,
        canExportData: false,
        canRegisterUsers: false,
      };
    case 'team_leader':
      return {
        canApprove: true,
        canManageExpense: false,
        canAccessAdmin: false,
        canExportData: false,
        canRegisterUsers: false,
      };
    default:
      return {
        canApprove: false,
        canManageExpense: false,
        canAccessAdmin: false,
        canExportData: false,
        canRegisterUsers: false,
      };
  }
}
