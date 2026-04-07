import { test, expect, Page } from '@playwright/test';
import {
  TEST_ADMIN,
  TEST_FINANCE_HEAD,
  TEST_ACCOUNTANT,
  TEST_ADMIN_ASSISTANT,
  TEST_USER,
} from './fixtures/auth';

/**
 * 다중 역할(Multi-role) 기반 관리 메뉴 접근 E2E 테스트
 *
 * 테스트 대상:
 * - 관리자(admin): 모든 메뉴 접근 가능
 * - 재정팀장(finance_head + team_leader): 제한된 메뉴 접근 (조직관리, 세목별 담당자, 결산/실적, 수입관리)
 * - 회계(accountant): 제한된 메뉴 접근
 * - 행정간사(admin_assistant): 제한된 메뉴 접근
 * - 일반 사용자(user/team_leader only): 관리 메뉴 접근 불가
 */

// Helper function to login
async function login(page: Page, userid: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder(/아이디/i).fill(userid);
  await page.getByPlaceholder(/비밀번호/i).fill(password);
  await page.getByRole('button', { name: /로그인/i }).click();
  await expect(page).toHaveURL('/', { timeout: 15000 });
  // 헤더가 로드되고 사용자 정보가 반영될 때까지 대기
  await page.waitForLoadState('networkidle');
}

