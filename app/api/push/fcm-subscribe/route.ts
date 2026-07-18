import { NextResponse } from 'next/server';
import { fcmProvider } from '@/lib/services/notification/fcm-provider';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * POST /api/push/fcm-subscribe
 * FCM 토큰 등록 (Capacitor 모바일 앱에서 호출)
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const currentUser = user;

    const body = await request.json();
    const { token, platform, deviceModel, appVersion } = body;

    if (typeof token !== 'string' || token.length < 32) {
      return NextResponse.json(
        { error: '유효하지 않은 FCM 토큰입니다.' },
        { status: 400 }
      );
    }

    if (platform !== 'android' && platform !== 'ios') {
      return NextResponse.json(
        { error: 'platform은 "android" 또는 "ios" 여야 합니다.' },
        { status: 400 }
      );
    }

    // tenantId는 토큰 클레임에서만 취한다 (공통 원칙 2) — 등록 시 저장되어
    // 테넌트 토픽 구독과 발송 스코프의 기준이 된다 (B6)
    const result = await fcmProvider.subscribe(
      currentUser.id,
      currentUser.tenantId,
      token,
      platform,
      deviceModel,
      appVersion
    );

    if (!result) {
      return NextResponse.json(
        { error: 'FCM 토큰 등록에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tokenId: result.id,
    });
  } catch (error) {
    console.error('[FCM Subscribe API] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/push/fcm-subscribe
 * FCM 토큰 해제
 */
const handleDelete: UserApiHandler = async (request, { user }) => {
  try {
    const currentUser = user;

    const body = await request.json();
    const { token } = body;

    if (typeof token !== 'string') {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 400 }
      );
    }

    const success = await fcmProvider.unsubscribe(currentUser.id, token);
    return NextResponse.json({ success });
  } catch (error) {
    console.error('[FCM Unsubscribe API] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

export const POST = withAuth(handlePost);
export const DELETE = withAuth(handleDelete);
