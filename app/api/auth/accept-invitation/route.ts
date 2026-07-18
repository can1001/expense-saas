import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import {
  createUserToken,
  createUserTokenCookie,
  deriveLegacyFlags,
  UserSession,
} from '@/lib/auth/user';
import {
  isKakaoConfigured,
  KakaoConfigError,
  KakaoTokenError,
  verifyKakaoAccessToken,
} from '@/lib/services/kakao';
import { findUserByProvider } from '@/lib/services/auth-account';
import {
  acceptInvitation,
  AcceptInvitationResult,
  InvitationError,
} from '@/lib/services/invitation';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { z } from 'zod';

const acceptInvitationSchema = z.object({
  inviteToken: z.string().min(1, '초대 토큰을 입력해주세요.'),
  kakaoAccessToken: z.string().optional(),
  userid: z.string().optional(),
  password: z.string().optional(),
  username: z.string().optional(),
});

// POST /api/auth/accept-invitation - 초대 수락 (ARC-003 §4.2, C3)
// 초대 토큰이 본인 증명 — 검증(만료·기수락) 후 User/AuthAccount/Membership을
// 트랜잭션으로 생성하고 자체 JWT를 발급한다. 카카오 토큰은 kapi 검증에만 쓴다 (C2와 동일).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inviteToken, kakaoAccessToken, userid, password, username } =
      acceptInvitationSchema.parse(body);

    let result: AcceptInvitationResult;

    if (kakaoAccessToken) {
      // 카카오 경로 — 서버측 토큰 검증 (클라이언트가 보낸 토큰을 그대로 신뢰하지 않는다)
      if (!isKakaoConfigured()) {
        return NextResponse.json(
          { error: '카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.' },
          { status: 503 }
        );
      }

      let providerUserId: string;
      try {
        ({ providerUserId } = await verifyKakaoAccessToken(kakaoAccessToken));
      } catch (error) {
        if (error instanceof KakaoConfigError) {
          return NextResponse.json({ error: error.message }, { status: 503 });
        }
        if (error instanceof KakaoTokenError) {
          // 검증 실패(만료·위조) — 초대 소진·계정 생성·토큰 발급 없음
          return NextResponse.json({ error: error.message }, { status: 401 });
        }
        throw error;
      }

      // 기존 카카오 연결 유저면 Membership만 추가, 아니면 신규 User + AuthAccount(kakao)
      // (이메일 매칭 자동 병합 없음 — 초대 토큰만이 본인 증명, 공통 원칙 3)
      const existingUser = await findUserByProvider('kakao', providerUserId);

      result = await acceptInvitation({
        token: inviteToken,
        existingUserId: existingUser?.id,
        username,
        userid,
        kakaoProviderUserId: providerUserId,
      });
    } else {
      // 일반 가입 경로 — signup과 동일한 필수 필드 검증
      if (!userid?.trim()) {
        return NextResponse.json({ error: '아이디를 입력해주세요.' }, { status: 400 });
      }
      if (!username?.trim()) {
        return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
      }
      if (!password) {
        return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
      }
      if (password.length < 4) {
        return NextResponse.json(
          { error: '비밀번호는 4자 이상이어야 합니다.' },
          { status: 400 }
        );
      }

      result = await acceptInvitation({
        token: inviteToken,
        userid: userid.trim(),
        username: username.trim(),
        password,
      });
    }

    const { user, membership, tenant } = result;

    // 자체 JWT 발급 — 수락한 테넌트로 즉시 로그인 (tenantId는 토큰 안에만, 공통 원칙 2)
    const roles = [user.role];
    const granted = user.canRegisterUsers ? [PERMISSIONS.USER_REGISTER] : [];
    const flags = deriveLegacyFlags(roles, granted);

    const session: UserSession = {
      id: user.id,
      tenantId: membership.tenantId,
      userid: user.userid,
      username: user.username,
      role: user.role,
      roles,
      roleId: user.roleId,
      department: user.department,
      granted,
      ...flags,
    };

    const token = await createUserToken(session);

    const response = NextResponse.json(
      {
        success: true,
        message: '초대를 수락했습니다.',
        user: {
          id: user.id,
          userid: user.userid,
          username: user.username,
          role: user.role,
          department: user.department,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
        },
        token,
      },
      { status: 201 }
    );

    response.headers.set('Set-Cookie', createUserTokenCookie(token));

    return response;
  } catch (error: unknown) {
    if (error instanceof InvitationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '초대 토큰을 입력해주세요.' },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}
