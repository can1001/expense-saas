/**
 * Invitation 서비스 (ARC-003 §4.2, C3)
 *
 * 초대 토큰이 본인 증명 — 카카오 이메일 매칭 같은 자동 병합 없이(공통 원칙 3),
 * 토큰 보유자를 초대된 테넌트에 합류시킨다.
 *
 * 초대 조회/수락은 로그인 전(테넌트 컨텍스트 없음) 경로이므로 prismaBase를 사용하고,
 * 어드민 생성/목록은 호출측이 JWT 클레임의 tenantId를 명시적으로 전달한다 (공통 원칙 2).
 */

import { randomBytes } from 'crypto';
import type { Invitation, Membership, Prisma, Tenant, User } from '@prisma/client';
import { prismaBase } from '@/lib/prisma';
import { hashPassword } from '@/lib/services/user-service';
import type { MembershipRole } from '@/lib/services/membership';

// 초대 유효기간 (일)
export const INVITATION_EXPIRES_DAYS = 7;

/** 초대 검증/수락 실패 — 라우트에서 HTTP status로 매핑한다 */
export class InvitationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'InvitationError';
    this.status = status;
  }
}

export type InvitationTenant = Pick<Tenant, 'id' | 'name' | 'subdomain' | 'isActive'>;

export type InvitationWithTenant = Invitation & { tenant: InvitationTenant };

/**
 * 초대 생성 — 토큰은 랜덤 32바이트 hex, 유효기간 7일.
 * tenantId는 반드시 JWT 클레임에서 온 값이어야 한다 (요청 바디 수신 금지).
 */
export async function createInvitation(params: {
  tenantId: string;
  email?: string;
  role?: MembershipRole;
  invitedById?: string;
}): Promise<Invitation> {
  return prismaBase.invitation.create({
    data: {
      tenantId: params.tenantId,
      email: params.email,
      role: params.role ?? 'MEMBER',
      token: randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
      invitedById: params.invitedById,
    },
  });
}

