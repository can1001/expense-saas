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

