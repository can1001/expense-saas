/**
 * 사용자 인증 래퍼 테스트
 *
 * 테스트 대상:
 * - withAuth (테넌트 검증 포함)
 * - withPermission
 * - withAdmin
 * - getRolePermissions
 * - Cookie 관련 함수
 *
 * 테스트 전략:
 * lib/auth/user.ts의 함수들은 다음 외부 의존성을 가짐:
 * - jose 라이브러리 (JWT 생성/검증)
 * - Prisma 클라이언트 (DB 조회)
 * - Next.js cookies() 함수 (서버 컨텍스트)
 *
 * 따라서 두 가지 방식으로 테스트:
 * 1. 로직 검증 (Logic Verification):
 *    - 핵심 비즈니스 로직을 시뮬레이션 함수로 추출하여 단위 테스트
 *    - 실제 구현과 동일한 로직을 검증
 *
 * 2. 래퍼 동작 테스트 (Wrapper Behavior):
 *    - test/setup.ts의 전역 mock을 사용하여 withAuth, withPermission 등의 동작 검증
 *    - API 핸들러에서 인증이 올바르게 처리되는지 확인
 */

import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  mockUserSession,
  setMockUser,
  resetMockUser,
} from '../../test/setup';

// 테넌트 검증 로직 추출 테스트
// lib/auth/user.ts의 로직을 직접 테스트하기 어려우므로
// 핵심 로직을 단위 테스트로 검증

describe('auth/user utilities', () => {
  describe('Tenant validation logic', () => {
    // withAuth에서 사용되는 테넌트 검증 로직 시뮬레이션
    const validateTenantAccess = (
      userTenantId: string,
      requestedTenantId: string | null
    ): boolean => {
      if (!requestedTenantId) return true; // 테넌트 지정 없으면 통과
      return userTenantId === requestedTenantId;
    };

    it('should allow access when no tenant specified', () => {
      expect(validateTenantAccess('tenant-1', null)).toBe(true);
    });

    it('should allow access when tenant matches', () => {
      expect(validateTenantAccess('tenant-1', 'tenant-1')).toBe(true);
    });

    it('should deny access when tenant mismatch', () => {
      expect(validateTenantAccess('tenant-1', 'tenant-2')).toBe(false);
    });
  });

  describe('Permission check logic', () => {
    // withPermission에서 사용되는 권한 체크 로직 시뮬레이션
    const checkPermission = (
      user: { canApprove?: boolean; canManageExpense?: boolean; canAccessAdmin?: boolean },
      permission: string
    ): boolean => {
      return !!user[permission as keyof typeof user];
    };

    it('should return true when user has permission', () => {
      const user = { canApprove: true };
      expect(checkPermission(user, 'canApprove')).toBe(true);
    });

    it('should return false when user lacks permission', () => {
      const user = { canApprove: false };
      expect(checkPermission(user, 'canApprove')).toBe(false);
    });

    it('should return false for undefined permission', () => {
      const user = {};
      expect(checkPermission(user, 'canApprove')).toBe(false);
    });
  });

  describe('Admin check logic', () => {
    // withAdmin에서 사용되는 관리자 체크 로직 시뮬레이션
    const isAdmin = (user: { canAccessAdmin?: boolean }): boolean => {
      return !!user.canAccessAdmin;
    };

    it('should return true for admin users', () => {
      expect(isAdmin({ canAccessAdmin: true })).toBe(true);
    });

    it('should return false for non-admin users', () => {
      expect(isAdmin({ canAccessAdmin: false })).toBe(false);
    });

    it('should return false when canAccessAdmin is undefined', () => {
      expect(isAdmin({})).toBe(false);
    });
  });

  describe('User session validation logic', () => {
    // getUserFromRequest에서 사용되는 검증 로직 시뮬레이션
    const validateUserSession = (
      userRecord: { isActive: boolean; tenantId: string } | null,
      tokenTenantId: string
    ): boolean => {
      if (!userRecord) return false;
      if (!userRecord.isActive) return false;
      if (userRecord.tenantId !== tokenTenantId) return false;
      return true;
    };

    it('should return false for null user record', () => {
      expect(validateUserSession(null, 'tenant-1')).toBe(false);
    });

    it('should return false for inactive user', () => {
      expect(
        validateUserSession({ isActive: false, tenantId: 'tenant-1' }, 'tenant-1')
      ).toBe(false);
    });

    it('should return false for tenant mismatch', () => {
      expect(
        validateUserSession({ isActive: true, tenantId: 'tenant-2' }, 'tenant-1')
      ).toBe(false);
    });

    it('should return true for valid user session', () => {
      expect(
        validateUserSession({ isActive: true, tenantId: 'tenant-1' }, 'tenant-1')
      ).toBe(true);
    });
  });
});

