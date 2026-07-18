/**
 * POST /api/auth/switch-tenant 테스트 (ARC-002 §3.2, B3)
 *
 * 테스트 대상:
 * - 토큰 없음/무효 → 401
 * - 미소속 tenantId → 403 + 토큰 무변경 (재발급·쿠키 설정 없음)
 * - 정식 토큰으로 소속 조직 전환 → 새 tenantId 클레임 토큰 재발급 + 쿠키 갱신
 * - 선택용 임시 토큰(B2) → 정식 토큰 발급
 * - 비활성 사용자/테넌트 → 403
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prismaBase: {
    user: {
      findUnique: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock @/lib/auth/user (전역 setup 모킹 대체 — 라우트가 쓰는 함수만)
vi.mock('@/lib/auth/user', () => ({
  COOKIE_NAME: 'user_token',
  verifyUserToken: vi.fn(),
  verifyPendingSelectionToken: vi.fn(),
  createUserToken: vi.fn().mockResolvedValue('new-jwt-token'),
  createUserTokenCookie: vi.fn().mockReturnValue('user_token=new-jwt-token; Path=/; HttpOnly'),
  deriveLegacyFlags: vi.fn().mockReturnValue({
    canApprove: false,
    canManageExpense: false,
    canAccessAdmin: false,
    canExportData: false,
    canRegisterUsers: false,
  }),
}));

// Mock @/lib/services/membership
vi.mock('@/lib/services/membership', () => ({
  assertMembership: vi.fn(),
  membershipRoleToRoleCode: (role: string) =>
    role === 'TENANT_ADMIN' ? 'admin' : 'user',
}));

// Mock FCM 재구독 (B6) — 전환 성공 시에만 호출되는지 검증
vi.mock('@/lib/services/notification/fcm-provider', () => ({
  fcmProvider: {
    resubscribeTenantTopics: vi.fn().mockResolvedValue({ moved: 0 }),
  },
}));

// Import after mocking
import { POST } from '../switch-tenant/route';
import { prismaBase } from '@/lib/prisma';
import {
  verifyUserToken,
  verifyPendingSelectionToken,
  createUserToken,
  createUserTokenCookie,
} from '@/lib/auth/user';
import { assertMembership } from '@/lib/services/membership';
import { fcmProvider } from '@/lib/services/notification/fcm-provider';

const mockPrisma = prismaBase as any;
const mockResubscribe = fcmProvider.resubscribeTenantTopics as any;
const mockVerifyUserToken = verifyUserToken as any;
const mockVerifyPendingToken = verifyPendingSelectionToken as any;
const mockCreateUserToken = createUserToken as any;
const mockCreateUserTokenCookie = createUserTokenCookie as any;
const mockAssertMembership = assertMembership as any;

function createSwitchRequest(
  body: Record<string, unknown>,
  options?: { bearer?: string; cookie?: string }
): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.bearer) headers['Authorization'] = `Bearer ${options.bearer}`;
  if (options?.cookie) headers['Cookie'] = `user_token=${options.cookie}`;

  return new NextRequest('http://localhost/api/auth/switch-tenant', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const fullSession = {
  id: 'user-1',
  tenantId: 'tenant-1',
  userid: 'testuser',
  username: '테스트유저',
  role: 'user',
  roles: ['user'],
  roleId: 'role-1',
  department: '개발팀',
  granted: [],
  canApprove: false,
  canManageExpense: false,
  canAccessAdmin: false,
  canExportData: false,
  canRegisterUsers: false,
};

const dbUser = {
  id: 'user-1',
  userid: 'testuser',
  username: '테스트유저',
  role: 'user',
  roleId: 'role-1',
  department: '개발팀',
  isActive: true,
  canRegisterUsers: false,
};

const targetTenant = {
  id: 'tenant-2',
  name: '청연교회',
  subdomain: 'church',
  orgType: 'CHURCH',
  isActive: true,
};

const membership = {
  id: 'membership-1',
  userId: 'user-1',
  tenantId: 'tenant-2',
  role: 'MEMBER',
  isDefault: false,
  createdAt: new Date('2026-07-18'),
  updatedAt: new Date('2026-07-18'),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyUserToken.mockResolvedValue(null);
  mockVerifyPendingToken.mockResolvedValue(null);
  mockCreateUserToken.mockResolvedValue('new-jwt-token');
  mockCreateUserTokenCookie.mockReturnValue('user_token=new-jwt-token; Path=/; HttpOnly');
  mockAssertMembership.mockResolvedValue(membership);
  mockResubscribe.mockResolvedValue({ moved: 0 });
  mockPrisma.user.findUnique.mockResolvedValue(dbUser);
  mockPrisma.tenant.findUnique.mockResolvedValue(targetTenant);
});

describe('POST /api/auth/switch-tenant (B3)', () => {
  describe('인증', () => {
    it('토큰이 없으면 401', async () => {
      const response = await POST(createSwitchRequest({ tenantId: 'tenant-2' }));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('로그인이 필요합니다.');
      expect(mockCreateUserToken).not.toHaveBeenCalled();
    });

    it('정식/임시 토큰 모두 무효면 401', async () => {
      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'invalid-token' })
      );

      expect(response.status).toBe(401);
      expect(mockCreateUserToken).not.toHaveBeenCalled();
    });

    it('tenantId 누락 시 400', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);

      const response = await POST(createSwitchRequest({}, { bearer: 'valid-token' }));

      expect(response.status).toBe(400);
      expect(mockCreateUserToken).not.toHaveBeenCalled();
    });
  });

  describe('Membership 검증', () => {
    it('미소속 tenantId 요청 시 403 + 토큰 무변경', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);
      mockAssertMembership.mockRejectedValue(new Error('해당 조직에 소속되어 있지 않습니다.'));

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-evil' }, { bearer: 'valid-token' })
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('해당 조직에 소속되어 있지 않습니다.');
      // 토큰 재발급·쿠키 설정 없음
      expect(mockCreateUserToken).not.toHaveBeenCalled();
      expect(mockCreateUserTokenCookie).not.toHaveBeenCalled();
      expect(response.headers.get('Set-Cookie')).toBeNull();
    });

    it('Membership 테이블 미생성(백필 전) 오류도 403으로 거부된다', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);
      mockAssertMembership.mockRejectedValue(new Error('relation "Membership" does not exist'));

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'valid-token' })
      );

      expect(response.status).toBe(403);
      expect(mockCreateUserToken).not.toHaveBeenCalled();
    });
  });

  describe('정식 토큰으로 전환', () => {
    it('소속 조직으로 새 tenantId 클레임 토큰이 재발급된다', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'valid-token' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockAssertMembership).toHaveBeenCalledWith('user-1', 'tenant-2');
      // 새 토큰은 전환 대상 tenantId 클레임으로 발급
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', tenantId: 'tenant-2' })
      );
      expect(data).toEqual({
        success: true,
        message: '조직이 전환되었습니다.',
        user: {
          id: 'user-1',
          userid: 'testuser',
          // 게스트 소속(홈이 아닌 tenant-2)으로 전환 — 역할은 Membership(MEMBER)에서 파생,
          // 홈 부서는 넘기지 않는다 (권한 상승·홈 속성 유출 방지)
          username: '테스트유저',
          role: 'user',
          department: null,
          permissions: {
            canApprove: false,
            canManageExpense: false,
            canAccessAdmin: false,
            canExportData: false,
            canRegisterUsers: false,
          },
        },
        tenant: {
          id: 'tenant-2',
          name: '청연교회',
          subdomain: 'church',
          orgType: 'CHURCH',
        },
        token: 'new-jwt-token',
      });
      // 쿠키도 새 토큰으로 갱신
      expect(mockCreateUserTokenCookie).toHaveBeenCalledWith('new-jwt-token');
      expect(response.headers.get('Set-Cookie')).toContain('new-jwt-token');
    });

    it('전환 성공 시 FCM 토큰/토픽이 새 테넌트로 재구독된다 (B6)', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'valid-token' })
      );

      expect(response.status).toBe(200);
      expect(mockResubscribe).toHaveBeenCalledWith('user-1', 'tenant-2');
    });

    it('미소속(403) 전환 실패 시 FCM 재구독을 호출하지 않는다 (B6)', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);
      mockAssertMembership.mockRejectedValue(
        new Error('해당 조직에 소속되어 있지 않습니다.')
      );

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-evil' }, { bearer: 'valid-token' })
      );

      expect(response.status).toBe(403);
      expect(mockResubscribe).not.toHaveBeenCalled();
    });

    it('쿠키 토큰으로도 동작한다', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { cookie: 'cookie-token' })
      );

      expect(response.status).toBe(200);
      expect(mockVerifyUserToken).toHaveBeenCalledWith('cookie-token');
    });
  });

  describe('선택용 임시 토큰(B2)으로 전환', () => {
    it('임시 토큰 검증 후 정식 토큰이 발급된다', async () => {
      // 정식 토큰 검증은 임시 토큰을 거부(null) → 임시 토큰 검증으로 폴백
      mockVerifyUserToken.mockResolvedValue(null);
      mockVerifyPendingToken.mockResolvedValue({
        id: 'user-1',
        userid: 'testuser',
        username: '테스트유저',
      });

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'pending-token' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockVerifyPendingToken).toHaveBeenCalledWith('pending-token');
      expect(mockAssertMembership).toHaveBeenCalledWith('user-1', 'tenant-2');
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1', tenantId: 'tenant-2' })
      );
      expect(data.token).toBe('new-jwt-token');
    });
  });

  describe('활성 상태 확인', () => {
    it('비활성 사용자는 403', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);
      mockPrisma.user.findUnique.mockResolvedValue({ ...dbUser, isActive: false });

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'valid-token' })
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('계정이 비활성화되어 있습니다. 관리자에게 문의하세요.');
      expect(mockCreateUserToken).not.toHaveBeenCalled();
    });

    it('비활성 테넌트는 403', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);
      mockPrisma.tenant.findUnique.mockResolvedValue({ ...targetTenant, isActive: false });

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'valid-token' })
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('이 조직은 현재 이용할 수 없습니다.');
      expect(mockCreateUserToken).not.toHaveBeenCalled();
    });
  });

  describe('역할 파생 (권한 상승 방지)', () => {
    it('홈 admin이 게스트 테넌트(MEMBER)로 전환하면 admin 권한이 넘어가지 않는다', async () => {
      // 홈 테넌트 admin 사용자 — User.role='admin', roleId·부서 보유
      mockVerifyUserToken.mockResolvedValue({ ...fullSession, role: 'admin' });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...dbUser,
        role: 'admin',
        roleId: 'role-admin',
        tenantId: 'tenant-1', // 홈은 tenant-1
        canRegisterUsers: true,
      });
      // tenant-2에는 MEMBER로만 소속
      mockAssertMembership.mockResolvedValue({ ...membership, role: 'MEMBER' });

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'valid-token' })
      );

      expect(response.status).toBe(200);
      // 새 토큰은 게스트 테넌트 기준: role='user', roleId=null, 부서·개별권한 제거
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-2',
          role: 'user',
          roles: ['user'],
          roleId: null,
          department: null,
          granted: [],
          canAccessAdmin: false,
          canManageExpense: false,
          canRegisterUsers: false,
        })
      );
    });

    it('게스트 테넌트에 TENANT_ADMIN으로 소속되면 admin 역할이 부여된다', async () => {
      mockVerifyUserToken.mockResolvedValue(fullSession);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...dbUser,
        role: 'user',
        tenantId: 'tenant-1',
      });
      mockAssertMembership.mockResolvedValue({ ...membership, role: 'TENANT_ADMIN' });

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'valid-token' })
      );

      expect(response.status).toBe(200);
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-2', role: 'admin', roles: ['admin'] })
      );
    });

    it('홈 테넌트로 전환하면 기존 User.role/부서가 유지된다', async () => {
      // 홈(tenant-2 == User.tenantId)로 전환 — 세밀한 역할 보존
      mockVerifyUserToken.mockResolvedValue({ ...fullSession, role: 'finance_head' });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...dbUser,
        role: 'finance_head',
        roleId: 'role-finance',
        department: '재정팀',
        tenantId: 'tenant-2', // 홈이 곧 전환 대상
      });
      mockAssertMembership.mockResolvedValue({ ...membership, role: 'MEMBER' });

      const response = await POST(
        createSwitchRequest({ tenantId: 'tenant-2' }, { bearer: 'valid-token' })
      );

      expect(response.status).toBe(200);
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-2',
          role: 'finance_head',
          roleId: 'role-finance',
          department: '재정팀',
        })
      );
    });
  });
});
