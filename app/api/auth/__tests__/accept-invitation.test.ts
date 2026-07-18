/**
 * POST /api/auth/accept-invitation 테스트 (ARC-003 §4.2, C3)
 *
 * 테스트 대상:
 * - 만료/기수락 토큰 재사용 불가 — 자체 토큰 미발급 (Acceptance)
 * - 일반 가입: signup과 동일한 필수 필드 검증 후 acceptInvitation 위임
 * - 카카오: 서버측 kapi 검증 실패 시 초대 소진 없음, 기존 연결 유저는 Membership만 추가
 * - 성공 시 수락한 테넌트의 자체 JWT + 쿠키 발급
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock @/lib/auth/user
vi.mock('@/lib/auth/user', () => ({
  createUserToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  createUserTokenCookie: vi.fn().mockReturnValue('user_token=mock-jwt-token; Path=/; HttpOnly'),
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
    verifyKakaoAccessToken: vi.fn(),
  };
});

// Mock @/lib/services/auth-account
vi.mock('@/lib/services/auth-account', () => ({
  findUserByProvider: vi.fn(),
}));

// Mock @/lib/services/invitation — InvitationError는 instanceof 매핑을 위해 실제 클래스로 제공
vi.mock('@/lib/services/invitation', () => {
  class InvitationError extends Error {
    readonly status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.name = 'InvitationError';
      this.status = status;
    }
  }
  return {
    InvitationError,
    acceptInvitation: vi.fn(),
  };
});

import { POST } from '../accept-invitation/route';
import { createUserToken, createUserTokenCookie } from '@/lib/auth/user';
import {
  isKakaoConfigured,
  KakaoTokenError,
  verifyKakaoAccessToken,
} from '@/lib/services/kakao';
import { findUserByProvider } from '@/lib/services/auth-account';
import { acceptInvitation, InvitationError } from '@/lib/services/invitation';

const mockCreateUserToken = createUserToken as ReturnType<typeof vi.fn>;
const mockCreateUserTokenCookie = createUserTokenCookie as ReturnType<typeof vi.fn>;
const mockIsConfigured = isKakaoConfigured as ReturnType<typeof vi.fn>;
const mockVerifyToken = verifyKakaoAccessToken as ReturnType<typeof vi.fn>;
const mockFindUserByProvider = findUserByProvider as ReturnType<typeof vi.fn>;
const mockAcceptInvitation = acceptInvitation as ReturnType<typeof vi.fn>;

function createAcceptRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/accept-invitation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const acceptedUser = {
  id: 'user-new',
  tenantId: 'tenant-A',
  userid: 'newbie',
  username: '신규유저',
  role: 'user',
  roleId: null,
  department: null,
  isActive: true,
  canRegisterUsers: false,
};

const acceptResult = {
  user: acceptedUser,
  membership: {
    id: 'membership-1',
    userId: 'user-new',
    tenantId: 'tenant-A',
    role: 'MEMBER',
    isDefault: true,
  },
  tenant: { id: 'tenant-A', name: '청연컨설팅', subdomain: 'chungyeon', isActive: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockVerifyToken.mockResolvedValue({ providerUserId: '12345678' });
  mockFindUserByProvider.mockResolvedValue(null);
  mockAcceptInvitation.mockResolvedValue(acceptResult);
  mockCreateUserToken.mockResolvedValue('mock-jwt-token');
  mockCreateUserTokenCookie.mockReturnValue('user_token=mock-jwt-token; Path=/; HttpOnly');
});

describe('POST /api/auth/accept-invitation — 검증 (C3)', () => {
  it('inviteToken이 없으면 400', async () => {
    const response = await POST(createAcceptRequest({ userid: 'a', password: 'pass1234' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('초대 토큰을 입력해주세요.');
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
  });

  it('만료된 초대면 410 — 자체 토큰 미발급 (재사용 불가)', async () => {
    mockAcceptInvitation.mockRejectedValue(new InvitationError('만료된 초대입니다.', 410));

    const response = await POST(
      createAcceptRequest({
        inviteToken: 'expired',
        userid: 'newbie',
        username: '신규유저',
        password: 'pass1234',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.error).toBe('만료된 초대입니다.');
    expect(mockCreateUserToken).not.toHaveBeenCalled();
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('이미 사용된 초대면 409 — 자체 토큰 미발급 (재사용 불가)', async () => {
    mockAcceptInvitation.mockRejectedValue(new InvitationError('이미 사용된 초대입니다.', 409));

    const response = await POST(
      createAcceptRequest({
        inviteToken: 'used',
        userid: 'newbie',
        username: '신규유저',
        password: 'pass1234',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('이미 사용된 초대입니다.');
    expect(mockCreateUserToken).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/accept-invitation — 일반 가입 (C3)', () => {
  it('필수 필드 누락이면 400 (signup과 동일한 안내)', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ inviteToken: 't' }, '아이디를 입력해주세요.'],
      [{ inviteToken: 't', userid: 'newbie' }, '이름을 입력해주세요.'],
      [{ inviteToken: 't', userid: 'newbie', username: '유저' }, '비밀번호를 입력해주세요.'],
      [
        { inviteToken: 't', userid: 'newbie', username: '유저', password: '123' },
        '비밀번호는 4자 이상이어야 합니다.',
      ],
    ];

    for (const [body, message] of cases) {
      const response = await POST(createAcceptRequest(body));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(message);
    }

    expect(mockAcceptInvitation).not.toHaveBeenCalled();
  });

  it('수락 성공 시 201 + 자체 JWT·쿠키 발급 (수락한 테넌트로 로그인)', async () => {
    const response = await POST(
      createAcceptRequest({
        inviteToken: 'valid-token',
        userid: '  newbie  ',
        username: ' 신규유저 ',
        password: 'pass1234',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockAcceptInvitation).toHaveBeenCalledWith({
      token: 'valid-token',
      userid: 'newbie',
      username: '신규유저',
      password: 'pass1234',
    });
    expect(mockCreateUserToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-new', tenantId: 'tenant-A' })
    );
    expect(data.token).toBe('mock-jwt-token');
    expect(data.tenant).toEqual({ id: 'tenant-A', name: '청연컨설팅', subdomain: 'chungyeon' });
    expect(response.headers.get('Set-Cookie')).toContain('user_token=mock-jwt-token');
  });

  it('발급 토큰의 역할은 Membership.role에서 파생된다 (초대 tier 반영)', async () => {
    // TENANT_ADMIN 초대 → 발급 토큰 role='admin' (신규 유저 User.role='user'여도 관리자 권한)
    mockAcceptInvitation.mockResolvedValue({
      ...acceptResult,
      membership: { ...acceptResult.membership, role: 'TENANT_ADMIN' },
    });

    const response = await POST(
      createAcceptRequest({
        inviteToken: 'valid-token',
        userid: 'newadmin',
        username: '신규관리자',
        password: 'pass1234',
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateUserToken).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-A',
        role: 'admin',
        roles: ['admin'],
        roleId: null,
        department: null,
      })
    );
  });

  it('MEMBER 초대는 홈 admin이라도 일반 역할만 부여된다 (권한 상승 방지)', async () => {
    // 기존 유저(홈 테넌트 admin)가 MEMBER로 초대 수락 → 발급 토큰 role='user'
    mockFindUserByProvider.mockResolvedValue(null);
    mockAcceptInvitation.mockResolvedValue({
      ...acceptResult,
      user: { ...acceptedUser, id: 'user-9', role: 'admin', roleId: 'role-admin' },
      membership: { ...acceptResult.membership, role: 'MEMBER' },
    });

    const response = await POST(
      createAcceptRequest({
        inviteToken: 'valid-token',
        userid: 'existingadmin',
        username: '기존관리자',
        password: 'pass1234',
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateUserToken).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-A', role: 'user', roles: ['user'] })
    );
  });
});

describe('POST /api/auth/accept-invitation — 카카오 (C3)', () => {
  it('카카오 미설정이면 503 — 초대 소진 없음', async () => {
    mockIsConfigured.mockReturnValue(false);

    const response = await POST(
      createAcceptRequest({ inviteToken: 't', kakaoAccessToken: 'kakao-token' })
    );
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('카카오 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.');
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
  });

  it('kapi 검증 실패면 401 — 초대 소진·계정 생성·토큰 발급 없음', async () => {
    mockVerifyToken.mockRejectedValue(
      new KakaoTokenError('카카오 토큰 검증에 실패했습니다. 다시 로그인해주세요.')
    );

    const response = await POST(
      createAcceptRequest({ inviteToken: 't', kakaoAccessToken: 'expired' })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('카카오 토큰 검증에 실패했습니다. 다시 로그인해주세요.');
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
    expect(mockCreateUserToken).not.toHaveBeenCalled();
  });

  it('신규 카카오 유저는 검증된 회원번호로 acceptInvitation에 위임한다', async () => {
    mockFindUserByProvider.mockResolvedValue(null);

    const response = await POST(
      createAcceptRequest({
        inviteToken: 'valid-token',
        kakaoAccessToken: 'kakao-token',
        username: '카카오유저',
      })
    );

    expect(response.status).toBe(201);
    expect(mockFindUserByProvider).toHaveBeenCalledWith('kakao', '12345678');
    expect(mockAcceptInvitation).toHaveBeenCalledWith({
      token: 'valid-token',
      existingUserId: undefined,
      username: '카카오유저',
      userid: undefined,
      kakaoProviderUserId: '12345678',
    });
  });

  it('기존 연결 유저는 existingUserId로 위임한다 (Membership만 추가)', async () => {
    mockFindUserByProvider.mockResolvedValue({ ...acceptedUser, id: 'user-9' });
    mockAcceptInvitation.mockResolvedValue({
      ...acceptResult,
      user: { ...acceptedUser, id: 'user-9' },
    });

    const response = await POST(
      createAcceptRequest({ inviteToken: 'valid-token', kakaoAccessToken: 'kakao-token' })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockAcceptInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ existingUserId: 'user-9', kakaoProviderUserId: '12345678' })
    );
    expect(data.user.id).toBe('user-9');
  });
});
