/**
 * 로그인 Rate Limiting 유틸리티
 * 무차별 대입 공격 방지를 위한 IP 기반 로그인 시도 제한
 */

// 설정
const MAX_ATTEMPTS = 5; // 최대 시도 횟수
const WINDOW_MS = 15 * 60 * 1000; // 15분 윈도우
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15분 차단

interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs?: number;
}

// In-memory store (프로덕션에서는 Redis 사용 권장)
const loginAttempts = new Map<string, LoginAttempt>();

// 테스트용 리셋 함수
export function resetRateLimitStore(): void {
  loginAttempts.clear();
}

/**
 * 로그인 Rate Limit 확인
 * @param ip 클라이언트 IP 주소
 * @returns Rate limit 결과 (허용 여부, 남은 시도 횟수, 재시도 대기 시간)
 */
export function checkLoginRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  // 첫 시도인 경우
  if (!attempt) {
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
    };
  }

  // 차단 중인 경우
  if (attempt.blockedUntil && attempt.blockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: attempt.blockedUntil - now,
    };
  }

  // 차단이 해제된 경우 - 기록 초기화
  if (attempt.blockedUntil && attempt.blockedUntil <= now) {
    loginAttempts.delete(ip);
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
    };
  }

  // 윈도우가 만료된 경우 - 기록 초기화
  if (now - attempt.firstAttemptAt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS,
    };
  }

  // 윈도우 내 시도 횟수 확인
  const remainingAttempts = Math.max(0, MAX_ATTEMPTS - attempt.count);

  return {
    allowed: remainingAttempts > 0,
    remainingAttempts,
    retryAfterMs: remainingAttempts === 0 ? BLOCK_DURATION_MS : undefined,
  };
}

/**
 * 로그인 실패 기록
 * @param ip 클라이언트 IP 주소
 */
export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt || now - attempt.firstAttemptAt > WINDOW_MS) {
    // 새로운 윈도우 시작
    loginAttempts.set(ip, {
      count: 1,
      firstAttemptAt: now,
    });
    return;
  }

  // 기존 윈도우에 추가
  attempt.count += 1;

  // 최대 시도 횟수 초과 시 차단
  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.blockedUntil = now + BLOCK_DURATION_MS;
  }

  loginAttempts.set(ip, attempt);
}

/**
 * 로그인 성공 시 시도 기록 초기화
 * @param ip 클라이언트 IP 주소
 */
export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * 요청에서 클라이언트 IP 추출
 * @param request Request 객체
 * @returns 클라이언트 IP 주소
 */
export function getClientIp(request: Request): string {
  // 프록시/로드밸런서 환경에서의 실제 IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // 첫 번째 IP가 실제 클라이언트 IP
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // 직접 연결인 경우 (개발 환경)
  return '127.0.0.1';
}
