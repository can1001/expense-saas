/**
 * USER_JWT_SECRET 해석 — 단일 출처
 *
 * AC7: 프로덕션에서 USER_JWT_SECRET 미설정 시 부팅 실패(하드코딩 폴백 제거).
 * 개발/테스트 환경에서는 기존 호환을 위해 폴백을 허용한다.
 *
 * lib/auth/user.ts(서명/검증)와 proxy.ts(엣지 검증)가 동일하게 이 함수를 사용해야
 * 서명과 검증 키가 일치한다.
 */

/** 개발/테스트 전용 폴백 키 (프로덕션에서는 절대 사용되지 않음) */
export const DEV_FALLBACK_USER_JWT_SECRET = 'user-secret-key-change-in-production';

/**
 * USER_JWT_SECRET 문자열을 반환.
 * @throws 프로덕션(NODE_ENV==='production')에서 미설정 시
 */
export function getUserJwtSecretString(
  env: { USER_JWT_SECRET?: string; NODE_ENV?: string } = process.env
): string {
  const secret = env.USER_JWT_SECRET;
  if (secret && secret.length > 0) return secret;

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'USER_JWT_SECRET 환경변수가 설정되지 않았습니다. ' +
        '프로덕션 환경에서는 반드시 강력한 비밀키를 설정하세요.'
    );
  }
  return DEV_FALLBACK_USER_JWT_SECRET;
}

/** 서명/검증용 Uint8Array 키 */
export function getUserJwtSecret(
  env?: { USER_JWT_SECRET?: string; NODE_ENV?: string }
): Uint8Array {
  return new TextEncoder().encode(getUserJwtSecretString(env));
}
