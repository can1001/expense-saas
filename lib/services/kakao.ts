/**
 * 카카오 인증 서비스 (ARC-003 §2, C2)
 *
 * 클라이언트가 보낸 카카오 토큰을 그대로 신뢰하지 않고, 반드시 서버에서
 * kapi.kakao.com으로 검증한다 (§2 핵심 규칙). 카카오 토큰은 "누구인지" 확인에만
 * 쓰고 세션으로 쓰지 않는다 — 검증 후에는 기존 구조 그대로 자체 JWT(user_token)를
 * 발급한다 (ARC-002 §3 토큰 스코프 유지).
 *
 * OIDC(id_token) 방식 (ARC-003 §5): KAKAO_USE_OIDC로 분기 지점만 마련해두고,
 * 초기 구현은 액세스 토큰 + kapi 방식만 지원한다.
 */

const KAPI_USER_ME_URL = 'https://kapi.kakao.com/v2/user/me';

/** 카카오 연동 미설정(환경변수 없음) — 라우트에서 503으로 매핑 */
export class KakaoConfigError extends Error {}

/** 카카오 토큰 검증 실패(만료·위조·응답 이상) — 라우트에서 401로 매핑 */
export class KakaoTokenError extends Error {}

/** KAKAO_REST_API_KEY 설정 여부 — .env 없이도 코드가 죽지 않게 호출측에서 분기 */
export function isKakaoConfigured(): boolean {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}

/** OIDC(id_token) 검증 방식 사용 여부 (ARC-003 §5) — 활성화 시 kapi 호출 1회 절감 */
export function isKakaoOidcEnabled(): boolean {
  return process.env.KAKAO_USE_OIDC === 'true';
}

/**
 * 카카오 액세스 토큰을 kapi에서 검증하고 카카오 회원번호를 반환한다.
 * 검증 실패 시 KakaoTokenError — 호출측은 자체 토큰을 발급하면 안 된다.
 */
export async function verifyKakaoAccessToken(
  kakaoAccessToken: string
): Promise<{ providerUserId: string }> {
  if (!isKakaoConfigured()) {
    throw new KakaoConfigError(
      '카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.'
    );
  }

  const response = await fetch(KAPI_USER_ME_URL, {
    headers: { Authorization: `Bearer ${kakaoAccessToken}` },
  });

  if (!response.ok) {
    throw new KakaoTokenError(
      '카카오 토큰 검증에 실패했습니다. 다시 로그인해주세요.'
    );
  }

  const profile = (await response.json()) as { id?: number | string | null };
  if (profile?.id === undefined || profile?.id === null) {
    throw new KakaoTokenError('카카오 회원 정보를 확인할 수 없습니다.');
  }

  // 카카오 회원번호는 숫자로 오지만 AuthAccount.providerUserId는 String — 문자열로 통일
  return { providerUserId: String(profile.id) };
}
