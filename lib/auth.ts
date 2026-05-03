import { cookies } from 'next/headers';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { findUserById, toUserInfo, type UserInfo } from './users';
import { prisma } from './prisma';

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일

// 세션 서명용 비밀키
function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET 환경변수가 프로덕션에서 필수입니다.');
    }
    // 개발 환경에서만 기본값 사용
    console.warn('경고: 기본 세션 시크릿 사용 중. 프로덕션에서는 SESSION_SECRET 설정 필요.');
    return new TextEncoder().encode('dev-only-secret-do-not-use-in-production');
  }
  return new TextEncoder().encode(secret);
}

interface SessionPayload extends JWTPayload {
  userId: string;
}

/**
 * JWT 서명된 세션 토큰 생성
 */
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // CSRF 방지 강화
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * 세션 토큰에서 userId 추출 (서명 검증 포함)
 */
async function verifySession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const sessionPayload = payload as SessionPayload;
    return sessionPayload.userId || null;
  } catch {
    // 서명 검증 실패 또는 만료된 토큰
    return null;
  }
}

export async function getCurrentUser(): Promise<UserInfo | null> {
  const userId = await verifySession();
  if (!userId) return null;

  const user = await findUserById(userId);
  if (!user) return null;

  // 현재 연도의 YearRole 확인 (가장 높은 권한 역할 선택)
  const currentYear = new Date().getFullYear();
  const yearRole = await prisma.userYearRole.findFirst({
    where: { userId, year: currentYear },
    orderBy: { role: 'asc' },
  });

  const userInfo = toUserInfo(user);

  // YearRole이 있으면 해당 역할 사용, 없으면 User.role 사용
  return {
    ...userInfo,
    role: yearRole?.role ?? userInfo.role,
  };
}

export async function getSessionUserId(): Promise<string | null> {
  return verifySession();
}
