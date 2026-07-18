import { test, expect, Page } from '@playwright/test';

/**
 * 지출결의서 작성 E2E 테스트
 */

const TEST_USER = {
  userid: '청연테스트',
  password: 'chc2026',
};

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '아이디' }).fill(TEST_USER.userid);
  await page.getByLabel('비밀번호').fill(TEST_USER.password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL('/', { timeout: 15000 });
}

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

test.describe('일반 지출결의서 작성', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('페이지 표시 확인', async ({ page }) => {
    await page.goto('/expenses/new');
    await expect(page.getByRole('heading', { name: /새 지출결의서 작성/ })).toBeVisible();
    await expect(page.getByText('예산 정보')).toBeVisible();
    await expect(page.getByText('세부 항목')).toBeVisible();
    // "저장된 계좌" 탭과 구분하기 위해 type="submit" 조건 추가
    await expect(page.locator('button[type="submit"]').filter({ hasText: '임시저장' }).first()).toBeVisible();
  });

  test('필수 항목 누락 시 유효성 검사', async ({ page }) => {
    await page.goto('/expenses/new');
    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');

    // 임시저장 버튼 클릭
    const saveButton = page.locator('button[type="submit"]').filter({ hasText: '임시저장' }).first();
    await saveButton.click();

    // 폼 제출이 실패하면 페이지에 남아있어야 함 (성공 시 리다이렉트됨)
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/expenses\/new/);

    // 버튼이 "임시저장 중..."이 아닌 "임시저장" 상태로 돌아와야 함
    await expect(saveButton).toHaveText('임시저장', { timeout: 5000 });
  });

  test('항목 추가 및 삭제', async ({ page }) => {
    await page.goto('/expenses/new');

    // 초기 항목 1개 확인 (항목 번호 뱃지 - 둥근 아이콘)
    const itemBadges = page.locator('span.rounded-full.bg-blue-500');
    await expect(itemBadges.first()).toBeVisible();
    const initialCount = await itemBadges.count();

    // 항목 추가
    await page.getByRole('button', { name: /항목 추가/i }).click();
    await expect(itemBadges).toHaveCount(initialCount + 1);

    // 항목 삭제
    const visibleDeleteButtons = page.getByRole('button').filter({ hasText: '삭제' });
    if (await visibleDeleteButtons.count() > 0) {
      await visibleDeleteButtons.last().click();
      await expect(itemBadges).toHaveCount(initialCount);
    }
  });

  test('금액 자동 계산 (단가 × 수량)', async ({ page }) => {
    await page.goto('/expenses/new');
    await page.waitForLoadState('networkidle');

    // 첫 번째 항목 내의 입력 필드 선택
    const firstItem = page.locator('.border.border-gray-200.rounded-lg').first();
    const numericInputs = firstItem.locator('input[inputmode="numeric"]');

    // 단가 입력 (첫 번째 numeric 필드)
    await numericInputs.first().fill('10000');

    // 수량 입력 (두 번째 numeric 필드)
    await numericInputs.nth(1).fill('5');

    // 자동 계산 대기
    await page.waitForTimeout(500);

    // 금액 확인 (10000 × 5 = 50000) - 항목 내 금액 표시 영역에서 확인
    await expect(firstItem.getByText(/50,000/)).toBeVisible({ timeout: 5000 });
  });

  test('적요 입력 중 Enter 키 폼 제출 방지', async ({ page }) => {
    await page.goto('/expenses/new');

    // 적요 필드 찾기
    const descriptionInput = page.getByPlaceholder('상세 설명');
    await descriptionInput.fill('테스트 적요');
    await descriptionInput.press('Enter');

    // 폼이 제출되지 않고 페이지 유지 확인
    await expect(page).toHaveURL(/\/expenses\/new/);
  });
});

