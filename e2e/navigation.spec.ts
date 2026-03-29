import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display offline page', async ({ page }) => {
    await page.goto('/offline');

    await expect(page.getByRole('heading', { name: '오프라인 상태입니다' })).toBeVisible();
  });

  test('should display privacy page', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page.getByRole('heading', { name: '개인정보처리방침', exact: true })).toBeVisible();
  });
});
