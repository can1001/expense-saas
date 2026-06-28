import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fcmProvider } from '@/lib/services/notification/fcm-provider';

/**
 * POST /api/push/fcm-test
 * 테스트 FCM 푸시 발송 (모바일 앱 디버깅용)
 */
export async function POST(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    if (!fcmProvider.isEnabled()) {
      return NextResponse.json(
        {
          error:
            'FIREBASE_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않아 FCM을 사용할 수 없습니다.',
        },
        { status: 503 }
      );
    }

    const results = await fcmProvider.sendToUser(
      currentUser.id,
      {
        title: '테스트 알림 (앱)',
        body: 'FCM을 통한 모바일 앱 푸시 알림이 정상 작동합니다!',
        url: '/expenses',
        tag: 'fcm-test',
      },
      'SUBMIT'
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    const noToken = results.some((r) => r.error === '활성 FCM 토큰 없음');
    if (noToken) {
      return NextResponse.json(
        {
          error: '등록된 FCM 토큰이 없습니다. 모바일 앱에서 먼저 알림을 등록해주세요.',
          code: 'NO_FCM_TOKEN',
        },
        { status: 404 }
      );
    }

    if (successCount === 0) {
      return NextResponse.json(
        {
          error: 'FCM 발송에 실패했습니다.',
          details: results.map((r) => r.error).filter(Boolean),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `FCM 테스트 알림이 발송되었습니다. (성공: ${successCount}, 실패: ${failCount})`,
      results,
    });
  } catch (error) {
    console.error('[FCM Test API] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
