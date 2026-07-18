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
