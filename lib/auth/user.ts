import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { TenantContext, withTenantAsync } from '@/lib/tenant-context';
import { findTenantBySubdomain } from '@/lib/tenant';
import { canAccessAdminMenuPathWithRoles } from '@/lib/constants/menu-permissions';
import { getUserJwtSecret } from '@/lib/auth/jwt-secret';
import {
  Permission as PermissionCode,
  PERMISSIONS,
  hasPermission as checkPermission,
  roleHasPermission,
} from '@/lib/auth/permissions';
import { getTenantRoleResolver } from '@/lib/auth/role-permission-cache';

// JWT 설정
// AC7: 프로덕션에서 USER_JWT_SECRET 미설정 시 부팅 실패(하드코딩 폴백 제거).
// 테스트 환경에서는 폴백 허용(모듈 import 시점에 throw 방지).
const JWT_SECRET = getUserJwtSecret();
const JWT_ISSUER = 'expense-saas';
const JWT_AUDIENCE = 'tenant-user';
const TOKEN_EXPIRY = '24h'; // 24시간
export const COOKIE_NAME = 'user_token';

// B2: 복수 소속 조직 선택용 임시 토큰 (ARC-002 §2.2)
// tenantId 클레임 없이 짧게 발급 — 정식 인증(verifyUserToken)에서는 거부되며
// switch-tenant(B3)의 조직 선택 단계에서만 쓴다.
const PENDING_SELECTION_TOKEN_EXPIRY = '10m';
export const PENDING_SELECTION_MAX_AGE_SECONDS = 10 * 60;

// 사용자 세션 타입
// roles: 유효 역할 코드 목록(단일이면 [role]). 권한은 roles+granted 로부터 파생.
// 5개 불리언 플래그는 하위호환용 파생 값(레거시 소비자/UI). 신규 코드는 hasPermission 사용.
export interface UserSession {
  id: string;
  tenantId: string;
  userid: string;
  username: string;
  role: string;
  roles: string[];
  roleId: string | null;
  department: string | null;
  /** 역할 외 개별 부여 권한 코드 (예: user:register) */
  granted: string[];
  canApprove: boolean;
  canManageExpense: boolean;
  canAccessAdmin: boolean;
  canExportData: boolean;
  canRegisterUsers: boolean;
}

// JWT Payload 타입 (roles-only: 권한을 굽지 않고 roles+granted 만 담는다)
interface UserJWTPayload extends JWTPayload {
  sub: string;
  tenantId: string;
  userid: string;
  username: string;
  role: string;
  roles?: string[];
  granted?: string[];
  roleId: string | null;
  department: string | null;
  // B2: 조직 선택용 임시 토큰 표식 — true면 정식 세션으로 인정하지 않는다
  pendingTenantSelection?: boolean;
  // 레거시 토큰 호환용(구 토큰만 존재). 신규 토큰은 굽지 않는다.
  permissions?: {
    canApprove: boolean;
    canManageExpense: boolean;
    canAccessAdmin: boolean;
    canExportData: boolean;
    canRegisterUsers: boolean;
  };
}

/**
 * 유효 역할 + 개별 부여 권한으로부터 레거시 불리언 플래그를 파생.
 * (플래그는 하위호환용 표시값 — 가드는 hasPermission 을 직접 사용)
 */
export function deriveLegacyFlags(roles: string[], granted: string[] = []) {
  const has = (p: PermissionCode) =>
    roleHasPermission(roles, p) || granted.includes(p);
  return {
    canApprove: has(PERMISSIONS.EXPENSE_APPROVE),
    canManageExpense: has(PERMISSIONS.EXPENSE_PAYMENT_MANAGE),
    canAccessAdmin: has(PERMISSIONS.ADMIN_DASHBOARD_READ),
    canExportData: has(PERMISSIONS.EXPENSE_EXPORT),
    canRegisterUsers: has(PERMISSIONS.USER_REGISTER),
  };
}

/**
 * 사용자용 JWT 토큰 생성
 */