test.describe('Admin Menu Access - Multi-role Support', () => {
  test.describe('Admin user', () => {
    test('should see admin menu in header', async ({ page }) => {
      await login(page, TEST_ADMIN.userid, TEST_ADMIN.password);

      // 헤더 네비게이션이 로드될 때까지 대기
      await page.waitForSelector('header nav', { timeout: 10000 });
      // 헤더에서 관리 메뉴 링크 확인 (href="/admin")
      await expect(page.locator('header nav a[href="/admin"]')).toBeVisible({ timeout: 10000 });
    });

    test('should access admin dashboard', async ({ page }) => {
      await login(page, TEST_ADMIN.userid, TEST_ADMIN.password);

      await page.goto('/admin');
      await expect(page).toHaveURL('/admin');
      // 권한 확인 중 메시지가 사라지고 실제 콘텐츠가 표시되기를 기다림
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });

    test('should access user management page', async ({ page }) => {
      await login(page, TEST_ADMIN.userid, TEST_ADMIN.password);

      await page.goto('/admin/users');
      await expect(page).toHaveURL('/admin/users');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Finance Head (재정팀장) - Multi-role: team_leader + finance_head', () => {
    test('should see admin menu in header', async ({ page }) => {
      await login(page, TEST_FINANCE_HEAD.userid, TEST_FINANCE_HEAD.password);

      // 헤더 네비게이션이 로드될 때까지 대기
      await page.waitForSelector('header nav', { timeout: 10000 });
      // finance_head 역할로 관리 메뉴가 보여야 함 (href="/admin")
      await expect(page.locator('header nav a[href="/admin"]')).toBeVisible({ timeout: 10000 });
    });

    test('should access admin dashboard', async ({ page }) => {
      await login(page, TEST_FINANCE_HEAD.userid, TEST_FINANCE_HEAD.password);

      await page.goto('/admin');
      await expect(page).toHaveURL('/admin');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });

    test('should access committees management page', async ({ page }) => {
      await login(page, TEST_FINANCE_HEAD.userid, TEST_FINANCE_HEAD.password);

      await page.goto('/admin/committees');
      await expect(page).toHaveURL('/admin/committees');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });

    test('should access departments management page', async ({ page }) => {
      await login(page, TEST_FINANCE_HEAD.userid, TEST_FINANCE_HEAD.password);

      await page.goto('/admin/departments');
      await expect(page).toHaveURL('/admin/departments');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });

    test('should access budget-managers page', async ({ page }) => {
      await login(page, TEST_FINANCE_HEAD.userid, TEST_FINANCE_HEAD.password);

      await page.goto('/admin/budget-managers');
      await expect(page).toHaveURL('/admin/budget-managers');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });

    test('should access offerings page', async ({ page }) => {
      await login(page, TEST_FINANCE_HEAD.userid, TEST_FINANCE_HEAD.password);

      await page.goto('/admin/offerings');
      await expect(page).toHaveURL('/admin/offerings');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });

    test('should be redirected when accessing users page (restricted)', async ({ page }) => {
      await login(page, TEST_FINANCE_HEAD.userid, TEST_FINANCE_HEAD.password);

      await page.goto('/admin/users');
      // finance_head는 /admin/users 접근 불가 -> /admin으로 리다이렉트
      await expect(page).toHaveURL('/admin', { timeout: 10000 });
    });
  });

  test.describe('Accountant (회계)', () => {
    test('should see admin menu in header', async ({ page }) => {
      await login(page, TEST_ACCOUNTANT.userid, TEST_ACCOUNTANT.password);

      await page.waitForSelector('header nav', { timeout: 10000 });
      await expect(page.locator('header nav a[href="/admin"]')).toBeVisible({ timeout: 10000 });
    });

    test('should access admin dashboard', async ({ page }) => {
      await login(page, TEST_ACCOUNTANT.userid, TEST_ACCOUNTANT.password);

      await page.goto('/admin');
      await expect(page).toHaveURL('/admin');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });

    test('should access committees management page', async ({ page }) => {
      await login(page, TEST_ACCOUNTANT.userid, TEST_ACCOUNTANT.password);

      await page.goto('/admin/committees');
      await expect(page).toHaveURL('/admin/committees');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });

    test('should be redirected when accessing users page (restricted)', async ({ page }) => {
      await login(page, TEST_ACCOUNTANT.userid, TEST_ACCOUNTANT.password);

      await page.goto('/admin/users');
      // accountant는 /admin/users 접근 불가 -> /admin으로 리다이렉트
      await expect(page).toHaveURL('/admin', { timeout: 10000 });
    });
  });

  test.describe('Admin Assistant (행정간사)', () => {
    test('should see admin menu in header', async ({ page }) => {
      await login(page, TEST_ADMIN_ASSISTANT.userid, TEST_ADMIN_ASSISTANT.password);

      await page.waitForSelector('header nav', { timeout: 10000 });
      await expect(page.locator('header nav a[href="/admin"]')).toBeVisible({ timeout: 10000 });
    });

    test('should access admin dashboard', async ({ page }) => {
      await login(page, TEST_ADMIN_ASSISTANT.userid, TEST_ADMIN_ASSISTANT.password);

      await page.goto('/admin');
      await expect(page).toHaveURL('/admin');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });

    test('should access departments management page', async ({ page }) => {
      await login(page, TEST_ADMIN_ASSISTANT.userid, TEST_ADMIN_ASSISTANT.password);

      await page.goto('/admin/departments');
      await expect(page).toHaveURL('/admin/departments');
      await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Regular User (일반 사용자)', () => {
    test('should not see admin menu in header', async ({ page }) => {
      await login(page, TEST_USER.userid, TEST_USER.password);

      await page.waitForSelector('header nav', { timeout: 10000 });
      // 일반 사용자는 관리 메뉴가 보이지 않아야 함 (href="/admin")
      await expect(page.locator('header nav a[href="/admin"]')).not.toBeVisible({ timeout: 5000 });
    });

    test('should be redirected when trying to access admin page', async ({ page }) => {
      await login(page, TEST_USER.userid, TEST_USER.password);

      await page.goto('/admin');
      // 일반 사용자는 /admin 접근 불가 -> 홈('/')으로 리다이렉트
      await expect(page).toHaveURL('/', { timeout: 10000 });
    });
  });
});

test.describe('Admin Sidebar Menu Filtering', () => {
  test('admin should see all menu groups', async ({ page }) => {
    await login(page, TEST_ADMIN.userid, TEST_ADMIN.password);

    await page.goto('/admin');
    await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });

    // Desktop에서 사이드바 확인 (lg breakpoint 이상)
    await page.setViewportSize({ width: 1280, height: 720 });

    // 조직 관리 그룹 확인
    await expect(page.getByRole('heading', { name: /조직 관리/i })).toBeVisible();
    // 사용자/역할 그룹 확인 (admin만 접근 가능)
    await expect(page.getByRole('heading', { name: /사용자\/역할/i })).toBeVisible();
  });

  test('finance_head should see limited menu groups', async ({ page }) => {
    await login(page, TEST_FINANCE_HEAD.userid, TEST_FINANCE_HEAD.password);

    await page.goto('/admin');
    await expect(page.getByText('권한 확인 중...')).not.toBeVisible({ timeout: 10000 });

    await page.setViewportSize({ width: 1280, height: 720 });

    // 조직 관리 그룹은 보여야 함
    await expect(page.getByRole('heading', { name: /조직 관리/i })).toBeVisible();
    // 사용자/역할 그룹은 보이지 않아야 함
    await expect(page.getByRole('heading', { name: /사용자\/역할/i })).not.toBeVisible();
  });
});

test.describe('API /api/auth/me - Multi-role Response', () => {
  test('should return roles array for finance_head with multiple roles', async ({ page }) => {
    await login(page, TEST_FINANCE_HEAD.userid, TEST_FINANCE_HEAD.password);

    // API 직접 호출
    const response = await page.request.get('/api/auth/me');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.roles).toBeDefined();
    expect(Array.isArray(data.user.roles)).toBe(true);

    // team_leader와 finance_head 역할이 모두 포함되어야 함
    expect(data.user.roles).toContain('team_leader');
    expect(data.user.roles).toContain('finance_head');
  });

  test('should return roles array for accountant', async ({ page }) => {
    await login(page, TEST_ACCOUNTANT.userid, TEST_ACCOUNTANT.password);

    const response = await page.request.get('/api/auth/me');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.user.roles).toBeDefined();
    expect(data.user.roles).toContain('accountant');
  });

  test('should return admin role for admin user', async ({ page }) => {
    await login(page, TEST_ADMIN.userid, TEST_ADMIN.password);

    const response = await page.request.get('/api/auth/me');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.user.roles).toContain('admin');
  });
});
