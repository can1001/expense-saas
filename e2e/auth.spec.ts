import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: '지출결의서 시스템' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '아이디' })).toBeVisible();
    await expect(page.getByLabel('비밀번호')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  });

  test('should show error for empty userid', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('비밀번호').fill('somepassword');
    await page.getByRole('button', { name: '로그인', exact: true }).click();

    await expect(page.getByText('아이디를 입력해주세요.')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for empty password', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: '아이디' }).fill('testuser');
    await page.getByRole('button', { name: '로그인', exact: true }).click();

    await expect(page.getByText('비밀번호를 입력해주세요.')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: '아이디' }).fill('invalid_user');
    await page.getByLabel('비밀번호').fill('wrong_password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();

    // Wait for loading to complete (button text changes back from "로그인 중...")
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeEnabled({ timeout: 15000 });

    // Check for error message in red error box
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
  });
});