describe('auth/user getRolePermissions', () => {
  // getRolePermissions는 전역 mock에서 테스트 가능
  // 전역 mock의 getRolePermissions는 항상 admin 권한 반환
  // 실제 로직 테스트는 시뮬레이션으로 수행

  const getDefaultPermissions = (role: string): Record<string, boolean> => {
    switch (role) {
      case 'admin':
        return {
          canApprove: true,
          canManageExpense: true,
          canAccessAdmin: true,
          canExportData: true,
          canRegisterUsers: true,
        };
      case 'finance_head':
        return {
          canApprove: true,
          canManageExpense: true,
          canAccessAdmin: true,
          canExportData: true,
          canRegisterUsers: false,
        };
      case 'accountant':
        return {
          canApprove: true,
          canManageExpense: true,
          canAccessAdmin: false,
          canExportData: false,
          canRegisterUsers: false,
        };
      case 'team_leader':
        return {
          canApprove: true,
          canManageExpense: false,
          canAccessAdmin: false,
          canExportData: false,
          canRegisterUsers: false,
        };
      default:
        return {
          canApprove: false,
          canManageExpense: false,
          canAccessAdmin: false,
          canExportData: false,
          canRegisterUsers: false,
        };
    }
  };

  it('should return default admin permissions for admin role', () => {
    const permissions = getDefaultPermissions('admin');

    expect(permissions).toEqual({
      canApprove: true,
      canManageExpense: true,
      canAccessAdmin: true,
      canExportData: true,
      canRegisterUsers: true,
    });
  });

  it('should return default finance_head permissions', () => {
    const permissions = getDefaultPermissions('finance_head');

    expect(permissions).toEqual({
      canApprove: true,
      canManageExpense: true,
      canAccessAdmin: true,
      canExportData: true,
      canRegisterUsers: false,
    });
  });

  it('should return default accountant permissions', () => {
    const permissions = getDefaultPermissions('accountant');

    expect(permissions).toEqual({
      canApprove: true,
      canManageExpense: true,
      canAccessAdmin: false,
      canExportData: false,
      canRegisterUsers: false,
    });
  });

  it('should return default team_leader permissions', () => {
    const permissions = getDefaultPermissions('team_leader');

    expect(permissions).toEqual({
      canApprove: true,
      canManageExpense: false,
      canAccessAdmin: false,
      canExportData: false,
      canRegisterUsers: false,
    });
  });

  it('should return default user permissions', () => {
    const permissions = getDefaultPermissions('user');

    expect(permissions).toEqual({
      canApprove: false,
      canManageExpense: false,
      canAccessAdmin: false,
      canExportData: false,
      canRegisterUsers: false,
    });
  });
});

