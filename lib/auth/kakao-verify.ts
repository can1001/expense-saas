/**
 * 카카오 토큰 검증 + 표준 에러 응답 매핑 (kakao 로그인·초대수락·계정연결 공용)
 *
 * kapi 검증 실패를 HTTP 상태로 매핑하는 로직이 라우트마다 복제되면 한쪽만 바뀌어
 * (예: 새 실패 유형 추가) 같은 카카오 실패가 라우트마다 다른 상태코드를 내는 drift가 생긴다.
 * 검증 + 매핑을 이 헬퍼로 단일화한다.
 */

import { NextResponse } from 'next/server';
import {
  KakaoConfigError,
  KakaoTokenError,
  verifyKakaoAccessToken,
} from '@/lib/services/kakao';

export type KakaoVerifyResult =
  | { providerUserId: string; error?: undefined }
  | { providerUserId?: undefined; error: NextResponse };

/**
 * 카카오 액세스 토큰을 kapi에서 검증한다.
 * - 성공: `{ providerUserId }`
 * - 미설정(KakaoConfigError): `{ error: 503 }`
 * - 검증 실패(KakaoTokenError, 만료·위조): `{ error: 401 }`
 * 그 외 예외는 상위 핸들러가 처리하도록 그대로 throw한다.
 */
export async function verifyKakaoTokenOrError(
  kakaoAccessToken: string
): Promise<KakaoVerifyResult> {
  try {
    const { providerUserId } = await verifyKakaoAccessToken(kakaoAccessToken);
    return { providerUserId };
  } catch (error) {
    if (error instanceof KakaoConfigError) {
      return { error: NextResponse.json({ error: error.message }, { status: 503 }) };
    }
    if (error instanceof KakaoTokenError) {
      return { error: NextResponse.json({ error: error.message }, { status: 401 }) };
    }
    throw error;
  }
}
