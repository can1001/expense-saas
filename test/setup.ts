/**
 * Vitest 테스트 환경 설정
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';

// 각 테스트 후 자동 cleanup
afterEach(() => {
  cleanup();
});

// Next.js headers 모킹 (cookies, headers 등)
// 기본값은 빈 쿠키 저장소, 각 테스트에서 필요 시 오버라이드 가능
export const mockCookieStore = {
  get: vi.fn().mockReturnValue(undefined),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
  has: vi.fn().mockReturnValue(false),
};

export const mockHeadersStore = {
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
  has: vi.fn().mockReturnValue(false),
  entries: vi.fn().mockReturnValue([]),
  keys: vi.fn().mockReturnValue([]),
  values: vi.fn().mockReturnValue([]),
  forEach: vi.fn(),
  append: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
  headers: vi.fn(() => Promise.resolve(mockHeadersStore)),
}));

// 기본 사용자 세션 모킹
export const mockUserSession = {
  id: 'test-user-id',
  tenantId: 'test-tenant-id',
  userid: 'testuser',
  username: '테스트 사용자',
  role: 'admin',
  roleId: 'test-role-id',
  department: null,
  canApprove: true,
  canManageExpense: true,
  canAccessAdmin: true,
  canExportData: true,
  canRegisterUsers: true,
};

// 기본 인증 모킹 함수 (테스트에서 오버라이드 가능)
let _mockUser: typeof mockUserSession | null = mockUserSession;

export const setMockUser = (user: typeof mockUserSession | null) => {
  _mockUser = user;
};

export const resetMockUser = () => {
  _mockUser = mockUserSession;
};

// @/lib/auth/user 모킹
vi.mock('@/lib/auth/user', () => ({
  withAuth: (handler: any) => async (request: any, context: any) => {
    if (!_mockUser) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    return handler(request, { ...context, user: _mockUser });
  },
  withPermission: (permission: string, handler: any) => async (request: any, context: any) => {
    if (!_mockUser) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    if (!(_mockUser as any)[permission]) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: '이 작업을 수행할 권한이 없습니다.' }, { status: 403 });
    }
    return handler(request, { ...context, user: _mockUser });
  },
  withAdmin: (handler: any) => async (request: any, context: any) => {
    if (!_mockUser) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    if (!_mockUser.canAccessAdmin) {
      const { NextResponse } = await import('next/server');
      return NextResponse.json({ error: '이 작업을 수행할 권한이 없습니다.' }, { status: 403 });
    }
    return handler(request, { ...context, user: _mockUser });
  },
  getUserFromRequest: vi.fn(async () => _mockUser),
  verifyUserToken: vi.fn(async () => _mockUser),
  createUserToken: vi.fn(async () => 'mock-user-token'),
  createUserTokenCookie: vi.fn(() => 'user_token=mock; Path=/; HttpOnly'),
  createUserLogoutCookie: vi.fn(() => 'user_token=; Path=/; HttpOnly; Max-Age=0'),
  getRolePermissions: vi.fn(async () => ({
    canApprove: true,
    canManageExpense: true,
    canAccessAdmin: true,
    canExportData: true,
    canRegisterUsers: true,
  })),
}));

// Next.js 라우터 모킹
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// fetch 모킹 (글로벌)
global.fetch = vi.fn();

// console 경고 숨기기 (테스트 출력 깔끔하게)
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.warn = (...args: any[]) => {
    // React 18+ hydration 경고 무시
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
      return;
    }
    originalConsoleWarn(...args);
  };

  console.error = (...args: any[]) => {
    // React 18+ 에러 경고 무시
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) {
      return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

