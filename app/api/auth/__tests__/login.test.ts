/**
 * 로그인 API 테스트
 *
 * 테스트 대상:
 * - 로그인 성공/실패
 * - Rate Limiting 동작
 * - 입력 검증
 * - 비활성 사용자 처리
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  resetRateLimitStore,
  checkLoginRateLimit,
  recordLoginFailure,
} from '@/lib/rate-limit';

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
  getRolePermissions: vi.fn().mockResolvedValue({
    canApprove: true,
    canManageExpense: true,
    canAccessAdmin: true,
    canExportData: true,
    canRegisterUsers: false,
  }),
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
import { findTenantBySubdomain } from '@/lib/tenant';
import bcrypt from 'bcryptjs';

const mockPrisma = prismaBase as any;
const mockFindTenant = findTenantBySubdomain as any;
const mockBcrypt = bcrypt as any;

// Helper function to create request
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

describe('POST /api/auth/login', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    mockPrisma.user.findFirst.mockResolvedValue(validUser);
    mockBcrypt.compare.mockResolvedValue(true);
    mockFindTenant.mockResolvedValue(null);
  });

  describe('입력 검증', () => {
    it('userid 없으면 400 에러', async () => {
      const request = createLoginRequest({ password: 'test123' });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('password 없으면 400 에러', async () => {
      const request = createLoginRequest({ userid: 'testuser' });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('잘못된 JSON 형식이면 400 에러', async () => {
      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('인증 실패', () => {
    it('존재하지 않는 사용자 시 401 에러', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const request = createLoginRequest({
        userid: 'nonexistent',
        password: 'test123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('아이디 또는 비밀번호가 올바르지 않습니다.');
    });

    it('비활성 사용자 시 403 에러', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...validUser,
        isActive: false,
      });

      const request = createLoginRequest({
        userid: 'inactive',
        password: 'test123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('계정이 비활성화되어 있습니다. 관리자에게 문의하세요.');
    });

    it('비밀번호 미설정 시 401 에러', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...validUser,
        password: null,
      });

      const request = createLoginRequest({
        userid: 'nopassword',
        password: 'test123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe(
        '비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.'
      );
    });

    it('비밀번호 불일치 시 401 에러', async () => {
      mockBcrypt.compare.mockResolvedValue(false);

      const request = createLoginRequest({
        userid: 'testuser',
        password: 'wrongpassword',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('아이디 또는 비밀번호가 올바르지 않습니다.');
    });
  });

  describe('로그인 성공', () => {
    it('유효한 자격 증명으로 로그인 성공', async () => {
      const request = createLoginRequest({
        userid: 'testuser',
        password: 'correctpassword',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('로그인 성공');
      expect(data.user.userid).toBe('testuser');
      expect(data.token).toBe('mock-jwt-token');
    });

    it('응답에 권한 정보 포함', async () => {
      const request = createLoginRequest({
        userid: 'testuser',
        password: 'correctpassword',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.user.permissions).toEqual({
        canApprove: true,
        canManageExpense: true,
        canAccessAdmin: true,
        canExportData: true,
        canRegisterUsers: false,
      });
    });

    it('응답에 테넌트 정보 포함', async () => {
      const request = createLoginRequest({
        userid: 'testuser',
        password: 'correctpassword',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.tenant).toEqual({
        id: 'tenant-1',
        name: '테스트테넌트',
        subdomain: 'test',
      });
    });

    it('Set-Cookie 헤더 설정', async () => {
      const request = createLoginRequest({
        userid: 'testuser',
        password: 'correctpassword',
      });

      const response = await POST(request);
      const cookie = response.headers.get('Set-Cookie');

      expect(cookie).toContain('user_token=');
    });
  });

  describe('Rate Limiting', () => {
    it('5회 실패 후 429 에러', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const ip = '192.168.1.100';
      const userid = 'testuser';

      // 5회 실패 (rate limit 직접 시뮬레이션)
      const rateLimitKey = `${ip}:${userid}`;
      for (let i = 0; i < 5; i++) {
        recordLoginFailure(rateLimitKey);
      }

      // 6번째 시도
      const request = createLoginRequest(
        { userid, password: 'wrong' },
        { 'x-forwarded-for': ip }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe(
        '로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.'
      );
      expect(data.retryAfter).toBeDefined();
      expect(response.headers.get('Retry-After')).toBeDefined();
    });

    it('다른 userid는 rate limit 영향 없음', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const ip = '192.168.1.100';
      const userid1 = 'user1';
      const userid2 = 'user2';

      // user1로 5회 실패
      const rateLimitKey1 = `${ip}:${userid1}`;
      for (let i = 0; i < 5; i++) {
        recordLoginFailure(rateLimitKey1);
      }

      // user1 차단 확인
      const result1 = checkLoginRateLimit(rateLimitKey1);
      expect(result1.allowed).toBe(false);

      // user2는 영향 없음
      const rateLimitKey2 = `${ip}:${userid2}`;
      const result2 = checkLoginRateLimit(rateLimitKey2);
      expect(result2.allowed).toBe(true);
    });

    it('로그인 성공 시 rate limit 초기화', async () => {
      const ip = '192.168.1.100';
      const userid = 'testuser';
      const rateLimitKey = `${ip}:${userid}`;

      // 4회 실패
      for (let i = 0; i < 4; i++) {
        recordLoginFailure(rateLimitKey);
      }

      // 1회 남음 확인
      let result = checkLoginRateLimit(rateLimitKey);
      expect(result.remainingAttempts).toBe(1);

      // 로그인 성공
      const request = createLoginRequest(
        { userid, password: 'correct' },
        { 'x-forwarded-for': ip }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Rate limit 초기화 확인
      result = checkLoginRateLimit(rateLimitKey);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });

    it('Retry-After 헤더 포함', async () => {
      const ip = '192.168.1.100';
      const userid = 'testuser';
      const rateLimitKey = `${ip}:${userid}`;

      // 5회 실패로 차단
      for (let i = 0; i < 5; i++) {
        recordLoginFailure(rateLimitKey);
      }

      const request = createLoginRequest(
        { userid, password: 'wrong' },
        { 'x-forwarded-for': ip }
      );

      const response = await POST(request);

      expect(response.status).toBe(429);
      const retryAfter = response.headers.get('Retry-After');
      expect(retryAfter).toBeDefined();
      expect(Number(retryAfter)).toBeGreaterThan(0);
      expect(Number(retryAfter)).toBeLessThanOrEqual(900); // 15분
    });
  });

  describe('IP 추출', () => {
    it('x-forwarded-for 헤더 사용', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const request = createLoginRequest(
        { userid: 'testuser', password: 'wrong' },
        { 'x-forwarded-for': '203.0.113.1' }
      );

      await POST(request);

      // 실패가 기록되었는지 확인 (IP:userid 조합)
      const result = checkLoginRateLimit('203.0.113.1:testuser');
      expect(result.remainingAttempts).toBe(4); // 1회 실패로 4회 남음
    });

    it('x-render-client-ip 헤더 우선', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const request = createLoginRequest(
        { userid: 'testuser', password: 'wrong' },
        {
          'x-render-client-ip': '10.0.0.1',
          'x-forwarded-for': '203.0.113.1',
        }
      );

      await POST(request);

      // Render IP가 사용되었는지 확인
      const result1 = checkLoginRateLimit('10.0.0.1:testuser');
      expect(result1.remainingAttempts).toBe(4);

      // x-forwarded-for IP는 사용되지 않음
      const result2 = checkLoginRateLimit('203.0.113.1:testuser');
      expect(result2.remainingAttempts).toBe(5);
    });
  });

  describe('테넌트 검증', () => {
    it('테넌트 헤더로 필터링', async () => {
      mockFindTenant.mockResolvedValue({
        tenantId: 'tenant-1',
        subdomain: 'test',
        name: '테스트테넌트',
        isActive: true,
      });

      const request = createLoginRequest(
        { userid: 'testuser', password: 'password123' },
        { 'x-tenant-subdomain': 'test' }
      );

      await POST(request);

      expect(mockFindTenant).toHaveBeenCalledWith('test');
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        })
      );
    });

    it('비활성 테넌트 시 404 반환', async () => {
      mockFindTenant.mockResolvedValue(null);

      const request = createLoginRequest(
        { userid: 'testuser', password: 'password123' },
        { 'x-tenant-subdomain': 'inactive' }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('존재하지 않거나');
    });

    it('비활성 테넌트 사용자 403 반환', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...validUser,
        tenant: {
          ...validUser.tenant,
          isActive: false,
        },
      });

      const request = createLoginRequest({
        userid: 'testuser',
        password: 'password123',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('이용할 수 없습니다');
    });
  });
});
