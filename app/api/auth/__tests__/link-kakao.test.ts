/**
 * /api/auth/link-kakao 테스트 (ARC-003 §4.2, C4)
 *
 * 테스트 대상:
 * - 연결 API는 인증 세션 필수 — 미인증 401 (Acceptance)
 * - 환경변수 미설정 → 503 한국어 안내
 * - kapi 검증 실패 → 401, 연결 미수행 (클라이언트 토큰을 그대로 신뢰하지 않음)
 * - 이미 다른 유저에 연결된 카카오 계정 → 409 (계정 탈취 방지)
 * - 연결 대상은 항상 세션 유저 — 이메일 매칭 자동 병합 없음
 * - 해제: 미연결 404, 마지막 로그인 수단이면 400 거부 (Acceptance)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setMockUser, resetMockUser, mockUserSession } from '@/test/setup';

// Mock @/lib/services/kakao — 에러 클래스는 라우트의 instanceof 매핑을 위해 실제 클래스로 제공
vi.mock('@/lib/services/kakao', () => {
  class KakaoConfigError extends Error {}
  class KakaoTokenError extends Error {}
  return {
    KakaoConfigError,
    KakaoTokenError,
    isKakaoConfigured: vi.fn().mockReturnValue(true),
    verifyKakaoAccessToken: vi.fn(),
  };
});

// Mock @/lib/services/auth-account — 에러 클래스는 실제 클래스로 제공
vi.mock('@/lib/services/auth-account', () => {
  class AuthAccountNotLinkedError extends Error {}
  class LastAuthMethodError extends Error {}
  class AuthAccountConflictError extends Error {}
  return {
    AuthAccountNotLinkedError,
    LastAuthMethodError,
    AuthAccountConflictError,
    getAuthAccount: vi.fn(),
    linkAuthAccount: vi.fn(),
    unlinkAuthAccount: vi.fn(),
  };
});

// Import after mocking
import { GET, POST, DELETE } from '../link-kakao/route';
import {
  isKakaoConfigured,
  KakaoTokenError,
  verifyKakaoAccessToken,
} from '@/lib/services/kakao';
import {
  AuthAccountConflictError,
  AuthAccountNotLinkedError,
  getAuthAccount,
  LastAuthMethodError,
  linkAuthAccount,
  unlinkAuthAccount,
} from '@/lib/services/auth-account';

const mockIsConfigured = isKakaoConfigured as any;
const mockVerifyToken = verifyKakaoAccessToken as any;
const mockGetAuthAccount = getAuthAccount as any;
const mockLinkAuthAccount = linkAuthAccount as any;
const mockUnlinkAuthAccount = unlinkAuthAccount as any;

// withAuth 래핑 이후 라우트 핸들러는 (request, context) 시그니처를 갖는다
const mockRouteContext = { params: Promise.resolve({}) } as never;

function createGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/auth/link-kakao');
}

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/link-kakao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(): NextRequest {
  return new NextRequest('http://localhost/api/auth/link-kakao', {
    method: 'DELETE',
  });
}

const kakaoAccount = {
  id: 'auth-1',
  userId: mockUserSession.id,
  provider: 'kakao',
  providerUserId: '12345678',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockVerifyToken.mockResolvedValue({ providerUserId: '12345678' });
  mockGetAuthAccount.mockResolvedValue(null);
  mockLinkAuthAccount.mockResolvedValue(kakaoAccount);
  mockUnlinkAuthAccount.mockResolvedValue(undefined);
});

afterEach(() => {
  resetMockUser();
});

describe('/api/auth/link-kakao — 인증 필수 (Acceptance)', () => {
  it('미인증이면 GET 401', async () => {
    setMockUser(null);

    const response = await GET(createGetRequest(), mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('로그인이 필요합니다.');
    expect(mockGetAuthAccount).not.toHaveBeenCalled();
  });

  it('미인증이면 POST 401, 연결 미수행', async () => {
    setMockUser(null);

    const response = await POST(
      createPostRequest({ kakaoAccessToken: 'token' }),
      mockRouteContext
    );

    expect(response.status).toBe(401);
    expect(mockVerifyToken).not.toHaveBeenCalled();
    expect(mockLinkAuthAccount).not.toHaveBeenCalled();
  });

  it('미인증이면 DELETE 401, 해제 미수행', async () => {
    setMockUser(null);

    const response = await DELETE(createDeleteRequest(), mockRouteContext);

    expect(response.status).toBe(401);
    expect(mockUnlinkAuthAccount).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/link-kakao — 연결 상태 조회', () => {
  it('세션 유저의 카카오 연결 상태를 반환한다', async () => {
    mockGetAuthAccount.mockResolvedValue(kakaoAccount);

    const response = await GET(createGetRequest(), mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, linked: true, configured: true });
    expect(mockGetAuthAccount).toHaveBeenCalledWith(mockUserSession.id, 'kakao');
  });

  it('연결이 없으면 linked: false', async () => {
    mockGetAuthAccount.mockResolvedValue(null);
    mockIsConfigured.mockReturnValue(false);

    const response = await GET(createGetRequest(), mockRouteContext);
    const data = await response.json();

    expect(data).toEqual({ success: true, linked: false, configured: false });
  });
});

describe('POST /api/auth/link-kakao — 카카오 연결', () => {
  it('환경변수 미설정이면 503 + 한국어 안내, 연결 미수행', async () => {
    mockIsConfigured.mockReturnValue(false);

    const response = await POST(
      createPostRequest({ kakaoAccessToken: 'token' }),
      mockRouteContext
    );
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.');
    expect(mockLinkAuthAccount).not.toHaveBeenCalled();
  });

  it('kakaoAccessToken이 없으면 400', async () => {
    const response = await POST(createPostRequest({}), mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('카카오 토큰을 입력해주세요.');
    expect(mockLinkAuthAccount).not.toHaveBeenCalled();
  });

  it('kapi 검증 실패(만료·위조)면 401, 연결 미수행', async () => {
    mockVerifyToken.mockRejectedValue(
      new KakaoTokenError('카카오 토큰 검증에 실패했습니다. 다시 로그인해주세요.')
    );

    const response = await POST(
      createPostRequest({ kakaoAccessToken: 'expired' }),
      mockRouteContext
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('카카오 토큰 검증에 실패했습니다. 다시 로그인해주세요.');
    expect(mockLinkAuthAccount).not.toHaveBeenCalled();
  });

  it('이미 다른 유저에 연결된 카카오 계정이면 409 (계정 탈취 방지)', async () => {
    mockLinkAuthAccount.mockRejectedValue(
      new AuthAccountConflictError('이미 다른 계정에 연결된 인증 수단입니다.')
    );

    const response = await POST(
      createPostRequest({ kakaoAccessToken: 'valid' }),
      mockRouteContext
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('이미 다른 계정에 연결된 인증 수단입니다.');
  });

  it('같은 유저에 카카오가 이미 연결돼 있으면 409 (provider당 1개)', async () => {
    mockLinkAuthAccount.mockRejectedValue(
      new AuthAccountConflictError('이미 연결된 인증 수단이 있습니다. 기존 연결을 해제한 후 다시 시도해주세요.')
    );

    const response = await POST(
      createPostRequest({ kakaoAccessToken: 'valid' }),
      mockRouteContext
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('이미 연결된 인증 수단이 있습니다. 기존 연결을 해제한 후 다시 시도해주세요.');
  });

  it('검증 통과 시 세션 유저에 연결한다 — 이메일 매칭 자동 병합 없음', async () => {
    const response = await POST(
      createPostRequest({ kakaoAccessToken: 'valid' }),
      mockRouteContext
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      linked: true,
      message: '카카오 계정이 연결되었습니다.',
    });
    // 연결 대상은 항상 세션 유저 + kapi가 검증한 카카오 회원번호 (공통 원칙 3)
    expect(mockLinkAuthAccount).toHaveBeenCalledWith(
      mockUserSession.id,
      'kakao',
      '12345678'
    );
  });
});

describe('DELETE /api/auth/link-kakao — 연결 해제', () => {
  it('연결이 없으면 404', async () => {
    mockUnlinkAuthAccount.mockRejectedValue(
      new AuthAccountNotLinkedError('연결된 인증 수단이 없습니다.')
    );

    const response = await DELETE(createDeleteRequest(), mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('연결된 카카오 계정이 없습니다.');
  });

  it('마지막 로그인 수단이면 400 거부 (Acceptance)', async () => {
    mockUnlinkAuthAccount.mockRejectedValue(
      new LastAuthMethodError(
        '마지막 로그인 수단은 해제할 수 없습니다. 비밀번호를 먼저 설정해주세요.'
      )
    );

    const response = await DELETE(createDeleteRequest(), mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      '마지막 로그인 수단은 해제할 수 없습니다. 비밀번호를 먼저 설정해주세요.'
    );
  });

  it('해제 성공 시 linked: false를 반환한다', async () => {
    const response = await DELETE(createDeleteRequest(), mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      linked: false,
      message: '카카오 계정 연결이 해제되었습니다.',
    });
    expect(mockUnlinkAuthAccount).toHaveBeenCalledWith(mockUserSession.id, 'kakao');
  });
});
