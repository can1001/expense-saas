import { NextResponse } from 'next/server';
import { webPushProvider } from '@/lib/services/notification/web-push-provider';

/**
 * GET /api/push/vapid-public-key
 * VAPID 공개키 반환 (클라이언트 구독 시 사용)
 */
export async function GET() {
  const publicKey = webPushProvider.getPublicKey();

  if (!publicKey) {
    return NextResponse.json(
      { error: 'VAPID 키가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ publicKey });
}