/** 테넌트의 초대 목록 — 최신순 */
export async function listInvitations(tenantId: string): Promise<Invitation[]> {
  return prismaBase.invitation.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * 초대 토큰 검증 — 미존재(404)/기수락(409)/만료(410)/비활성 테넌트(403)면 InvitationError.
 */
export async function getValidInvitation(token: string): Promise<InvitationWithTenant> {
  const invitation = await prismaBase.invitation.findUnique({
    where: { token },
    include: {
      tenant: { select: { id: true, name: true, subdomain: true, isActive: true } },
    },
  });

  if (!invitation) {
    throw new InvitationError('유효하지 않은 초대입니다.', 404);
  }
  if (invitation.acceptedAt) {
    throw new InvitationError('이미 사용된 초대입니다.', 409);
  }
  if (invitation.expiresAt < new Date()) {
    throw new InvitationError('만료된 초대입니다.', 410);
  }
  if (!invitation.tenant.isActive) {
    throw new InvitationError('이 조직은 현재 이용할 수 없습니다.', 403);
  }

  return invitation;
}

export type AcceptInvitationParams = {
  token: string;
  /** 카카오 연결이 이미 확인된 기존 유저 — 신규 생성 없이 Membership만 추가 */
  existingUserId?: string;
  /** 신규 유저 생성 정보 (기존 유저 수락 시 무시) */
  username?: string;
  userid?: string;
  password?: string;
  /** 서버측 kapi 검증을 통과한 카카오 회원번호 — 있으면 AuthAccount(kakao) 연결 */
  kakaoProviderUserId?: string;
};

export type AcceptInvitationResult = {
  user: User;
  membership: Membership;
  tenant: InvitationTenant;
};

/**
 * 초대 수락 — User(신규 시)·AuthAccount·Membership 생성과 초대 소진을
 * 단일 트랜잭션으로 처리한다 (부분 생성 없음).
 */
export async function acceptInvitation(
  params: AcceptInvitationParams
): Promise<AcceptInvitationResult> {
  const invitation = await getValidInvitation(params.token);

  // bcrypt 해시는 비용이 크므로 트랜잭션 밖에서 수행
  const hashedPassword = params.password ? await hashPassword(params.password) : null;

  return prismaBase.$transaction(async (tx: Prisma.TransactionClient) => {
    // 동시 수락 방지 — acceptedAt이 아직 null인 경우에만 선점 (실패 시 전체 롤백)
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new InvitationError('이미 사용된 초대입니다.', 409);
    }

    let user: User;

    if (params.existingUserId) {
      const existing = await tx.user.findUnique({ where: { id: params.existingUserId } });
      if (!existing) {
        throw new InvitationError('유효하지 않은 사용자입니다.', 404);
      }
      if (!existing.isActive) {
        throw new InvitationError('계정이 비활성화되어 있습니다. 관리자에게 문의하세요.', 403);
      }
      user = existing;

      // User.tenantId 이중 기록(B1) — 미소속 유저만 채우고 기존 값은 바꾸지 않는다
      if (!user.tenantId) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { tenantId: invitation.tenantId },
        });
      }
    } else {
      const username = params.username?.trim();
      if (!username) {
        throw new InvitationError('이름을 입력해주세요.', 400);
      }

      // 카카오 신규 가입은 userid 미입력 시 카카오 회원번호 기반으로 자동 생성
      const userid =
        params.userid?.trim() ||
        (params.kakaoProviderUserId ? `kakao_${params.kakaoProviderUserId}` : undefined);
      if (!userid) {
        throw new InvitationError('아이디를 입력해주세요.', 400);
      }

      const duplicated = await tx.user.findFirst({
        where: { tenantId: invitation.tenantId, userid },
      });
      if (duplicated) {
        throw new InvitationError('이미 존재하는 아이디입니다.', 409);
      }

      user = await tx.user.create({
        data: {
          tenantId: invitation.tenantId,
          userid,
          username,
          password: hashedPassword,
          role: 'user', // 초대 가입은 항상 일반 사용자 (테넌트 내 역할은 어드민이 별도 부여)
        },
      });

      // 아이디/비밀번호 가입은 provider "email"로 인증 경로 일원화 (C1)
      // (provider, providerUserId)는 전역 유니크 — 타 테넌트 동일 userid 충돌 시 거부
      if (hashedPassword) {
        const emailTaken = await tx.authAccount.findUnique({
          where: { provider_providerUserId: { provider: 'email', providerUserId: userid } },
        });
        if (emailTaken) {
          throw new InvitationError('이미 존재하는 아이디입니다.', 409);
        }
        await tx.authAccount.create({
          data: { userId: user.id, provider: 'email', providerUserId: userid },
        });
      }
    }

    // 카카오 연결 — 다른 유저에 연결된 회원번호는 거부 (계정 탈취 방지, ARC-003 §4)
    if (params.kakaoProviderUserId) {
      const linked = await tx.authAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: 'kakao',
            providerUserId: params.kakaoProviderUserId,
          },
        },
      });
      if (linked && linked.userId !== user.id) {
        throw new InvitationError('이미 다른 계정에 연결된 인증 수단입니다.', 409);
      }
      if (!linked) {
        await tx.authAccount.create({
          data: {
            userId: user.id,
            provider: 'kakao',
            providerUserId: params.kakaoProviderUserId,
          },
        });
      }
    }

    // Membership 생성 — 이미 소속이면 초대 수락이 성립하지 않는다
    const existingMembership = await tx.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: invitation.tenantId } },
    });
    if (existingMembership) {
      throw new InvitationError('이미 소속된 조직입니다.', 409);
    }

    // 첫 소속이면 기본 진입 조직으로 지정
    const membershipCount = await tx.membership.count({ where: { userId: user.id } });
    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        tenantId: invitation.tenantId,
        role: invitation.role,
        isDefault: membershipCount === 0,
      },
    });

    return { user, membership, tenant: invitation.tenant };
  });
}
