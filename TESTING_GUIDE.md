# 테스트 가이드

## 개요

이 프로젝트는 Vitest를 사용하여 배포 전 오류를 미리 발견하고 코드 품질을 보장합니다.

## 테스트 환경

### 설치된 패키지

```json
{
  "devDependencies": {
    "vitest": "^4.0.15",
    "@vitest/ui": "^4.0.15",
    "@vitest/coverage-v8": "^4.0.15",
    "jsdom": "^27.2.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/user-event": "^14.6.1"
  }
}
```

### 테스트 스크립트

```bash
# 일반 테스트 실행 (watch mode)
npm run test

# 단일 실행 (CI/CD용)
npm run test -- --run

# UI 모드로 테스트 실행
npm run test:ui

# 커버리지 리포트 생성
npm run test:coverage
```

---

## 테스트 구조

```
expense-system/
├── test/
│   └── setup.ts                     # Vitest 환경 설정
├── lib/
│   ├── constants/
│   │   └── __tests__/
│   │       └── file-validation.test.ts
│   ├── validators/
│   │   └── __tests__/
│   │       └── id-validator.test.ts
│   └── schemas/
│       └── __tests__/
│           └── expense-schema.test.ts
└── vitest.config.ts                 # Vitest 설정
```

---

## 현재 테스트 커버리지

### 전체 커버리지 (2024-12-05 기준)

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|----------
All files          |   44.44 |    32.05 |   60.71 |   43.15
 constants/        |     100 |      100 |     100 |     100
 schemas/          |     100 |      100 |     100 |     100
 validators/       |   77.27 |    81.81 |   71.42 |   80.95
 api/              |     7.4 |        2 |      10 |     7.4
```

### 목표 커버리지 (vitest.config.ts)

```typescript
thresholds: {
  lines: 60,
  functions: 60,
  branches: 60,
  statements: 60,
}
```

---

## 작성된 테스트

### ✅ 1. 파일 검증 테스트 (`lib/constants/__tests__/file-validation.test.ts`)

**커버리지**: 100% (20개 테스트)

**테스트 항목**:
- `FILE_VALIDATION` 상수 검증
- `isAllowedMimeType()` - MIME 타입 검증
- `isAllowedExtension()` - 파일 확장자 검증
- `isAllowedFormat()` - 이미지 포맷 검증
- `isValidFileSize()` - 파일 크기 검증
- `formatFileSize()` - 파일 크기 포맷팅

**실행 방법**:
```bash
npm run test -- lib/constants/__tests__/file-validation.test.ts
```

---

### ✅ 2. ID 검증 테스트 (`lib/validators/__tests__/id-validator.test.ts`)

**커버리지**: 77% (14개 테스트)

**테스트 항목**:
- `isCuid()` - CUID 형식 검증
- `validateId()` - 일반 ID 검증
- `validateExpenseId()` - 지출결의서 ID 검증
- `validateAttachmentId()` - 첨부파일 ID 검증
- `validatePublicId()` - Cloudinary publicId 검증

**실행 방법**:
```bash
npm run test -- lib/validators/__tests__/id-validator.test.ts
```

---

### ✅ 3. Zod 스키마 테스트 (`lib/schemas/__tests__/expense-schema.test.ts`)

**커버리지**: 100% (17개 테스트)

**테스트 항목**:
- `expenseItemSchema` - 세부 항목 스키마 검증
- `expenseFormSchema` - 폼 스키마 검증
- `calculateAmount()` - 금액 계산 함수
- `calculateTotalAmount()` - 총액 계산 함수

**실행 방법**:
```bash
npm run test -- lib/schemas/__tests__/expense-schema.test.ts
```

---

## 테스트 작성 가이드

### 1. 테스트 파일 생성

테스트 파일은 `__tests__` 디렉토리에 `*.test.ts` 또는 `*.test.tsx` 형식으로 작성합니다.

```typescript
// lib/utils/__tests__/helper.test.ts
import { describe, it, expect } from 'vitest';
import { helperFunction } from '../helper';

describe('helperFunction', () => {
  it('should work correctly', () => {
    expect(helperFunction('input')).toBe('expected');
  });
});
```

### 2. 컴포넌트 테스트 예제

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### 3. API 라우트 테스트 예제

```typescript
import { describe, it, expect, vi } from 'vitest';
import { POST } from '../route';

