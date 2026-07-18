/**
 * AuthAccount 서비스 (ARC-003 §3, C1)
 *
 * 인증("누구인지")과 소속(Membership)의 분리 — AuthAccount는 인증 수단 연결만 담당한다.
 * 인증 조회는 테넌트를 가로지르므로 테넌트 필터링이 없는 prismaBase를 사용한다.
 *
 * 원칙 (공통 원칙 3): 카카오 이메일 기반 자동 병합 금지 — 연결은
 * 본인 증명(로그인 세션 또는 초대 토큰)이 있는 경로에서만 linkAuthAccount로 수행한다.
 */

import type { AuthAccount, User } from '@prisma/client';
import { prismaBase } from '@/lib/prisma';

// AuthAccount.provider 값 — 현재 email/kakao만 사용, naver/google은 확장 예약
export const AUTH_PROVIDERS = ['email', 'kakao', 'naver', 'google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/** 해제 대상 연결이 없음 — 라우트에서 404로 매핑 */
export class AuthAccountNotLinkedError extends Error {}

/** 마지막 로그인 수단 해제 시도 — 라우트에서 400으로 매핑 (ARC-003 §4.2, C4) */
export class LastAuthMethodError extends Error {}

/**
 * (provider, providerUserId)로 연결된 유저 조회 — 연결이 없으면 null.
 * 소셜 로그인 시 "누구인지"만 판별하고, 소속 결정은 호출측(Membership)이 담당한다.
 */
export async function findUserByProvider(
  provider: AuthProvider,
  providerUserId: string
): Promise<User | null> {
  const account = await prismaBase.authAccount.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
    include: { user: true },
  });

  return account?.user ?? null;
}

/**
 * 유저에 인증 수단 연결 — 이미 같은 유저에 연결돼 있으면 기존 연결 반환(멱등),
 * 다른 유저에 연결돼 있으면 한국어 에러로 거부한다 (계정 탈취 방지 — ARC-003 §4).
 */
export async function linkAuthAccount(
  userId: string,
  provider: AuthProvider,
  providerUserId: string
): Promise<AuthAccount> {
  const existing = await prismaBase.authAccount.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
  });

  if (existing) {
    if (existing.userId !== userId) {
      throw new Error('이미 다른 계정에 연결된 인증 수단입니다.');
    }
    return existing;
  }

  return prismaBase.authAccount.create({
    data: { userId, provider, providerUserId },
  });
}

/** 유저의 특정 provider 연결 조회 — 연결 상태 표시(C4 화면)와 해제 검증에 사용 */
export async function getAuthAccount(
  userId: string,
  provider: AuthProvider
): Promise<AuthAccount | null> {
  return prismaBase.authAccount.findFirst({
    where: { userId, provider },
  });
}

/**
 * 인증 수단 연결 해제 — 마지막 로그인 수단이면 거부한다 (ARC-003 §4.2, C4).
 * "마지막 수단" 판정: 비밀번호(이메일 로그인)도 없고 다른 provider 연결도 없는 경우.
 */
export async function unlinkAuthAccount(
  userId: string,
  provider: AuthProvider
): Promise<void> {
  const account = await getAuthAccount(userId, provider);
  if (!account) {
    throw new AuthAccountNotLinkedError('연결된 인증 수단이 없습니다.');
  }

  const user = await prismaBase.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
  const otherProviderCount = await prismaBase.authAccount.count({
    where: { userId, provider: { not: provider } },
  });

  if (!user?.password && otherProviderCount === 0) {
    throw new LastAuthMethodError(
      '마지막 로그인 수단은 해제할 수 없습니다. 비밀번호를 먼저 설정해주세요.'
    );
  }

  await prismaBase.authAccount.delete({ where: { id: account.id } });
}
