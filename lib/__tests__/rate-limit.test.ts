/**
 * Rate Limiting 유틸리티 테스트
 *
 * 테스트 대상:
 * - 첫 번째 시도는 허용
 * - 5회 실패 후 6번째 시도 → 429 에러
 * - 다른 IP는 영향 없음
 * - 로그인 성공 시 카운터 초기화
 * - Retry-After 정보 포함 확인
 * - getClientIp 함수 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginAttempts,
  resetRateLimitStore,
  getClientIp,
} from '../rate-limit';

describe('Rate Limit 유틸리티', () => {
  beforeEach(() => {
    // 각 테스트 전 저장소 초기화
    resetRateLimitStore();
  });

  describe('checkLoginRateLimit', () => {
    it('첫 번째 시도는 허용됨', () => {
      const result = checkLoginRateLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
      expect(result.retryAfterMs).toBeUndefined();
    });

    it('실패 기록이 없으면 계속 허용됨', () => {
      const ip = '192.168.1.1';

      for (let i = 0; i < 3; i++) {
        const result = checkLoginRateLimit(ip);
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('recordLoginFailure', () => {
    it('실패 기록 시 남은 시도 횟수 감소', () => {
      const ip = '192.168.1.1';

      recordLoginFailure(ip);
      const result = checkLoginRateLimit(ip);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(4);
    });

    it('5회 실패 후 차단됨', () => {
      const ip = '192.168.1.1';

      // 5회 실패 기록
      for (let i = 0; i < 5; i++) {
        recordLoginFailure(ip);
      }

      const result = checkLoginRateLimit(ip);

      expect(result.allowed).toBe(false);
      expect(result.remainingAttempts).toBe(0);
      expect(result.retryAfterMs).toBeDefined();
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('6번째 시도는 차단됨', () => {
      const ip = '192.168.1.1';

      // 5회 실패 기록
      for (let i = 0; i < 5; i++) {
        recordLoginFailure(ip);
      }

      // 6번째 체크
      const result = checkLoginRateLimit(ip);

      expect(result.allowed).toBe(false);
    });
  });

  describe('IP 격리 테스트', () => {
    it('다른 IP는 영향 받지 않음', () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // IP1에서 5회 실패
      for (let i = 0; i < 5; i++) {
        recordLoginFailure(ip1);
      }

      // IP1은 차단됨
      const result1 = checkLoginRateLimit(ip1);
      expect(result1.allowed).toBe(false);

      // IP2는 영향 없음
      const result2 = checkLoginRateLimit(ip2);
      expect(result2.allowed).toBe(true);
      expect(result2.remainingAttempts).toBe(5);
    });
  });

  describe('clearLoginAttempts', () => {
    it('로그인 성공 시 카운터 초기화', () => {
      const ip = '192.168.1.1';

      // 4회 실패 기록
      for (let i = 0; i < 4; i++) {
        recordLoginFailure(ip);
      }

      // 남은 시도 1회
      let result = checkLoginRateLimit(ip);
      expect(result.remainingAttempts).toBe(1);

      // 성공으로 초기화
      clearLoginAttempts(ip);

      // 다시 5회 가능
      result = checkLoginRateLimit(ip);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });

    it('차단된 상태에서도 초기화 가능', () => {
      const ip = '192.168.1.1';

      // 5회 실패로 차단
      for (let i = 0; i < 5; i++) {
        recordLoginFailure(ip);
      }

      let result = checkLoginRateLimit(ip);
      expect(result.allowed).toBe(false);

      // 초기화
      clearLoginAttempts(ip);

      // 다시 허용
      result = checkLoginRateLimit(ip);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });
  });

  describe('Retry-After 정보', () => {
    it('차단 시 retryAfterMs 포함', () => {
      const ip = '192.168.1.1';

      // 5회 실패로 차단
      for (let i = 0; i < 5; i++) {
        recordLoginFailure(ip);
      }

      const result = checkLoginRateLimit(ip);

      expect(result.retryAfterMs).toBeDefined();
      // 15분 = 900000ms, 약간의 시간이 지났으므로 이보다 작을 수 있음
      expect(result.retryAfterMs).toBeLessThanOrEqual(15 * 60 * 1000);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('허용 상태에서는 retryAfterMs 없음', () => {
      const ip = '192.168.1.1';

      const result = checkLoginRateLimit(ip);

      expect(result.retryAfterMs).toBeUndefined();
    });
  });
});

describe('getClientIp', () => {
  it('x-forwarded-for 헤더에서 IP 추출', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '203.0.113.1, 198.51.100.1, 192.0.2.1',
      },
    });

    const ip = getClientIp(request);
    expect(ip).toBe('203.0.113.1');
  });

  it('x-forwarded-for 단일 IP', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '203.0.113.1',
      },
    });

    const ip = getClientIp(request);
    expect(ip).toBe('203.0.113.1');
  });

  it('x-real-ip 헤더에서 IP 추출', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-real-ip': '203.0.113.2',
      },
    });

    const ip = getClientIp(request);
    expect(ip).toBe('203.0.113.2');
  });

  it('x-forwarded-for가 x-real-ip보다 우선', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '203.0.113.1',
        'x-real-ip': '203.0.113.2',
      },
    });

    const ip = getClientIp(request);
    expect(ip).toBe('203.0.113.1');
  });

  it('헤더가 없으면 기본값 반환', () => {
    const request = new Request('http://localhost');

    const ip = getClientIp(request);
    expect(ip).toBe('127.0.0.1');
  });
});
