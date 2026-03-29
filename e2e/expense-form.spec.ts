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

  test.skip('항목 추가 및 삭제', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/new');

    // 초기 항목 1개 확인
    await expect(page.getByText('항목 1')).toBeVisible();

    // 항목 추가
    await page.getByRole('button', { name: /항목 추가/i }).click();
    await expect(page.getByText('항목 2')).toBeVisible();

    // 항목 삭제
    const deleteButtons = page.getByRole('button', { name: '삭제' });
    await deleteButtons.last().click();
    await expect(page.getByText('항목 2')).not.toBeVisible();
  });

  test.skip('금액 자동 계산 (단가 × 수량)', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/new');

    // 단가 입력
    const unitPriceInput = page.locator('input').filter({ hasText: /단가/ }).or(page.getByPlaceholder('0').first());
    await unitPriceInput.fill('10000');

    // 수량 입력
    const quantityInput = page.locator('input[type="text"]').nth(1);
    await quantityInput.fill('5');

    // 금액 확인 (10000 × 5 = 50000)
    await expect(page.getByText('50,000')).toBeVisible();
  });

  test.skip('적요 입력 중 Enter 키 폼 제출 방지', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/new');

    // 적요 필드 찾기
    const descriptionInput = page.getByPlaceholder('상세 설명');
    await descriptionInput.fill('테스트 적요');
    await descriptionInput.press('Enter');

    // 폼이 제출되지 않고 페이지 유지 확인
    await expect(page).toHaveURL(/\/expenses\/new/);
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

  test.skip('최대 16개 항목 추가 제한', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/simple/new');

    // 15개 항목 추가 (총 16개)
    for (let i = 0; i < 15; i++) {
      await page.getByRole('button', { name: /항목 추가/i }).click();
    }

    // 16개 항목 확인
    await expect(page.getByText('항목 16')).toBeVisible();

    // 추가 버튼 숨김 확인 (16개 도달 시)
    await expect(page.getByRole('button', { name: /항목 추가/i })).not.toBeVisible();
  });

  test.skip('세목 검색 및 선택', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/simple/new');

    // 세목 검색
    const searchInput = page.getByPlaceholder(/세목명.*검색/i);
    await searchInput.fill('식대');
    await page.waitForTimeout(500);

    // 세목 선택
    const selectBox = page.locator('select').filter({ hasText: /세목을 선택/ });
    const options = await selectBox.locator('option').count();

    if (options > 1) {
      await selectBox.selectOption({ index: 1 });
      // 항/목 자동 채움 확인
      await expect(page.getByText(/예산\(항\)/)).toBeVisible();
    }
  });

  test.skip('은행 정보 입력', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/simple/new');

    // 은행명 입력
    await page.getByLabel(/은행명/).fill('신한은행');

    // 계좌번호 입력
    await page.getByLabel(/계좌번호/).fill('110-123-456789');

    // 예금주 입력
    await page.getByLabel(/예금주/).fill('홍길동');

    // 입력값 확인
    await expect(page.getByLabel(/은행명/)).toHaveValue('신한은행');
    await expect(page.getByLabel(/계좌번호/)).toHaveValue('110-123-456789');
    await expect(page.getByLabel(/예금주/)).toHaveValue('홍길동');
  });

  test.skip('총 청구금액 자동 계산', async ({ page }) => {
    // TODO: 로그인 후 테스트
    await page.goto('/expenses/simple/new');

    // 첫 번째 항목 입력
    await page.locator('input[inputmode="numeric"]').first().fill('10000');
    await page.locator('input[inputmode="numeric"]').nth(1).fill('2');

    // 두 번째 항목 추가
    await page.getByRole('button', { name: /항목 추가/i }).click();

    // 두 번째 항목 입력
    await page.locator('input[inputmode="numeric"]').nth(2).fill('5000');
    await page.locator('input[inputmode="numeric"]').nth(3).fill('3');

    // 총액 확인 (10000×2 + 5000×3 = 35000)
    await expect(page.getByText(/총.*청구금액/)).toBeVisible();
    await expect(page.getByText('35,000')).toBeVisible();
  });
});
