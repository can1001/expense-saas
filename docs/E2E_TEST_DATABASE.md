# E2E 테스트 데이터베이스 가이드

## 테스트 DB 구성

E2E 테스트는 **별도의 테스트 DB가 없으며**, 개발 환경과 동일한 데이터베이스를 사용합니다.

### Playwright 설정 (`playwright.config.ts`)

```typescript
webServer: {
  command: 'npm run dev',  // 개발 서버 실행
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
},
```

- `npm run dev`로 개발 서버를 실행
- `.env.local` 또는 `.env`에 설정된 `DATABASE_URL` 사용
- **개발 DB = 테스트 DB**

---

## Skipped 테스트

### 원인
`e2e/print.spec.ts` 파일의 Print 관련 테스트들은 **지출결의서 데이터가 없으면 자동으로 스킵**됩니다.

### 스킵 로직

```typescript
// e2e/print.spec.ts
async function navigateToExpenseDetail(page: any): Promise<boolean> {
  await page.goto('/expenses');

  // 지출결의서가 있는지 확인
  const noDataText = page.getByText('등록된 지출결의서가 없습니다.');
  const hasNoData = await noDataText.isVisible({ timeout: 3000 }).catch(() => false);

  if (hasNoData) {
    return false;  // 데이터 없음
  }
  // ...
}

test('should open print preview modal', async ({ page }) => {
  const hasExpense = await navigateToExpenseDetail(page);
  if (!hasExpense) {
    test.skip();  // 데이터 없으면 스킵
    return;
  }
  // ...
});
```

### 스킵되는 테스트 목록 (10개)

| 테스트 그룹 | 테스트명 | 파일 위치 |
|------------|---------|----------|
| Print Preview Modal | should open print preview modal from expense detail | `print.spec.ts:54` |
| Print Preview Modal | should display print options in modal | `print.spec.ts:70` |
| Print Preview Modal | should switch print options | `print.spec.ts:87` |
| Print Preview Modal | should close modal on cancel button click | `print.spec.ts:113` |
| Print Preview Modal | should close modal on X button click | `print.spec.ts:131` |
| Print Preview Modal | should have PDF download button | `print.spec.ts:150` |
| Print Preview Modal | should have print button enabled | `print.spec.ts:167` |
| Print Preview Modal | should display expense info in modal | `print.spec.ts:184` |
| Bulk Print Modal | should show bulk print button when items are selectable | `print.spec.ts:214` |
| Print Options Selector | should have correct default option selected | `print.spec.ts:249` |
| Print Options Selector | should update selection visually when option clicked | `print.spec.ts:265` |

---

## Print 테스트 실행 방법

### 1. 테스트 계정 확인

```typescript
// e2e/print.spec.ts
const TEST_USER = {
  userid: '청연테스트',
  password: 'chc2026',
};
```

### 2. 테스트 데이터 생성

1. 개발 서버 실행: `npm run dev`
2. http://localhost:3000 접속
3. 테스트 계정으로 로그인 (`청연테스트` / `chc2026`)
4. 지출결의서 1개 이상 생성

### 3. E2E 테스트 실행

```bash
npm run test:e2e
```

---

## 테스트 DB 분리 (선택사항)

별도의 테스트 DB를 사용하려면:

### 1. `.env.test` 파일 생성

```bash
DATABASE_URL="postgresql://username:password@host:5432/test_database?sslmode=require"
```

### 2. `playwright.config.ts` 수정

```typescript
webServer: {
  command: 'NODE_ENV=test npm run dev',
  // ...
},
```

### 3. 테스트 전 시드 데이터 추가

```bash
NODE_ENV=test npm run db:seed
```
