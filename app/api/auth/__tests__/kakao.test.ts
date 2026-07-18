/**
 * POST /api/auth/kakao 테스트 (ARC-003 §2, C2)
 *
 * 테스트 대상:
 * - 환경변수 미설정 → 503 한국어 안내 (코드가 죽지 않음)
 * - kapi 검증 실패(401/만료) → 자체 토큰 미발급 (Acceptance)
 * - 연결 없음 → linked: false + 초대 안내, JWT·쿠키 미발급 (이메일 자동 병합 없음)
 * - 연결 있음 → B2와 동일한 소속 결정 (0건 폴백 / 단일 / 복수 선택 응답)
 * - 응답 세션은 항상 자체 JWT — 카카오 토큰이 쿠키·토큰으로 쓰이지 않음 (Acceptance)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prismaBase: {
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock @/lib/auth/user
vi.mock('@/lib/auth/user', () => ({
  createUserToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  createUserTokenCookie: vi.fn().mockReturnValue('user_token=mock-jwt-token; Path=/; HttpOnly'),
  createPendingSelectionToken: vi.fn().mockResolvedValue('mock-pending-token'),
  PENDING_SELECTION_MAX_AGE_SECONDS: 600,
  deriveLegacyFlags: vi.fn().mockReturnValue({
    canApprove: false,
    canManageExpense: false,
    canAccessAdmin: false,
    canExportData: false,
    canRegisterUsers: false,
  }),
}));

// Mock @/lib/services/kakao — 에러 클래스는 라우트의 instanceof 매핑을 위해 실제 클래스로 제공
vi.mock('@/lib/services/kakao', () => {
  class KakaoConfigError extends Error {}
  class KakaoTokenError extends Error {}
  return {
    KakaoConfigError,
    KakaoTokenError,
    isKakaoConfigured: vi.fn().mockReturnValue(true),
    isKakaoOidcEnabled: vi.fn().mockReturnValue(false),
    verifyKakaoAccessToken: vi.fn(),
  };
});

// Mock @/lib/services/auth-account
vi.mock('@/lib/services/auth-account', () => ({
  findUserByProvider: vi.fn(),
}));

// Mock @/lib/services/membership
vi.mock('@/lib/services/membership', () => ({
  getMemberships: vi.fn(),
}));

// Import after mocking
import { POST } from '../kakao/route';
import { prismaBase } from '@/lib/prisma';
import {
  createUserToken,
  createUserTokenCookie,
  createPendingSelectionToken,
} from '@/lib/auth/user';
import {
  isKakaoConfigured,
  isKakaoOidcEnabled,
  KakaoTokenError,
  verifyKakaoAccessToken,
} from '@/lib/services/kakao';
import { findUserByProvider } from '@/lib/services/auth-account';
import { getMemberships } from '@/lib/services/membership';

const mockPrisma = prismaBase as any;
const mockCreateUserToken = createUserToken as any;
const mockCreateUserTokenCookie = createUserTokenCookie as any;
const mockCreatePendingToken = createPendingSelectionToken as any;
const mockIsConfigured = isKakaoConfigured as any;
const mockIsOidcEnabled = isKakaoOidcEnabled as any;
const mockVerifyToken = verifyKakaoAccessToken as any;
const mockFindUserByProvider = findUserByProvider as any;
const mockGetMemberships = getMemberships as any;

function createKakaoRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/kakao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const linkedUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  userid: 'testuser',
  username: '테스트유저',
  role: 'user',
  roleId: 'role-1',
  department: '개발팀',
  isActive: true,
  canRegisterUsers: false,
};

const activeTenant = {
  id: 'tenant-1',
  name: '청연컨설팅',
  subdomain: 'chungyeon',
  isActive: true,
};

function membershipOf(tenantId: string, name: string, orgType: string, role = 'MEMBER') {
  return {
    id: `membership-${tenantId}`,
    userId: 'user-1',
    tenantId,
    role,
    isDefault: tenantId === 'tenant-1',
    createdAt: new Date('2026-07-18'),
    updatedAt: new Date('2026-07-18'),
    tenant: { id: tenantId, name, orgType, isActive: true },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockIsOidcEnabled.mockReturnValue(false);
  mockVerifyToken.mockResolvedValue({ providerUserId: '12345678' });
  mockFindUserByProvider.mockResolvedValue(linkedUser);
  mockGetMemberships.mockResolvedValue([]);
  mockPrisma.tenant.findUnique.mockResolvedValue(activeTenant);
  mockCreateUserToken.mockResolvedValue('mock-jwt-token');
  mockCreateUserTokenCookie.mockReturnValue('user_token=mock-jwt-token; Path=/; HttpOnly');
  mockCreatePendingToken.mockResolvedValue('mock-pending-token');
});

describe('POST /api/auth/kakao — 설정/검증 (C2)', () => {
  it('환경변수 미설정이면 503 + 한국어 안내, 토큰 미발급', async () => {
    mockIsConfigured.mockReturnValue(false);

    const response = await POST(createKakaoRequest({ kakaoAccessToken: 'token' }));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.');
    expect(mockVerifyToken).not.toHaveBeenCalled();
    expect(mockCreateUserToken).not.toHaveBeenCalled();
  });

  it('KAKAO_USE_OIDC 활성화 시 503 (초기 구현은 access token + kapi만)', async () => {
    mockIsOidcEnabled.mockReturnValue(true);

    const response = await POST(createKakaoRequest({ idToken: 'oidc-id-token' }));

    expect(response.status).toBe(503);
    expect(mockCreateUserToken).not.toHaveBeenCalled();
  });

  it('kakaoAccessToken이 없으면 400', async () => {
    const response = await POST(createKakaoRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('카카오 토큰을 입력해주세요.');
  });

  it('kapi 검증 실패(401/만료)면 자체 토큰을 발급하지 않는다', async () => {
    mockVerifyToken.mockRejectedValue(
      new KakaoTokenError('카카오 토큰 검증에 실패했습니다. 다시 로그인해주세요.')
    );

    const response = await POST(createKakaoRequest({ kakaoAccessToken: 'expired' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('카카오 토큰 검증에 실패했습니다. 다시 로그인해주세요.');
    expect(mockCreateUserToken).not.toHaveBeenCalled();
    expect(mockCreatePendingToken).not.toHaveBeenCalled();
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });
});

describe('POST /api/auth/kakao — 계정 연결 (C2)', () => {
  it('연결 없음이면 linked: false + 초대 안내, JWT·쿠키 미발급 (자동 병합 없음)', async () => {
    mockFindUserByProvider.mockResolvedValue(null);

    const response = await POST(createKakaoRequest({ kakaoAccessToken: 'valid' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      linked: false,
      message: '연결된 계정이 없습니다. 초대를 받은 후 이용할 수 있습니다.',
    });
    expect(mockCreateUserToken).not.toHaveBeenCalled();
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('비활성 계정이면 403', async () => {
    mockFindUserByProvider.mockResolvedValue({ ...linkedUser, isActive: false });

    const response = await POST(createKakaoRequest({ kakaoAccessToken: 'valid' }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('계정이 비활성화되어 있습니다. 관리자에게 문의하세요.');
    expect(mockCreateUserToken).not.toHaveBeenCalled();
  });

  it('비활성 테넌트면 403', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ ...activeTenant, isActive: false });

    const response = await POST(createKakaoRequest({ kakaoAccessToken: 'valid' }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('이 조직은 현재 이용할 수 없습니다.');
    expect(mockCreateUserToken).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/kakao — 소속 결정 (B2와 동일)', () => {
  it('Membership 0건이면 기존 User.tenantId로 자체 JWT 발급 (백필 전 폴백)', async () => {
    mockGetMemberships.mockResolvedValue([]);

    const response = await POST(createKakaoRequest({ kakaoAccessToken: 'valid' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.linked).toBe(true);
    expect(data.token).toBe('mock-jwt-token');
    expect(mockCreateUserToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', tenantId: 'tenant-1' })
    );
    // 세션 쿠키는 자체 JWT — 카카오 토큰이 세션으로 쓰이지 않는다
    expect(mockCreateUserTokenCookie).toHaveBeenCalledWith('mock-jwt-token');
    expect(response.headers.get('Set-Cookie')).not.toContain('valid');
  });

  it('Membership 조회 실패(테이블 미생성 등)도 기존 동작으로 폴백한다', async () => {
    mockGetMemberships.mockRejectedValue(new Error('relation "Membership" does not exist'));

    const response = await POST(createKakaoRequest({ kakaoAccessToken: 'valid' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.token).toBe('mock-jwt-token');
    expect(mockCreateUserToken).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' })
    );
  });

  it('단일 소속이면 Membership의 tenantId로 즉시 발급된다', async () => {
    mockGetMemberships.mockResolvedValue([
      membershipOf('tenant-2', '청연교회', 'CHURCH'),
    ]);
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-2',
      name: '청연교회',
      subdomain: 'church',
      isActive: true,
    });

    const response = await POST(createKakaoRequest({ kakaoAccessToken: 'valid' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tenant).toEqual({ id: 'tenant-2', name: '청연교회', subdomain: 'church' });
    expect(mockCreateUserToken).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-2' })
    );
    expect(mockCreatePendingToken).not.toHaveBeenCalled();
  });

  it('복수 소속이면 조직 선택 응답 + 선택용 임시 토큰 (최종 토큰 미발급)', async () => {
    mockGetMemberships.mockResolvedValue([
      membershipOf('tenant-1', '청연컨설팅', 'COMPANY', 'TENANT_ADMIN'),
      membershipOf('tenant-2', '청연교회', 'CHURCH'),
    ]);

    const response = await POST(createKakaoRequest({ kakaoAccessToken: 'valid' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.requiresTenantSelection).toBe(true);
    expect(data.linked).toBe(true);
    expect(data.memberships).toEqual([
      { tenantId: 'tenant-1', tenantName: '청연컨설팅', orgType: 'COMPANY', role: 'TENANT_ADMIN' },
      { tenantId: 'tenant-2', tenantName: '청연교회', orgType: 'CHURCH', role: 'MEMBER' },
    ]);
    expect(data.token).toBe('mock-pending-token');
    expect(mockCreateUserToken).not.toHaveBeenCalled();
    expect(mockCreateUserTokenCookie).toHaveBeenCalledWith('mock-pending-token', 600);
  });
});