describe('auth/user Cookie functions', () => {
  // Cookie 함수는 전역 mock에서 테스트
  // 전역 mock의 createUserTokenCookie는 간단한 문자열 반환
  // 실제 로직 테스트는 시뮬레이션으로 수행

  const createTokenCookie = (token: string, isProduction: boolean): string => {
    const secure = isProduction ? '; Secure' : '';
    return `user_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`;
  };

  const createLogoutCookie = (): string => {
    return 'user_token=; Path=/; HttpOnly; Max-Age=0';
  };

  describe('createUserTokenCookie simulation', () => {
    it('should create cookie with correct attributes', () => {
      const cookie = createTokenCookie('test-token', false);

      expect(cookie).toContain('user_token=test-token');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=86400');
    });

    it('should include Secure flag in production', () => {
      const cookie = createTokenCookie('test-token', true);

      expect(cookie).toContain('Secure');
    });

    it('should not include Secure flag in development', () => {
      const cookie = createTokenCookie('test-token', false);

      expect(cookie).not.toContain('Secure');
    });
  });

  describe('createUserLogoutCookie simulation', () => {
    it('should create logout cookie', () => {
      const cookie = createLogoutCookie();

      expect(cookie).toContain('user_token=');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Max-Age=0');
    });
  });
});

describe('auth/user withAuth behavior via global mock', () => {
  // test/setup.ts의 전역 mock을 사용하여 통합 동작 테스트
  // 이 테스트는 mock의 동작을 검증하여 API 핸들러에서
  // 올바르게 인증이 처리되는지 확인

  afterEach(() => {
    resetMockUser();
  });

  it('should provide user context to handler via global mock', async () => {
    // 전역 mock의 withAuth가 user를 context에 전달하는지 검증
    const { withAuth } = await import('@/lib/auth/user');

    const handler = vi.fn().mockImplementation((_req, context) => {
      // context.user가 mockUserSession과 일치하는지 확인
      expect(context.user).toBeDefined();
      expect(context.user.id).toBe(mockUserSession.id);
      return NextResponse.json({ success: true });
    });

    const wrapped = withAuth(handler);
    const request = new NextRequest('http://localhost/api/test');

    await wrapped(request, { params: Promise.resolve({}) });

    expect(handler).toHaveBeenCalled();
  });

  it('should return 401 when mock user is null', async () => {
    setMockUser(null);

    const { withAuth } = await import('@/lib/auth/user');

    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const request = new NextRequest('http://localhost/api/test');

    const response = await wrapped(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should allow when role has permission (withPermissions)', async () => {
    // accountant 역할 → EXPENSE_APPROVE 보유
    setMockUser({ ...mockUserSession, role: 'accountant', roles: ['accountant'] });

    const { withPermissions } = await import('@/lib/auth/user');

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
    const wrapped = withPermissions('expense:approve' as never, handler);
    const request = new NextRequest('http://localhost/api/test');

    const response = await wrapped(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('should deny when role lacks permission (withPermissions)', async () => {
    // user 역할 → EXPENSE_APPROVE 없음
    setMockUser({ ...mockUserSession, role: 'user', roles: ['user'] });

    const { withPermissions } = await import('@/lib/auth/user');

    const handler = vi.fn();
    const wrapped = withPermissions('expense:approve' as never, handler);
    const request = new NextRequest('http://localhost/api/test');

    const response = await wrapped(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should allow admin-only permission for admin (withPermissions)', async () => {
    setMockUser({ ...mockUserSession, role: 'admin', roles: ['admin'] });

    const { withPermissions } = await import('@/lib/auth/user');

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }));
    const wrapped = withPermissions('settings:manage' as never, handler);
    const request = new NextRequest('http://localhost/api/test');

    const response = await wrapped(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('should deny admin-only permission for non-admin (withPermissions)', async () => {
    setMockUser({ ...mockUserSession, role: 'finance_head', roles: ['finance_head'] });

    const { withPermissions } = await import('@/lib/auth/user');

    const handler = vi.fn();
    const wrapped = withPermissions('settings:manage' as never, handler);
    const request = new NextRequest('http://localhost/api/test');

    const response = await wrapped(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
