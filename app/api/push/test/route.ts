import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { webPushProvider } from '@/lib/services/notification/web-push-provider';

/**
 * POST /api/push/test
 * 테스트 푸시 알림 발송
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

    // 웹 푸시 활성화 확인
    if (!webPushProvider.isEnabled()) {
      return NextResponse.json(
        { error: 'VAPID 키가 설정되지 않아 푸시 알림을 사용할 수 없습니다.' },
        { status: 503 }
      );
    }

    // 테스트 푸시 발송
    const results = await webPushProvider.sendToUser(
      userId,
      {
        title: '테스트 알림',
        body: '지출결의서 웹 푸시 알림이 정상적으로 작동합니다!',
        icon: '/logo.png',
        tag: 'test-notification',
        url: '/expenses',
        actions: [
          { action: 'open', title: '열기' },
          { action: 'close', title: '닫기' },
        ],
      },
      'SUBMIT' // 테스트용 이벤트 타입
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (successCount === 0) {
      return NextResponse.json(
        {
          error: '푸시 알림 발송에 실패했습니다.',
          details: results.map((r) => r.error).filter(Boolean),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `테스트 푸시 알림이 발송되었습니다. (성공: ${successCount}, 실패: ${failCount})`,
      results,
    });
  } catch (error) {
    console.error('[Push Test API] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
