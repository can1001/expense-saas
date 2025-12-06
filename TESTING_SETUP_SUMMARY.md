# 테스트 환경 구축 완료 보고서

## 개요

hmg-event-ui-sandbox 프로젝트의 테스트 환경을 참고하여 expense-system 프로젝트에 완전한 테스트 환경을 구축했습니다. 이제 배포 전에 오류를 미리 발견하고 수정할 수 있습니다.

---

## 구축된 환경

### 1. 테스트 프레임워크

| 항목 | 기술 | 버전 |
|------|------|------|
| 테스트 러너 | Vitest | 4.0.15 |
| 테스트 환경 | jsdom | 27.2.0 |
| 테스트 라이브러리 | @testing-library/react | 16.3.0 |
| 어설션 | @testing-library/jest-dom | 6.9.1 |
| 사용자 이벤트 | @testing-library/user-event | 14.6.1 |
| UI 모드 | @vitest/ui | 4.0.15 |
| 커버리지 | @vitest/coverage-v8 | 4.0.15 |

### 2. 설정 파일

#### `vitest.config.ts`
```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
```

#### `test/setup.ts`
- Next.js 라우터 모킹
- fetch 글로벌 모킹
- React 경고 숨김 처리
- 자동 cleanup 설정

---

## 사용 가능한 명령어

### 기본 테스트 실행

```bash
# Watch mode (개발 중)
npm run test

# 단일 실행 (CI/CD)
npm run test -- --run

# UI 모드
npm run test:ui

# 커버리지 리포트
npm run test:coverage
```

### 특정 파일만 테스트

```bash
# 파일명으로 필터링
npm run test -- file-validation

# 경로로 실행
npm run test -- lib/constants/__tests__/file-validation.test.ts
```

---

## 작성된 테스트

### ✅ 51개 테스트 (모두 통과)

#### 1. 파일 검증 테스트 (20개)
**파일**: `lib/constants/__tests__/file-validation.test.ts`

**테스트 항목**:
- FILE_VALIDATION 상수 검증 (4개)
- isAllowedMimeType() (2개)
- isAllowedExtension() (3개)
- isAllowedFormat() (3개)
- isValidFileSize() (4개)
- formatFileSize() (4개)

**커버리지**: 100%

#### 2. ID 검증 테스트 (14개)
**파일**: `lib/validators/__tests__/id-validator.test.ts`

**테스트 항목**:
- isCuid() (2개)
- validateId() (4개)
- validateExpenseId() (2개)
- validateAttachmentId() (2개)
- validatePublicId() (4개)

**커버리지**: 77%

#### 3. Zod 스키마 테스트 (17개)
**파일**: `lib/schemas/__tests__/expense-schema.test.ts`

**테스트 항목**:
- expenseItemSchema (4개)
- expenseFormSchema (7개)
- calculateAmount() (4개)
- calculateTotalAmount() (2개)

**커버리지**: 100%

---

## 현재 커버리지 현황

### 전체 프로젝트

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|----------
All files          |   44.44 |    32.05 |   60.71 |   43.15
```

### 모듈별 상세

| 모듈 | Statements | Branches | Functions | Lines | 상태 |
|------|-----------|----------|-----------|-------|------|
| **constants/** | 100% | 100% | 100% | 100% | ✅ 완료 |
| **schemas/** | 100% | 100% | 100% | 100% | ✅ 완료 |
| **validators/** | 77% | 81% | 71% | 80% | 🟡 양호 |
| **api/** | 7% | 2% | 10% | 7% | 🔴 추가 필요 |

---

## 배포 전 오류 발견 예시

### 1. 타입 체크로 오류 발견

**실행**:
```bash
npx tsc --noEmit
```

**발견 가능한 오류**:
- 타입 불일치
- 존재하지 않는 속성 접근
- 필수 파라미터 누락
- Import 경로 오류

### 2. 단위 테스트로 로직 오류 발견

**예제**:
```typescript
// 잘못된 구현
function calculateAmount(unitPrice: number, quantity: number) {
  return unitPrice * quantity; // 10으로 나누기 누락!
}

// 테스트로 발견
it('should divide by 10 and round down', () => {
  expect(calculateAmount(155, 1)).toBe(10); // FAIL! 155가 반환됨
});
```

### 3. 커버리지로 미테스트 코드 발견

**리포트**:
```
File: api/error-handler.ts
Uncovered Lines: 38-238
Coverage: 7.4%
```

→ 에러 핸들러의 대부분이 테스트되지 않음을 발견

---

## CI/CD 통합 예제

### GitHub Actions

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm ci
      - run: npm run test -- --run
      - run: npm run test:coverage
```