test.describe('간편 지출결의서 작성', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('페이지 표시 확인', async ({ page }) => {
    await page.goto('/expenses/simple/new');
    // 2단계 마법사 UI — Step 1: 세부 항목, Step 2: 청구 정보
    await expect(page.getByRole('heading', { name: '간편 지출결의서' })).toBeVisible();
    await expect(page.getByText('세부 항목')).toBeVisible();
    await expect(page.getByText('총 청구금액')).toBeVisible();
  });

  test('항목 추가 및 삭제', async ({ page }) => {
    await page.goto('/expenses/simple/new');
    await expect(page.getByText('항목 1')).toBeVisible();
    await page.getByRole('button', { name: /항목 추가/i }).click();
    await expect(page.getByText('항목 2')).toBeVisible();
  });

  test('최대 16개 항목 추가 제한', async ({ page }) => {
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

  test('세목 검색 및 선택', async ({ page }) => {
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

  test('은행 정보 입력', async ({ page }) => {
    await page.goto('/expenses/simple/new');

    // Step 1 필수 항목(세목·적요·단가·수량)을 채워야 Step 2(은행 정보)로 이동 가능
    const searchInput = page.getByPlaceholder(/세목명.*검색/i);
    await searchInput.fill('식대');
    await page.waitForTimeout(500);
    const selectBox = page.locator('select').filter({ hasText: /세목을 선택/ });
    await selectBox.selectOption({ index: 1 });
    await page.getByPlaceholder('예: 11월분 식대').fill('E2E 테스트 식대');
    await page.locator('input[type="text"][inputmode="numeric"]').first().fill('10000');
    await page.locator('input[type="number"]').first().fill('1');
    await page.getByRole('button', { name: /다음/ }).click();

    // "직접 입력" 탭 클릭 (저장된 계좌가 아닌 직접 입력 모드로 전환)
    await page.getByRole('button', { name: '직접 입력' }).click();

    // 은행명 입력 (placeholder로 필드 찾기)
    const bankNameInput = page.getByPlaceholder('예: 국민은행');
    await bankNameInput.fill('신한은행');

    // 계좌번호 입력
    const accountNumberInput = page.getByPlaceholder('숫자만 입력');
    await accountNumberInput.fill('110-123-456789');

    // 예금주 입력
    const accountHolderInput = page.getByPlaceholder('예금주 이름');
    await accountHolderInput.fill('홍길동');

    // 입력값 확인
    await expect(bankNameInput).toHaveValue('신한은행');
    await expect(accountNumberInput).toHaveValue('110-123-456789');
    await expect(accountHolderInput).toHaveValue('홍길동');
  });

  test('총 청구금액 자동 계산', async ({ page }) => {
    await page.goto('/expenses/simple/new');
    await page.waitForLoadState('networkidle');

    // 각 항목을 항목 컨테이너 기준으로 선택
    const items = page.locator('.border.border-gray-200.rounded-lg');

    // 첫 번째 항목 입력 (단가: numeric, 수량: number type)
    const firstItem = items.first();
    // 수량(input[type=number])도 inputmode=numeric 이므로 단가는 type=text 로 한정
    await firstItem.locator('input[type="text"][inputmode="numeric"]').fill('10000');
    await firstItem.locator('input[type="number"]').fill('2');

    // 자동 계산 대기
    await page.waitForTimeout(300);

    // 두 번째 항목 추가
    await page.getByRole('button', { name: /항목 추가/i }).click();
    await page.waitForTimeout(300);

    // 두 번째 항목 입력
    const secondItem = items.nth(1);
    await secondItem.locator('input[type="text"][inputmode="numeric"]').fill('5000');
    await secondItem.locator('input[type="number"]').fill('3');

    // 자동 계산 대기
    await page.waitForTimeout(500);

    // 총액 확인 (10000×2 + 5000×3 = 35000)
    await expect(page.getByText(/총.*청구금액/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/35,000/)).toBeVisible({ timeout: 5000 });
  });
});