export async function createUserToken(user: UserSession): Promise<string> {
  const roles = user.roles?.length ? user.roles : [user.role];
  // 개별 부여 권한: canRegisterUsers 가 역할로 설명되지 않으면 granted 로 보존
  const granted =
    user.granted && user.granted.length
      ? user.granted
      : user.canRegisterUsers && !roleHasPermission(roles, PERMISSIONS.USER_REGISTER)
        ? [PERMISSIONS.USER_REGISTER]
        : [];
  const token = await new SignJWT({
    sub: user.id,
    tenantId: user.tenantId,
    userid: user.userid,
    username: user.username,
    role: user.role,
    roles,
    granted,
    roleId: user.roleId,
    department: user.department,
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

    // B2: 선택용 임시 토큰(tenantId 미확정)은 정식 세션으로 인정하지 않는다
    if (typedPayload.pendingTenantSelection === true) {
      return null;
    }

    const roles =
      typedPayload.roles?.length ? typedPayload.roles : [typedPayload.role];
    const granted = typedPayload.granted ?? [];

    // 레거시 토큰(구 permissions 객체) 호환: 있으면 그대로, 없으면 roles 에서 파생
    const flags = typedPayload.permissions
      ? typedPayload.permissions
      : deriveLegacyFlags(roles, granted);

    return {
      id: typedPayload.sub!,
      tenantId: typedPayload.tenantId,
      userid: typedPayload.userid,
      username: typedPayload.username,
      role: typedPayload.role,
      roles,
      roleId: typedPayload.roleId,
      department: typedPayload.department,
      granted,
      canApprove: flags.canApprove,
      canManageExpense: flags.canManageExpense,
      canAccessAdmin: flags.canAccessAdmin,
      canExportData: flags.canExportData,
      canRegisterUsers: flags.canRegisterUsers,
    };
  } catch {
    return null;
  }
}

// 조직 선택 대기 세션 — 인증("누구인지")만 확정, 소속(tenantId)은 미확정 상태
export interface PendingSelectionSession {
  id: string;
  userid: string;
  username: string;
}

/**
 * 조직 선택용 임시 토큰 생성 (B2 — 복수 소속 로그인 시)
 * tenantId 클레임을 담지 않으며, 최종 토큰은 switch-tenant(B3)에서 발급한다.
 */
export async function createPendingSelectionToken(user: {
  id: string;
  userid: string;
  username: string;
}): Promise<string> {
  return new SignJWT({
    sub: user.id,
    userid: user.userid,
    username: user.username,
    pendingTenantSelection: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(PENDING_SELECTION_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * 조직 선택용 임시 토큰 검증 — 임시 토큰이 아니면(정식 토큰 포함) null
 */
export async function verifyPendingSelectionToken(
  token: string
): Promise<PendingSelectionSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const typedPayload = payload as UserJWTPayload;
    if (typedPayload.pendingTenantSelection !== true) {
      return null;
    }

    return {
      id: typedPayload.sub!,
      userid: typedPayload.userid,
      username: typedPayload.username,
    };
  } catch {
    return null;
  }
}

/**
 * 세션 사용자의 활성 상태·테넌트 유효성 확인 (getUserFromRequest/getCurrentUserSession 공용)
 * - 기본: User.tenantId와 토큰의 tenantId 일치 (기존 동작)
 * - B3 조직 전환: 불일치 시 Membership 소속으로 검증 — switch-tenant로 발급된 토큰의
 *   tenantId는 User.tenantId(백필 전 호환용으로 유지)와 다를 수 있다.
 *   Membership 조회 실패(테이블 미생성 등)는 기존과 동일하게 거부한다.
 *
 * 테넌트가 비활성화되면 홈·게스트 어느 경로든 해당 테넌트로 스코프된 기존 토큰을 즉시 무효화한다
 * (getMemberships·로그인 가드와 동일 기준). 단 소속 테넌트가 없는 사용자(User.tenantId=null,
 * 무소속 홈)는 비활성 판정 대상이 아니므로 그대로 통과시킨다.
 */
async function isValidSessionUser(session: UserSession): Promise<boolean> {
  const user = await prismaBase.user.findUnique({
    where: { id: session.id },
    select: {
      isActive: true,
      tenantId: true,
      tenant: { select: { isActive: true } },
    },
  });
  if (!user?.isActive) return false;
  if (user.tenantId === session.tenantId) {
    // 홈 테넌트도 비활성화면 즉시 무효 (무소속 홈은 tenant가 null이므로 통과)
    return user.tenant?.isActive ?? true;
  }

  try {
    const membership = await prismaBase.membership.findFirst({
      where: {
        userId: session.id,
        tenantId: session.tenantId,
        tenant: { isActive: true },
      },
      select: { id: true },
    });
    return membership !== null;
  } catch {
    return false;
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
    if (session && (await isValidSessionUser(session))) {
      return session;
    }
  }

  // 2. 쿠키에서 토큰 확인
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const session = await verifyUserToken(cookieToken);
    if (session && (await isValidSessionUser(session))) {
      return session;
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

  if (await isValidSessionUser(session)) {
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

      // 요청 서브도메인과 토큰의 tenantId가 다른 경우:
      // 조직 전환(B3) 세션은 토큰이 tenantId의 유일한 출처이며(공통 원칙 2), 브라우저는
      // 이전 테넌트 서브도메인에 그대로 머물 수 있다. 토큰 tenantId에 대한 활성 소속이
      // 확인되면(정당한 전환) 토큰을 신뢰해 진행하고, 그 외에는 기존처럼 거부한다.
      // (핸들러 컨텍스트는 아래에서 항상 user.tenantId(토큰)로 설정되므로 데이터는 토큰 테넌트로 스코프된다.)
      if (resolvedTenant.tenantId !== user.tenantId) {
        const switchedMembership = await prismaBase.membership.findFirst({
          where: {
            userId: user.id,
            tenantId: user.tenantId,
            tenant: { isActive: true },
          },
          select: { id: true },
        });

        if (!switchedMembership) {
          return NextResponse.json(
            { error: '이 조직에 대한 접근 권한이 없습니다.' },
            { status: 403 }
          );
        }
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
 * 세션에서 effective 역할 코드 목록 추출.
 * (현재 세션은 단일 role. 향후 UserYearRole 다중역할을 세션에 담으면 여기서 합산)
 */
export function getEffectiveRoleCodes(user: UserSession): string[] {
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles;
  return [user.role];
}

/**
 * permission 코드 기반 API 래퍼 (AC2: 단일 인가 경로 hasPermission).
 * 세션 역할 → 테넌트별 DB 캐시 resolver(Role.permissions)로 effective permission 해석 후 판정.
 * AC3: Role.permissions 변경이 재로그인 없이 캐시 TTL 내(무효화 즉시) 반영된다.
 */
export function withPermissions(permission: PermissionCode, handler: UserApiHandler) {
  return withAuth(async (request, context) => {
    const roles = getEffectiveRoleCodes(context.user);
    const resolver = await getTenantRoleResolver(context.user.tenantId);
    if (!checkPermission({ roles }, permission, resolver)) {
      return NextResponse.json(
        { error: '이 작업을 수행할 권한이 없습니다.' },
        { status: 403 }
      );
    }
    return handler(request, context);
  });
}

/**
 * 특정 관리자 메뉴 경로 접근 권한이 필요한 API 래퍼
 * - 클라이언트 메뉴 가드와 동일한 기준(permission 파생)으로 인가한다.
 *
 * @param menuPath ROLE_ADMIN_MENU_PATHS 기준 페이지 경로 (예: '/admin', '/admin/budget-execution')
 */
export function withAdminMenu(menuPath: string, handler: UserApiHandler) {
  return withAuth(async (request, context) => {
    if (!canAccessAdminMenuPathWithRoles([context.user.role], menuPath)) {
      return NextResponse.json(
        { error: '이 작업을 수행할 권한이 없습니다.' },
        { status: 403 }
      );
    }
    return handler(request, context);
  });
}

/**
 * 쿠키에 토큰 설정
 */
export function createUserTokenCookie(
  token: string,
  maxAgeSeconds: number = 24 * 60 * 60 // 기본 24시간 (초)
): string {
  const maxAge = maxAgeSeconds;
  const secure = process.env.NODE_ENV === 'production';

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

/**
 * 쿠키에서 토큰 삭제
 */
export function createUserLogoutCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