describe('POST /api/upload', () => {
  it('should upload file successfully', async () => {
    const formData = new FormData();
    const mockRequest = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(mockRequest);
    expect(response.status).toBe(200);
  });
});
```

---

## CI/CD 통합

### GitHub Actions 예제

`.github/workflows/test.yml`:

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test -- --run

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Vercel 배포 전 테스트

`vercel.json`:

```json
{
  "buildCommand": "npm run test -- --run && npm run build",
  "installCommand": "npm ci"
}
```

---

## 배포 전 체크리스트

### 1. 로컬 테스트 실행

```bash
# 모든 테스트 실행
npm run test -- --run

# 커버리지 확인
npm run test:coverage
```

### 2. 타입 체크

```bash
npx tsc --noEmit
```

### 3. 린트 검사

```bash
npm run lint
```

### 4. 빌드 테스트

```bash
npm run build
```

---

## 배포 오류 발견 예제

### 예제 1: 타입 에러

**문제**:
```typescript
// components/MyComponent.tsx
const value: string = 123; // 타입 에러
```

**발견 방법**:
```bash
npx tsc --noEmit
# Error: Type 'number' is not assignable to type 'string'
```

### 예제 2: 런타임 에러

**문제**:
```typescript
// lib/utils/helper.ts
export function divide(a: number, b: number) {
  return a / b; // b가 0일 때 Infinity 반환
}
```

**테스트 작성**:
```typescript
// lib/utils/__tests__/helper.test.ts
import { describe, it, expect } from 'vitest';
import { divide } from '../helper';

describe('divide', () => {
  it('should throw error when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow();
  });
});
```

### 예제 3: 검증 로직 오류

**문제**:
```typescript
// 파일 크기 검증이 잘못됨
if (fileSize > 5000000) {
  throw new Error('Too large');
}
```

**테스트 작성**:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidFileSize } from '../file-validation';

describe('isValidFileSize', () => {
  it('should reject files larger than 5MB', () => {
    expect(isValidFileSize(5 * 1024 * 1024 + 1)).toBe(false);
  });

  it('should accept files exactly 5MB', () => {
    expect(isValidFileSize(5 * 1024 * 1024)).toBe(true);
  });
});
```

---

## 커버리지 향상 계획

### 우선순위 1: API 에러 핸들러 (현재 7%)

```typescript
// lib/api/__tests__/error-handler.test.ts
describe('handleApiError', () => {
  it('should handle ApiError correctly', () => {
    const error = new ApiError('Test error', 400);
    const response = handleApiError(error);
    expect(response.status).toBe(400);
  });

  it('should handle Prisma errors', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('...', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    const response = handleApiError(prismaError);
    expect(response.status).toBe(409);
  });
});
```

### 우선순위 2: 파일 서비스 레이어

```typescript
// lib/services/__tests__/file-service.test.ts
describe('uploadFiles', () => {
  it('should upload multiple files in parallel', async () => {
    const files = [mockFile1, mockFile2];
    const { succeeded, failed } = await uploadFiles(files);
    expect(succeeded.length).toBe(2);
    expect(failed.length).toBe(0);
  });
});
```

### 우선순위 3: 컴포넌트 테스트

```typescript
// components/__tests__/ExpenseForm.test.tsx
describe('ExpenseForm', () => {
  it('should submit form with valid data', async () => {
    render(<ExpenseForm />);
    // Fill form...
    fireEvent.click(screen.getByText('저장'));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
  });
});
```

---

## 문제 해결

### 테스트가 실행되지 않을 때

```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install

# Vitest 캐시 삭제
rm -rf .vitest
```

### 타입 에러가 발생할 때

```bash
# TypeScript 재컴파일
npx tsc --noEmit

# tsconfig.json 확인
```

### 커버리지 threshold 실패 시

임시로 threshold를 낮추거나 제거:

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    lines: 40,  // 60에서 40으로 임시 조정
    // ...
  },
}
```

---

## 참고 자료

- [Vitest 공식 문서](https://vitest.dev/)
- [Testing Library 문서](https://testing-library.com/)
- [Next.js 테스트 가이드](https://nextjs.org/docs/testing)

---

## 현재 상태

✅ **테스트 환경 구축 완료**
✅ **51개 테스트 작성 및 통과**
✅ **커버리지 리포팅 설정 완료**
⏳ **전체 커버리지 60% 목표 진행 중** (현재 44%)

다음 단계: API 라우트 및 컴포넌트 테스트 추가
