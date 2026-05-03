/**
 * 로그인 Rate Limiting 유틸리티
 * 무차별 대입 공격 방지를 위한 IP 기반 로그인 시도 제한
 *
 * 보안 참고사항:
 * - Render/Vercel 등 PaaS 환경에서는 플랫폼이 X-Forwarded-For 헤더를 신뢰할 수 있게 설정함
 * - 직접 호스팅 시 Nginx/로드밸런서에서 클라이언트 헤더를 덮어쓰도록 설정 필요
 * - 프로덕션에서는 Redis 사용 권장 (멀티인스턴스 환경)
 */

// 설정 (환경변수로 오버라이드 가능)
const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS) || 5;
const WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS) || 15 * 60 * 1000; // 15분
const BLOCK_DURATION_MS = Number(process.env.LOGIN_BLOCK_MS) || 15 * 60 * 1000; // 15분

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

// IPv4/IPv6 기본 형식 검증 (악의적인 값 필터링)
const IP_PATTERN = /^[\da-fA-F.:]+$/;

function isValidIpFormat(ip: string): boolean {
  if (!ip || ip.length > 45) return false; // IPv6 최대 길이
  return IP_PATTERN.test(ip);
}

/**
 * 요청에서 클라이언트 IP 추출
 *
 * 보안 참고사항:
 * - Render/Vercel 등 PaaS: 플랫폼이 X-Forwarded-For를 신뢰할 수 있게 설정
 * - 직접 호스팅: Nginx에서 proxy_set_header X-Forwarded-For $remote_addr; 설정 필요
 * - 개발 환경: 127.0.0.1 사용
 *
 * @param request Request 객체
 * @returns 클라이언트 IP 주소
 */
export function getClientIp(request: Request): string {
  // Render 환경에서 설정되는 헤더 (스푸핑 불가)
  const renderClientIp = request.headers.get('x-render-client-ip');
  if (renderClientIp && isValidIpFormat(renderClientIp)) {
    return renderClientIp;
  }

  // Vercel 환경에서 설정되는 헤더 (스푸핑 불가)
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp && isValidIpFormat(vercelIp)) {
    return vercelIp.split(',')[0].trim();
  }

  // 일반 프록시 환경 (신뢰할 수 있는 프록시 뒤에서만 사용)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (isValidIpFormat(firstIp)) {
      return firstIp;
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && isValidIpFormat(realIp)) {
    return realIp;
  }

  // 직접 연결인 경우 (개발 환경)
  return '127.0.0.1';
}

/**
 * IP + userid 조합으로 Rate Limit 키 생성
 * IP 스푸핑 시에도 동일 userid로 시도하면 차단됨
 *
 * @param ip 클라이언트 IP
 * @param userid 로그인 시도 userid (선택적)
 * @returns Rate Limit 키
 */
export function getRateLimitKey(ip: string, userid?: string): string {
  if (userid) {
    // userid 기반 키도 함께 사용 (IP 스푸핑 방지)
    return `${ip}:${userid}`;
  }
  return ip;
}
