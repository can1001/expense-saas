import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: '지출결의서 시스템' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '아이디' })).toBeVisible();
    await expect(page.getByLabel('비밀번호')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('should show error for empty userid', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('비밀번호').fill('somepassword');
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page.getByText('아이디를 입력해주세요.')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for empty password', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: '아이디' }).fill('testuser');
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page.getByText('비밀번호를 입력해주세요.')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: '아이디' }).fill('invalid_user');
    await page.getByLabel('비밀번호').fill('wrong_password');

    // Click login and wait for API response
    await Promise.all([
      page.waitForResponse(response =>
        response.url().includes('/api/auth/login') && response.status() === 401
      ),
      page.getByRole('button', { name: '로그인' }).click(),
    ]);

    // Check for error message
    await expect(page.locator('.text-red-600, .bg-red-50').getByText(/아이디 또는 비밀번호|로그인에 실패/)).toBeVisible({ timeout: 5000 });
  });
});
