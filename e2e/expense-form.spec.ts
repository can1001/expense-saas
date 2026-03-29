import { test, expect } from '@playwright/test';

/**
 * 지출결의서 작성 E2E 테스트
 *
 * 참고: 인증이 필요한 테스트는 테스트 사용자 계정이 필요합니다.
 * 현재 seed 데이터에는 비밀번호가 설정된 사용자가 없으므로,
 * 미인증 상태에서 리다이렉트 동작만 테스트합니다.
 */

test.describe('지출결의서 접근 제어', () => {
  test('미인증 시 일반 지출결의서 페이지 접근 → 로그인 리다이렉트', async ({ page }) => {
    await page.goto('/expenses/new');

    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('미인증 시 간편 지출결의서 페이지 접근 → 로그인 리다이렉트', async ({ page }) => {
    await page.goto('/expenses/simple/new');

    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('미인증 시 지출결의서 목록 페이지 접근 → 로그인 리다이렉트', async ({ page }) => {
    await page.goto('/expenses');

    // 로그인 페이지로 리다이렉트 확인
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

/**
 * 아래 테스트들은 인증된 사용자가 필요합니다.
 * 테스트 환경에 비밀번호가 설정된 사용자를 추가한 후 활성화하세요.
 *
 * 활성화 방법:
 * 1. prisma/seed.ts에서 테스트 사용자 추가 (비밀번호 포함)
 * 2. npm run db:seed 실행
 * 3. test.skip을 test로 변경
 */

test.describe('일반 지출결의서 작성 (인증 필요)', () => {
  test.skip('페이지 표시 확인', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/new');
    await expect(page.getByRole('heading', { name: /새 지출결의서 작성/ })).toBeVisible();
    await expect(page.getByText('예산 정보')).toBeVisible();
    await expect(page.getByText('세부 항목')).toBeVisible();
    await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
  });

  test.skip('필수 항목 누락 시 유효성 검사', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/new');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText(/다음 항목을 확인해주세요|필수/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('간편 지출결의서 작성 (인증 필요)', () => {
  test.skip('페이지 표시 확인', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/simple/new');
    await expect(page.getByRole('heading', { name: /새 지출결의서 작성.*간편/i })).toBeVisible();
    await expect(page.getByText('세부 항목')).toBeVisible();
    await expect(page.getByText('청구 정보')).toBeVisible();
  });

  test.skip('항목 추가 및 삭제', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/simple/new');
    await expect(page.getByText('항목 1')).toBeVisible();
    await page.getByRole('button', { name: /항목 추가/i }).click();
    await expect(page.getByText('항목 2')).toBeVisible();
  });
});
