import { test as base, expect } from '@playwright/test';

// Test user credentials (should exist in test database)
export const TEST_USER = {
  userid: 'testuser',
  password: 'test1234',
};

export const TEST_ADMIN = {
  userid: 'admin',
  password: 'admin1234',
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
