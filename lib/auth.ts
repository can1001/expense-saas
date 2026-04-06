import { cookies } from 'next/headers';
import { findUserById, toUserInfo, type UserInfo } from './users';
import { prisma } from './prisma';

const SESSION_COOKIE = 'session';

export async function createSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<UserInfo | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
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
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value || null;
}
