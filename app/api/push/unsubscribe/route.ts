import { NextResponse } from 'next/server';
import { webPushProvider } from '@/lib/services/notification/web-push-provider';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * POST /api/push/unsubscribe
 * 푸시 알림 구독 해제
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const userId = user.id;

    // 요청 본문 파싱
    const body = await request.json();
    const { endpoint, all } = body;

    if (all) {
      // 모든 구독 해제
      const success = await webPushProvider.unsubscribeAll(userId);

      if (!success) {
        return NextResponse.json(
          { error: '구독 해제에 실패했습니다.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '모든 구독이 해제되었습니다.',
      });
    }

    if (!endpoint) {
      return NextResponse.json(
        { error: 'endpoint가 필요합니다.' },
        { status: 400 }
      );
    }

    // 특정 구독 해제
    const success = await webPushProvider.unsubscribe(userId, endpoint);

    if (!success) {
      return NextResponse.json(
        { error: '구독 해제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '구독이 해제되었습니다.',
    });
  } catch (error) {
    console.error('[Push Unsubscribe API] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

export const POST = withAuth(handlePost);
