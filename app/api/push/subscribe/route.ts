import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { webPushProvider } from '@/lib/services/notification/web-push-provider';

/**
 * POST /api/push/subscribe
 * 푸시 알림 구독 등록
 */
export async function POST(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie?.value) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const user = JSON.parse(userCookie.value);
    const userId = user.id;

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 401 }
      );
    }

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
}