### Vercel 배포 전 체크

`vercel.json`:
```json
{
  "buildCommand": "npm run test -- --run && npm run build"
}
```

또는 `package.json`:
```json
{
  "scripts": {
    "build": "npm run test -- --run && next build"
  }
}
```

---

## 배포 전 체크리스트

### 필수 체크

```bash
# 1. 모든 테스트 통과 확인
npm run test -- --run
# ✅ Test Files  3 passed (3)
# ✅ Tests  51 passed (51)

# 2. 타입 체크
npx tsc --noEmit
# ✅ No errors found

# 3. 린트 체크
npm run lint
# ✅ No linting errors

# 4. 빌드 테스트
npm run build
# ✅ Build completed successfully
```

### 권장 체크

```bash
# 커버리지 확인 (60% 목표)
npm run test:coverage

# UI 모드로 테스트 상태 확인
npm run test:ui
```

---

## 다음 단계

### 우선순위 1: API 에러 핸들러 테스트 (현재 7%)

```typescript
// lib/api/__tests__/error-handler.test.ts 작성
describe('handleApiError', () => {
  it('should handle ApiError correctly');
  it('should handle Prisma P2002 error');
  it('should handle Prisma P2025 error');
  it('should handle Cloudinary errors');
  it('should handle JSON parsing errors');
});
```

### 우선순위 2: 파일 서비스 테스트

```typescript
// lib/services/__tests__/file-service.test.ts 작성
describe('uploadFiles', () => {
  it('should upload files in parallel');
  it('should handle partial failures');
  it('should rollback on error');
});
```

### 우선순위 3: 컴포넌트 테스트

```typescript
// components/__tests__/ExpenseForm.test.tsx 작성
describe('ExpenseForm', () => {
  it('should render form correctly');
  it('should submit with valid data');
  it('should show validation errors');
});
```

### 우선순위 4: API 라우트 통합 테스트

```typescript
// app/api/upload/__tests__/route.test.ts 작성
describe('POST /api/upload', () => {
  it('should upload file successfully');
  it('should reject invalid file types');
  it('should reject oversized files');
});
```

---

## 장점

### 1. 배포 전 오류 발견

- **타입 에러**: 컴파일 타임에 발견
- **로직 에러**: 테스트 실행 시 발견
- **회귀 버그**: 기존 테스트가 실패하면 즉시 발견

### 2. 리팩토링 안전성

- 코드 변경 후 `npm run test`로 즉시 검증
- 기존 기능이 깨지지 않았는지 확인
- 자신감 있는 코드 수정 가능

### 3. 문서화 효과

- 테스트 코드가 사용 예제가 됨
- 함수의 예상 동작을 명확히 보여줌
- 새로운 팀원의 이해도 향상

### 4. 코드 품질 향상

- 테스트하기 쉬운 코드 = 좋은 코드
- 의존성 분리 촉진
- 단일 책임 원칙 준수 유도

---

## 참고: hmg-event-ui-sandbox와의 비교

| 항목 | hmg-event-ui-sandbox | expense-system |
|------|----------------------|----------------|
| 테스트 러너 | Vitest | Vitest ✅ |
| 환경 | jsdom | jsdom ✅ |
| UI 모드 | ✅ | ✅ |
| 커버리지 | v8 | v8 ✅ |
| 설정 방식 | vitest.config.ts | vitest.config.ts ✅ |
| 테스트 수 | - | 51개 |
| 커버리지 | - | 44% (목표 60%) |

---

## 결론

✅ **완전한 테스트 환경 구축 완료**

이제 다음 명령어로 배포 전에 오류를 미리 발견할 수 있습니다:

```bash
# 개발 중
npm run test

# 배포 전
npm run test -- --run && npm run build
```

**작성된 파일**:
- `vitest.config.ts` - Vitest 설정
- `test/setup.ts` - 테스트 환경 설정
- `lib/constants/__tests__/file-validation.test.ts` - 20개 테스트
- `lib/validators/__tests__/id-validator.test.ts` - 14개 테스트
- `lib/schemas/__tests__/expense-schema.test.ts` - 17개 테스트
- `TESTING_GUIDE.md` - 테스트 가이드 문서
- `.gitignore` - 테스트 결과 파일 제외

**총 51개 테스트 작성 및 통과 ✅**

향후 추가 테스트 작성을 통해 커버리지 60% 목표 달성 예정입니다.
