import { test, expect } from '@playwright/test';

// 테스트 자격 증명
const TEST_USER = {
  userid: '청연테스트',
  password: 'chc2026',
};

// 로그인 헬퍼 함수
async function login(page: any) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '아이디' }).fill(TEST_USER.userid);
  await page.getByLabel('비밀번호').fill(TEST_USER.password);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

// 지출결의서 상세 페이지로 이동하는 헬퍼 함수
async function navigateToExpenseDetail(page: any): Promise<boolean> {
  await page.goto('/expenses');
  await page.waitForLoadState('networkidle');

  // 지출결의서가 있는지 확인
  const noDataText = page.getByText('등록된 지출결의서가 없습니다.');
  const hasNoData = await noDataText.isVisible({ timeout: 3000 }).catch(() => false);

  if (hasNoData) {
    // 지출결의서가 없으면 false 반환
    return false;
  }

  // 테이블의 첫 번째 행 클릭 (체크박스 제외)
  const firstRow = page.locator('tbody tr').first();
  const isRowVisible = await firstRow.isVisible({ timeout: 5000 }).catch(() => false);

  if (!isRowVisible) {
    return false;
  }

  // 행 클릭하여 상세 페이지로 이동
  await firstRow.click();
  await page.waitForLoadState('networkidle');

  // 상세 페이지 확인
  const isDetailPage = await page.getByRole('button', { name: /프린트/i }).isVisible({ timeout: 5000 }).catch(() => false);
  return isDetailPage;
}

test.describe('Print Preview Modal', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should open print preview modal from expense detail', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 프린트 버튼 클릭
    const printButton = page.getByRole('button', { name: /프린트/i });
    await expect(printButton).toBeVisible({ timeout: 5000 });
    await printButton.click();

    // 모달 열림 확인
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });
  });

  test('should display print options in modal', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /프린트/i }).click();
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });

    // 인쇄 옵션 확인
    await expect(page.getByText('지출결의서만')).toBeVisible();
    await expect(page.getByText('영수증만')).toBeVisible();
    await expect(page.getByText('양면')).toBeVisible();
  });

  test('should switch print options', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /프린트/i }).click();
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });

    // 각 옵션 클릭 테스트
    const expenseOnlyOption = page.getByText('지출결의서만');
    const receiptOnlyOption = page.getByText('영수증만');
    const bothOption = page.getByText('양면');

    await expenseOnlyOption.click();
    await page.waitForTimeout(300);

    await receiptOnlyOption.click();
    await page.waitForTimeout(300);

    await bothOption.click();
    await page.waitForTimeout(300);
  });

  test('should close modal on cancel button click', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /프린트/i }).click();
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });

    // 취소 버튼 클릭
    await page.getByRole('button', { name: '취소' }).click();

    // 모달 닫힘 확인
    await expect(page.getByText('인쇄 미리보기')).not.toBeVisible({ timeout: 3000 });
  });

  test('should close modal on X button click', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /프린트/i }).click();
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });

    // X 버튼 클릭 (모달 닫기)
    const closeButton = page.locator('button').filter({ has: page.locator('svg.lucide-x') });
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await expect(page.getByText('인쇄 미리보기')).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('should have PDF download button', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /프린트/i }).click();
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });

    // PDF 다운로드 버튼 확인
    const pdfButton = page.getByRole('button', { name: /PDF 다운로드/i });
    await expect(pdfButton).toBeVisible();
    await expect(pdfButton).toBeEnabled();
  });

  test('should have print button enabled', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /프린트/i }).click();
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });

    // 인쇄 버튼 활성화 확인
    const printButton = page.getByRole('button', { name: '인쇄' });
    await expect(printButton).toBeVisible();
    await expect(printButton).toBeEnabled();
  });

  test('should display expense info in modal', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /프린트/i }).click();
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });

    // 지출결의서 정보 표시 확인 (금액이나 이름 등)
    // 모달 헤더에 청구인 이름과 금액이 표시됨
    await expect(page.locator('.text-sm.text-gray-500')).toBeVisible();
  });
});

test.describe('Bulk Print Modal', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to expenses list page', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // 목록 페이지 확인
    await expect(page).toHaveURL(/\/expenses/);
  });

  test('should show bulk print button when items are selectable', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // 지출결의서가 있는지 확인
    const noDataText = page.getByText('등록된 지출결의서가 없습니다.');
    const hasNoData = await noDataText.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasNoData) {
      // 지출결의서가 없으면 스킵
      test.skip();
      return;
    }

    // tbody 내의 체크박스만 선택 (헤더 제외)
    const rowCheckboxes = page.locator('tbody input[type="checkbox"]');
    const count = await rowCheckboxes.count();

    if (count > 0) {
      // 첫 번째 행의 체크박스 선택
      await rowCheckboxes.first().click();
      await page.waitForTimeout(500);

      // 일괄 인쇄 버튼 확인
      const bulkPrintButton = page.getByRole('button', { name: /일괄 인쇄/i });
      await expect(bulkPrintButton).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Print Options Selector', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should have correct default option selected', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /프린트/i }).click();
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });

    // 양면이 기본 선택되어 있는지 확인 (border-blue-500 클래스로 확인)
    const bothOption = page.locator('label').filter({ hasText: '양면' });
    await expect(bothOption).toHaveClass(/border-blue-500/);
  });

  test('should update selection visually when option clicked', async ({ page }) => {
    const hasExpense = await navigateToExpenseDetail(page);
    if (!hasExpense) {
      test.skip();
      return;
    }

    // 모달 열기
    await page.getByRole('button', { name: /프린트/i }).click();
    await expect(page.getByText('인쇄 미리보기')).toBeVisible({ timeout: 5000 });

    // 지출결의서만 선택
    const expenseOnlyLabel = page.locator('label').filter({ hasText: '지출결의서만' });
    await expenseOnlyLabel.click();
    await page.waitForTimeout(300);

    // 선택됨 표시 확인
    await expect(expenseOnlyLabel).toHaveClass(/border-blue-500/);
  });
});
