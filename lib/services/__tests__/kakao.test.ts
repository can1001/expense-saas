/**
 * 카카오 인증 서비스 테스트 (ARC-003 §2, C2)
 *
 * 외부 호출 금지 원칙 — kapi.kakao.com 호출은 fetch 모킹으로 대체한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isKakaoConfigured,
  isKakaoOidcEnabled,
  KakaoConfigError,
  KakaoTokenError,
  verifyKakaoAccessToken,
} from '../kakao';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubEnv('KAKAO_REST_API_KEY', 'test-rest-api-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('isKakaoConfigured / isKakaoOidcEnabled', () => {
  it('KAKAO_REST_API_KEY가 있으면 설정된 것으로 본다', () => {
    expect(isKakaoConfigured()).toBe(true);
  });

  it('KAKAO_REST_API_KEY 미설정이면 false — 코드가 죽지 않는다', () => {
    vi.stubEnv('KAKAO_REST_API_KEY', '');
    expect(isKakaoConfigured()).toBe(false);
  });

  it('KAKAO_USE_OIDC=true일 때만 OIDC 분기가 켜진다', () => {
    expect(isKakaoOidcEnabled()).toBe(false);
    vi.stubEnv('KAKAO_USE_OIDC', 'true');
    expect(isKakaoOidcEnabled()).toBe(true);
  });
});

describe('verifyKakaoAccessToken', () => {
  it('kapi /v2/user/me를 Bearer 토큰으로 호출하고 회원번호를 문자열로 반환한다', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 12345678 }),
    });

    const result = await verifyKakaoAccessToken('kakao-access-token');

    expect(mockFetch).toHaveBeenCalledWith('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: 'Bearer kakao-access-token' },
    });
    expect(result).toEqual({ providerUserId: '12345678' });
  });

  it('환경변수 미설정이면 kapi 호출 없이 KakaoConfigError (한국어 메시지)', async () => {
    vi.stubEnv('KAKAO_REST_API_KEY', '');

    await expect(verifyKakaoAccessToken('token')).rejects.toThrow(KakaoConfigError);
    await expect(verifyKakaoAccessToken('token')).rejects.toThrow(
      '카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.'
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('kapi 401(만료·위조)이면 KakaoTokenError — 자체 토큰 발급 금지 신호', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: -401 }),
    });

    await expect(verifyKakaoAccessToken('expired-token')).rejects.toThrow(KakaoTokenError);
  });

  it('응답에 회원번호(id)가 없으면 KakaoTokenError', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(verifyKakaoAccessToken('token')).rejects.toThrow(
      '카카오 회원 정보를 확인할 수 없습니다.'
    );
  });
});
