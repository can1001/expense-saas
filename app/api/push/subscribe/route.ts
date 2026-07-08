import { NextResponse } from 'next/server';
import { webPushProvider } from '@/lib/services/notification/web-push-provider';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * POST /api/push/subscribe
 * 푸시 알림 구독 등록
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const userId = user.id;

    // 요청 본문 파싱
    const body = await request.json();
    const { subscription, deviceName } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: '유효하지 않은 구독 정보입니다.' },
        { status: 400 }
      );
    }

    // User-Agent 추출
    const userAgent = request.headers.get('user-agent') || undefined;

    // 구독 등록
    const result = await webPushProvider.subscribe(
      userId,
      subscription,
      userAgent,
      deviceName
    );

    if (!result) {
      return NextResponse.json(
        { error: '구독 등록에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscriptionId: result.id,
    });
  } catch (error) {
    console.error('[Push Subscribe API] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

export const POST = withAuth(handlePost);
