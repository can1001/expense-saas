import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import {
  isKakaoConfigured,
  KakaoConfigError,
  KakaoTokenError,
  verifyKakaoAccessToken,
} from '@/lib/services/kakao';
import {
  AuthAccountNotLinkedError,
  getAuthAccount,
  LastAuthMethodError,
  linkAuthAccount,
  unlinkAuthAccount,
} from '@/lib/services/auth-account';
import { z } from 'zod';

const linkKakaoSchema = z.object({
  kakaoAccessToken: z.string().min(1, '카카오 토큰을 입력하세요'),
});

// GET /api/auth/link-kakao - 카카오 연결 상태 조회 (C4 화면용)
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const account = await getAuthAccount(user.id, 'kakao');

    return NextResponse.json({
      success: true,
      linked: Boolean(account),
      configured: isKakaoConfigured(),
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
};

// POST /api/auth/link-kakao - 기존 가입자의 카카오 계정 연결 (ARC-003 §4.2, C4)
// 로그인 세션이 본인 증명 — 카카오 토큰은 서버측 kapi 검증에만 쓰고 세션으로 쓰지 않는다.
// 이메일 매칭 자동 병합 없음: 연결 대상은 항상 현재 세션의 유저다 (공통 원칙 3).
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    // 환경변수 미설정 시에도 코드가 죽지 않게 즉시 503 (한국어 안내)
    if (!isKakaoConfigured()) {
      return NextResponse.json(
        { error: '카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { kakaoAccessToken } = linkKakaoSchema.parse(body);

    // 서버측 카카오 토큰 검증 — 클라이언트가 보낸 토큰을 그대로 신뢰하지 않는다
    let providerUserId: string;
    try {
      ({ providerUserId } = await verifyKakaoAccessToken(kakaoAccessToken));
    } catch (error) {
      if (error instanceof KakaoConfigError) {
        return NextResponse.json({ error: error.message }, { status: 503 });
      }
      if (error instanceof KakaoTokenError) {
        // 검증 실패(만료·위조) — 연결 미수행
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      throw error;
    }

    // 세션 유저에 연결 — 이미 다른 유저에 연결된 카카오 계정이면 거부 (계정 탈취 방지)
    try {
      await linkAuthAccount(user.id, 'kakao', providerUserId);
    } catch (error) {
      if (error instanceof Error && error.message === '이미 다른 계정에 연결된 인증 수단입니다.') {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      linked: true,
      message: '카카오 계정이 연결되었습니다.',
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '카카오 토큰을 입력해주세요.' },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
};

// DELETE /api/auth/link-kakao - 카카오 연결 해제 (마지막 로그인 수단이면 거부)
const handleDelete: UserApiHandler = async (request, { user }) => {
  try {
    try {
      await unlinkAuthAccount(user.id, 'kakao');
    } catch (error) {
      if (error instanceof AuthAccountNotLinkedError) {
        return NextResponse.json(
          { error: '연결된 카카오 계정이 없습니다.' },
          { status: 404 }
        );
      }
      if (error instanceof LastAuthMethodError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      linked: false,
      message: '카카오 계정 연결이 해제되었습니다.',
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
};

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const DELETE = withAuth(handleDelete);
