/**
 * 로그인 Membership 확장 테스트 (ARC-002 §2.2, B2)
 *
 * 테스트 대상:
 * - Membership 0건/조회 실패 → 기존 User.tenantId 동작 그대로 (백필 전 회귀 방지)
 * - 단일 소속 → Membership의 tenantId로 즉시 토큰 발급
 * - 복수 소속 → 조직 선택 응답 + 선택용 임시 토큰 (최종 토큰 미발급)
 * - 서브도메인 지정 로그인 → 복수 소속이어도 기존처럼 즉시 발급
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { resetRateLimitStore } from '@/lib/rate-limit';

// Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prismaBase: {
    user: {
      findFirst: vi.fn(),
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

// Mock @/lib/services/membership
vi.mock('@/lib/services/membership', () => ({
  getMemberships: vi.fn(),
  membershipRoleToRoleCode: (role: string) =>
    role === 'TENANT_ADMIN' ? 'admin' : 'user',
}));

// Mock @/lib/tenant
vi.mock('@/lib/tenant', () => ({
  findTenantBySubdomain: vi.fn().mockResolvedValue(null),
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
}));

// Import after mocking
import { POST } from '../login/route';
import { prismaBase } from '@/lib/prisma';
import { createUserToken, createUserTokenCookie, createPendingSelectionToken } from '@/lib/auth/user';
import { getMemberships } from '@/lib/services/membership';
import { findTenantBySubdomain } from '@/lib/tenant';
import bcrypt from 'bcryptjs';

const mockPrisma = prismaBase as any;
const mockCreateUserToken = createUserToken as any;
const mockCreateUserTokenCookie = createUserTokenCookie as any;
const mockCreatePendingToken = createPendingSelectionToken as any;
const mockGetMemberships = getMemberships as any;
const mockFindTenant = findTenantBySubdomain as any;
const mockBcrypt = bcrypt as any;

function createLoginRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  userid: 'testuser',
  username: '테스트유저',
  password: 'hashed-password',
  role: 'user',
  roleId: 'role-1',
  department: '개발팀',
  isActive: true,
  canRegisterUsers: false,
  tenant: {
    id: 'tenant-1',
    name: '테스트테넌트',
    subdomain: 'test',
    isActive: true,
  },
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
    tenant: { id: tenantId, name, subdomain: tenantId, orgType, isActive: true },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimitStore();
  mockPrisma.user.findFirst.mockResolvedValue(validUser);
  mockBcrypt.compare.mockResolvedValue(true);
  mockFindTenant.mockResolvedValue(null);
  mockCreateUserToken.mockResolvedValue('mock-jwt-token');
  mockCreateUserTokenCookie.mockReturnValue('user_token=mock-jwt-token; Path=/; HttpOnly');
  mockCreatePendingToken.mockResolvedValue('mock-pending-token');
});

describe('POST /api/auth/login — Membership 확장 (B2)', () => {
  describe('Membership 0건 (백필 전 회귀 방지)', () => {
    it('기존 응답 형태 그대로 로그인된다', async () => {
      mockGetMemberships.mockResolvedValue([]);

      const response = await POST(
        createLoginRequest({ userid: 'testuser', password: 'correct' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      // 기존 계약과 동일 — requiresTenantSelection 등 신규 키 없음
      expect(data).toEqual({
        success: true,
        message: '로그인 성공',
        user: {
          id: 'user-1',
          userid: 'testuser',
          username: '테스트유저',
          role: 'user',
          department: '개발팀',
          permissions: {
            canApprove: false,
            canManageExpense: false,
            canAccessAdmin: false,
            canExportData: false,
            canRegisterUsers: false,
          },
        },
        tenant: {
          id: 'tenant-1',
          name: '테스트테넌트',
          subdomain: 'test',
        },
        token: 'mock-jwt-token',
      });
      // 기존 User.tenantId로 토큰 발급
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' })
      );
      expect(mockCreatePendingToken).not.toHaveBeenCalled();
    });

    it('Membership 조회 실패(테이블 미생성 등)도 기존 동작으로 폴백한다', async () => {
      mockGetMemberships.mockRejectedValue(new Error('relation "Membership" does not exist'));

      const response = await POST(
        createLoginRequest({ userid: 'testuser', password: 'correct' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBe('mock-jwt-token');
      expect(data.requiresTenantSelection).toBeUndefined();
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' })
      );
    });
  });

  describe('단일 소속', () => {
    it('Membership의 tenantId로 즉시 토큰이 발급된다', async () => {
      mockGetMemberships.mockResolvedValue([
        membershipOf('tenant-1', '테스트테넌트', 'COMPANY', 'TENANT_ADMIN'),
      ]);

      const response = await POST(
        createLoginRequest({ userid: 'testuser', password: 'correct' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBe('mock-jwt-token');
      expect(data.requiresTenantSelection).toBeUndefined();
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' })
      );
      expect(mockCreatePendingToken).not.toHaveBeenCalled();
    });

    it('유일 소속이 게스트 테넌트면 홈 역할이 아닌 Membership.role로 발급된다 (권한 상승 방지)', async () => {
      // User.tenantId=tenant-1(홈)이지만 유일 소속은 tenant-2(게스트, MEMBER)
      mockGetMemberships.mockResolvedValue([
        membershipOf('tenant-2', '청연교회', 'CHURCH', 'MEMBER'),
      ]);

      const response = await POST(
        createLoginRequest({ userid: 'testuser', password: 'correct' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      // 토큰은 게스트 테넌트 기준: tenantId=tenant-2, role='user'(MEMBER→user), roleId·부서 제거
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-2',
          role: 'user',
          roles: ['user'],
          roleId: null,
          department: null,
        })
      );
      // 응답 tenant도 게스트 테넌트로 일치 (홈 tenant-1 표시 금지)
      expect(data.tenant).toEqual({ id: 'tenant-2', name: '청연교회', subdomain: 'tenant-2' });
      expect(data.user.department).toBeNull();
    });

    it('홈 admin이 게스트 테넌트에 MEMBER로만 소속되면 admin 권한이 넘어가지 않는다', async () => {
      // 홈(tenant-1)에서 admin인 사용자
      mockPrisma.user.findFirst.mockResolvedValue({ ...validUser, role: 'admin', roleId: 'role-admin' });
      // 유일 소속은 게스트 tenant-2에 MEMBER
      mockGetMemberships.mockResolvedValue([
        membershipOf('tenant-2', '청연교회', 'CHURCH', 'MEMBER'),
      ]);

      await POST(createLoginRequest({ userid: 'testuser', password: 'correct' }));

      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-2', role: 'user', roles: ['user'] })
      );
    });

    it('무소속 + 홈 테넌트 없음(tenantId null)이면 세션을 발급하지 않고 403', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...validUser,
        tenantId: null,
        tenant: null,
      });
      mockGetMemberships.mockResolvedValue([]);

      const response = await POST(
        createLoginRequest({ userid: 'testuser', password: 'correct' })
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('소속 조직을 확인할 수 없습니다. 관리자에게 문의하세요.');
      expect(mockCreateUserToken).not.toHaveBeenCalled();
    });

    it('홈 테넌트가 비활성이어도 활성 소속이 있으면 그 조직으로 로그인된다', async () => {
      // 홈 tenant-1이 비활성화된 사용자
      mockPrisma.user.findFirst.mockResolvedValue({
        ...validUser,
        tenant: { ...validUser.tenant, isActive: false },
      });
      // 활성 테넌트 tenant-2에 소속 (getMemberships는 활성만 반환)
      mockGetMemberships.mockResolvedValue([
        membershipOf('tenant-2', '청연교회', 'CHURCH', 'MEMBER'),
      ]);

      const response = await POST(
        createLoginRequest({ userid: 'testuser', password: 'correct' })
      );

      // 비활성 홈으로 차단되지 않고 활성 소속 tenant-2로 진입
      expect(response.status).toBe(200);
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-2' })
      );
    });
  });

  describe('복수 소속', () => {
    const twoMemberships = [
      membershipOf('tenant-1', '청연컨설팅', 'COMPANY', 'TENANT_ADMIN'),
      membershipOf('tenant-2', '청연교회', 'CHURCH', 'MEMBER'),
    ];

    it('조직 선택 응답 + 선택용 임시 토큰이 발급된다', async () => {
      mockGetMemberships.mockResolvedValue(twoMemberships);

      const response = await POST(
        createLoginRequest({ userid: 'testuser', password: 'correct' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requiresTenantSelection).toBe(true);
      expect(data.memberships).toEqual([
        { tenantId: 'tenant-1', tenantName: '청연컨설팅', orgType: 'COMPANY', role: 'TENANT_ADMIN' },
        { tenantId: 'tenant-2', tenantName: '청연교회', orgType: 'CHURCH', role: 'MEMBER' },
      ]);
      expect(data.token).toBe('mock-pending-token');
    });

    it('최종 토큰은 발급되지 않는다 (switch-tenant에서 발급)', async () => {
      mockGetMemberships.mockResolvedValue(twoMemberships);

      await POST(createLoginRequest({ userid: 'testuser', password: 'correct' }));

      expect(mockCreateUserToken).not.toHaveBeenCalled();
      expect(mockCreatePendingToken).toHaveBeenCalledWith({
        id: 'user-1',
        userid: 'testuser',
        username: '테스트유저',
      });
      // 쿠키도 임시 토큰 + 짧은 만료로 설정
      expect(mockCreateUserTokenCookie).toHaveBeenCalledWith('mock-pending-token', 600);
    });

    it('서브도메인 지정 로그인은 대상 조직이 확정이므로 기존처럼 즉시 발급된다', async () => {
      mockGetMemberships.mockResolvedValue(twoMemberships);
      mockFindTenant.mockResolvedValue({
        tenantId: 'tenant-1',
        subdomain: 'test',
        name: '테스트테넌트',
        isActive: true,
      });

      const response = await POST(
        createLoginRequest(
          { userid: 'testuser', password: 'correct' },
          { 'x-tenant-subdomain': 'test' }
        )
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.requiresTenantSelection).toBeUndefined();
      expect(data.token).toBe('mock-jwt-token');
      expect(mockCreateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' })
      );
      expect(mockCreatePendingToken).not.toHaveBeenCalled();
    });
  });
});
