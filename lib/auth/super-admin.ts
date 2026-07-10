import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

// JWT 설정
const getJwtSecret = () => {
  const secret = process.env.SUPER_ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error(
      'SUPER_ADMIN_JWT_SECRET 환경변수가 설정되지 않았습니다. ' +
      '프로덕션 환경에서는 반드시 강력한 비밀키를 설정하세요.'
    );
  }
  return new TextEncoder().encode(secret);
};

// 런타임에 JWT_SECRET을 가져오는 함수 (테스트 환경에서는 더미 값 허용)
const JWT_SECRET = process.env.NODE_ENV === 'test'
  ? new TextEncoder().encode('test-secret-key-for-testing-only')
  : getJwtSecret();
const JWT_ISSUER = 'expense-saas-platform';
const JWT_AUDIENCE = 'super-admin';
const TOKEN_EXPIRY = '8h'; // 8시간
const COOKIE_NAME = 'super_admin_token';

// SuperAdmin 세션 타입
export interface SuperAdminSession {
  id: string;
  email: string;
  name: string;
}

// JWT Payload 타입
interface SuperAdminJWTPayload extends JWTPayload {
  sub: string;
  email: string;
  name: string;
}

/**
 * SuperAdmin용 JWT 토큰 생성
 */
export async function createSuperAdminToken(admin: SuperAdminSession): Promise<string> {
  const token = await new SignJWT({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
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
export async function verifySuperAdminToken(token: string): Promise<SuperAdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const typedPayload = payload as SuperAdminJWTPayload;

    return {
      id: typedPayload.sub!,
      email: typedPayload.email,
      name: typedPayload.name,
    };
  } catch {
    return null;
  }
}

/**
 * 요청에서 SuperAdmin 세션 가져오기
 */
export async function getSuperAdminFromRequest(request: NextRequest): Promise<SuperAdminSession | null> {
  // 1. Authorization 헤더에서 토큰 확인
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = await verifySuperAdminToken(token);
    if (session) {
      // DB에서 활성 상태 확인
      const admin = await prismaBase.superAdmin.findUnique({
        where: { id: session.id },
        select: { isActive: true },
      });
      if (admin?.isActive) {
        return session;
      }
    }
  }

  // 2. 쿠키에서 토큰 확인
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const session = await verifySuperAdminToken(cookieToken);
    if (session) {
      // DB에서 활성 상태 확인
      const admin = await prismaBase.superAdmin.findUnique({
        where: { id: session.id },
        select: { isActive: true },
      });
      if (admin?.isActive) {
        return session;
      }
    }
  }

  return null;
}

/**
 * SuperAdmin 인증이 필요한 API 래퍼
 */
export type SuperAdminApiHandler = (
  request: NextRequest,
  context: {
    params: Promise<Record<string, string>>;
    superAdmin: SuperAdminSession;
  }
) => Promise<NextResponse>;

// Next.js 16 Route Handler 타입과 호환을 위한 RouteContext 타입
type RouteContext = { params: Promise<Record<string, string>> };

export function withSuperAdmin(handler: SuperAdminApiHandler) {
  return async (
    request: NextRequest,
    context: RouteContext
  ): Promise<NextResponse> => {
    const superAdmin = await getSuperAdminFromRequest(request);

    if (!superAdmin) {
      return NextResponse.json(
        { error: '인증이 필요합니다. 플랫폼 관리자로 로그인하세요.' },
        { status: 401 }
      );
    }

    return handler(request, {
      params: context.params,
      superAdmin,
    });
  };
}

/**
 * 쿠키에 토큰 설정
 */
export function createTokenCookie(token: string): string {
  const maxAge = 8 * 60 * 60; // 8시간 (초)
  const secure = process.env.NODE_ENV === 'production';

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

/**
 * 쿠키에서 토큰 삭제
 */
export function createLogoutCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
