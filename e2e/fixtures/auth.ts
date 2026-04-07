import { test as base, expect } from '@playwright/test';

// Test user credentials (should exist in test database)
// Default password: chc2026

export const TEST_USER = {
  userid: 'testuser',
  password: 'test1234',
};

export const TEST_ADMIN = {
  userid: '청연관리자',
  password: 'chc2026',
};

// 다중 역할 테스트용 사용자
export const TEST_FINANCE_HEAD = {
  userid: '청연윤운문',
  password: 'chc2026',
  // roles: ['team_leader', 'finance_head']
};

export const TEST_ACCOUNTANT = {
  userid: '청연정혜종',
  password: 'chc2026',
  // roles: ['accountant']
};

export const TEST_ADMIN_ASSISTANT = {
  userid: '청연송원경',
  password: 'chc2026',
  // roles: ['admin_assistant']
};

export const TEST_FINANCE_MEMBER = {
  userid: '청연재정팀원',
  password: 'chc2026',
  // roles: ['finance_member']
};

// Extend base test with authentication
export const test = base.extend<{ authenticatedPage: typeof base }>({
  authenticatedPage: async ({ page }, useBase) => {
    // Login before test
    await page.goto('/login');
    await page.getByPlaceholder(/아이디/i).fill(TEST_USER.userid);
    await page.getByPlaceholder(/비밀번호/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /로그인/i }).click();

    // Wait for redirect to home
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await useBase(base);
  },
});

export { expect };
