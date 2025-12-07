# Expense-System 리팩토링 분석 보고서

## 목차
1. [컴포넌트 구조](#1-컴포넌트-구조-분석)
2. [타입 정의](#2-타입-정의-분석)
3. [API 라우트](#3-api-라우트-분석)
4. [유틸리티 함수](#4-유틸리티-함수-분석)
5. [스타일링](#5-스타일링-분석)
6. [상태 관리](#6-상태-관리-분석)
7. [폼 처리](#7-폼-처리-분석)
8. [종합 우선순위](#종합-리팩토링-우선순위)
9. [실행 계획](#즉시-실행-가능한-개선-사항)

---

## 1. 컴포넌트 구조 분석

### 현재 문제점

#### 1.1. 중복된 입력 필드 클래스 정의
여러 컴포넌트에서 동일한 Tailwind 클래스 문자열을 반복 정의:
- `components/expense-form/ApplicantSection.tsx`
- `components/expense-form/BankSection.tsx`
- `components/expense-form/ItemsSection.tsx`

```tsx
const inputClasses = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400';
```

#### 1.2. 로딩/에러 상태 UI 중복
같은 로딩/에러 UI가 여러 페이지에서 반복:
- `app/expenses/page.tsx`
- `app/expenses/[id]/page.tsx`
- `components/ExpenseForm.tsx`

#### 1.3. 통화 형식 함수 중복
`formatCurrency` 함수가 여러 곳에서 중복 정의:
- `app/expenses/page.tsx`
- `app/expenses/[id]/page.tsx`
- `lib/utils.ts` (다른 버전)

#### 1.4. 섹션 컴포넌트의 깊은 중첩
`BudgetSection.tsx`에서 4단계의 Controller 중첩으로 가독성 저하

### 개선 방안

| 개선 항목 | 방법 |
|---------|------|
| 공통 스타일 상수 | `lib/constants/styles.ts` 파일 생성 |
| 로딩/에러 UI | `components/ui/LoadingState.tsx`, `ErrorState.tsx` 생성 |
| 통화 형식 함수 | `lib/utils.ts`의 함수만 사용 |
| Controller 중첩 | 커스텀 훅 `useExpenseForm` 생성 |

### 우선순위: **높음** | 예상 작업량: **2-3시간**

---

## 2. 타입 정의 분석

### 현재 문제점

#### 2.1. 중복된 인터페이스 정의
ExpenseItem, Expense 타입이 여러 파일에 정의:
- `app/expenses/page.tsx`
- `app/expenses/[id]/page.tsx`
- `lib/schemas/expense-schema.ts`
- `lib/validators.ts`
- `components/print/types.ts`

#### 2.2. 타입 불일치
서로 다른 곳에서 정의된 같은 개념의 타입이 미묘하게 다름:
- `ExpenseFormData` vs `CreateExpense` vs `Expense`

#### 2.3. 첨부파일 타입 산재
`UploadedFile` 타입이 여러 곳에서 재정의:
- `components/FileUpload.tsx`
- `app/expenses/[id]/page.tsx`

### 개선 방안

```typescript
// lib/types/index.ts (제안)
export interface ExpenseItem { ... }
export interface Expense { ... }
export interface ExpenseAttachment { ... }

// Zod 스키마에서 타입 추론
export type ExpenseFormData = z.infer<typeof expenseFormSchema>;
```

### 우선순위: **높음** | 예상 작업량: **2-3시간**

---

## 3. API 라우트 분석

### 현재 문제점

#### 3.1. 에러 처리 불일치
API 라우트마다 다른 에러 처리 패턴:
- `app/api/expenses/route.ts`: try-catch 직접 처리
- `app/api/budget/route.ts`: 다른 패턴

#### 3.2. 검증 로직 혼재
유효성 검사가 여러 곳에 흩어짐:
- Zod 스키마 (`lib/schemas/expense-schema.ts`)
- 레거시 검증 (`lib/validators.ts`)
- API 라우트 내부

#### 3.3. 중복된 금액 계산 로직 (중요!)
```typescript
// lib/validators.ts
Math.floor((unitPrice * quantity) / 10) * 10

// lib/schemas/expense-schema.ts
Math.floor((unitPrice * quantity) / 100) * 10
```
**차이점**: 첫 번째는 10으로 나누고, 두 번째는 100으로 나눔 - **통일 필요!**

#### 3.4. 로깅 부족
`console.error`만 사용, 구조화된 로깅 없음

### 개선 방안

```typescript
// 모든 API에서 통일된 에러 핸들러 사용
import { handleApiError } from '@/lib/api/error-handler';

try {
  // ...
} catch (error) {
  return handleApiError(error);
}
```

### 우선순위: **높음** | 예상 작업량: **3-4시간**

---

## 4. 유틸리티 함수 분석

### 현재 문제점

#### 함수 중복 현황

| 함수명 | 위치 | 비고 |
|-------|------|------|
| `formatCurrency` | lib/utils.ts, page.tsx (2곳) | 3곳 중복 |
| `calculateAmount` | validators.ts, expense-schema.ts | 구현 다름! |
| `calculateTotal` | validators.ts, expense-schema.ts | 구현 다름! |

#### 금액 계산 로직 불일치 (버그 위험!)
```typescript
// validators.ts - 10원 단위 절삭
Math.floor((unitPrice * quantity) / 10) * 10

// expense-schema.ts - 다른 계산
Math.floor((unitPrice * quantity) / 100) * 10
```

### 개선 방안

1. **`lib/calculations.ts` 파일 생성**
2. **금액 계산 함수 단일화** (요구사항 확인 후)
3. **모든 곳에서 동일한 import 사용**

### 우선순위: **높음** | 예상 작업량: **1-2시간**

---

## 5. 스타일링 분석

### 현재 문제점

#### 5.1. 중복된 Tailwind 클래스

| 패턴 | 출현 횟수 |
|-----|---------|
| `w-full px-4 py-2 border border-gray-300 rounded-lg...` | 4+ |
| `bg-white rounded-lg shadow-sm p-6` | 15+ |
| `px-6 py-3 bg-blue-500 text-white rounded-lg...` | 4+ |

#### 5.2. 색상 불일치
- 버튼: `blue-500`, `green-500`, `emerald-500` 혼용
- 호버 상태가 컴포넌트마다 다름

#### 5.3. 반응형 디자인 불일치
- 일부는 `md:` breakpoint, 일부는 `sm:`
- 그리드 열 수가 페이지마다 다름

### 개선 방안

```typescript
// lib/constants/styles.ts
export const FORM_INPUT = 'w-full px-4 py-2 border border-gray-300 rounded-lg...';
export const SECTION_CARD = 'bg-white rounded-lg shadow-sm p-6';
export const BTN_PRIMARY = 'px-6 py-3 bg-blue-500 text-white rounded-lg...';
export const BTN_SECONDARY = '...';
export const BTN_DANGER = '...';
```

### 우선순위: **중간** | 예상 작업량: **3-4시간**

---

## 6. 상태 관리 분석

### 현재 문제점

#### 6.1. Props 드릴링
BudgetSelector 컴포넌트 체인:
```
ExpenseForm → BudgetSection → BudgetSelector
```
상태가 여러 단계로 전파됨

#### 6.2. 중복된 상태 관리
`app/expenses/page.tsx`에서:
- 검색, 필터링, 페이지네이션이 모두 한 컴포넌트에서 관리
- 재사용 불가능한 형태

#### 6.3. Form 상태 관리의 복잡성
- `watch()`, `setValue()` 혼용
- 항목 추가/삭제 시 필드 배열 관리 복잡

### 개선 방안

```typescript
// hooks/useExpenseFilters.ts
export function useExpenseFilters() {
  const [filters, setFilters] = useState({...});
  // 필터 로직
}

// hooks/usePagination.ts
export function usePagination() {
  // 페이지네이션 로직
}
```

### 우선순위: **낮음** | 예상 작업량: **2-3시간**

---

## 7. 폼 처리 분석

### 현재 문제점

#### 7.1. 폼 섹션 컴포넌트 Props 과다
각 섹션이 `register`, `control`, `errors`를 별도로 수신 (3-5개)

#### 7.2. 검증 에러 표시 중복
```tsx
// 모든 섹션에서 반복
{errors.fieldName && <p>{errors.fieldName.message}</p>}
```

#### 7.3. 데이터 변환 로직 산재
- API 응답 → 폼 데이터 변환이 컴포넌트 내부에 있음
- 날짜 포매팅 로직이 여러 곳에 존재

### 개선 방안

```typescript
// components/ui/FormField.tsx
export function FormField({ label, error, children }: Props) {
  return (
    <div>
      <label>{label}</label>
      {children}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}

// lib/transformers/expense.ts
export function apiToFormData(apiData: Expense): ExpenseFormData { ... }
export function formDataToApi(formData: ExpenseFormData): CreateExpense { ... }
```

### 우선순위: **중간** | 예상 작업량: **4-5시간**

---

## 종합 리팩토링 우선순위

| 순위 | 영역 | 중요도 | 예상시간 | 개선효과 |
|:---:|------|:------:|:--------:|---------|
| 1 | 금액 계산 함수 통일 | **긴급** | 1h | 버그 방지 |
| 2 | 타입 정의 중앙화 | 높음 | 2-3h | 개발 생산성 |
| 3 | API 에러 처리 통일 | 높음 | 3-4h | 코드 안정성 |
| 4 | 유틸 함수 통합 | 높음 | 1-2h | 코드 정리 |
| 5 | 스타일 상수화 | 중간 | 3-4h | 유지보수성 |
| 6 | 폼 처리 개선 | 중간 | 4-5h | 가독성 |
| 7 | 상태 관리 구조화 | 낮음 | 2-3h | 확장성 |

**전체 예상 작업량: 16-22시간**

---

## 즉시 실행 가능한 개선 사항

### Phase 1: 긴급 수정 (1-2시간)

1. **금액 계산 함수 통일** (버그 위험!)
   - `validators.ts`와 `expense-schema.ts`의 계산식 확인
   - 올바른 버전으로 통일
   - 테스트 케이스 작성

2. **타입 파일 생성**
   ```
   lib/types/
   ├── index.ts      # 모든 타입 export
   ├── expense.ts    # 지출결의서 관련
   └── api.ts        # API 요청/응답
   ```

### Phase 2: 코드 정리 (2-3시간)

1. **스타일 상수 파일 생성**
   ```
   lib/constants/
   └── styles.ts
   ```

2. **공통 UI 컴포넌트 생성**
   ```
   components/ui/
   ├── LoadingState.tsx
   ├── ErrorState.tsx
   ├── FormField.tsx
   └── Button.tsx
   ```

### Phase 3: 구조 개선 (3-4시간)

1. **API 에러 핸들러 적용**
   - 모든 라우트에서 `handleApiError` 사용

2. **커스텀 훅 분리**
   ```
   hooks/
   ├── useExpenseForm.ts
   ├── useExpenseFilters.ts
   └── usePagination.ts
   ```

---

## 파일 구조 개선안

### 현재 구조
```
lib/
├── validators.ts      # 레거시 검증
├── utils.ts           # 유틸리티
├── prisma.ts
├── excel.ts
└── schemas/
    └── expense-schema.ts
```

### 개선된 구조
```
lib/
├── types/
│   ├── index.ts       # 타입 export
│   ├── expense.ts     # 지출결의서 타입
│   └── api.ts         # API 타입
├── constants/
│   └── styles.ts      # Tailwind 상수
├── utils/
│   ├── index.ts
│   ├── format.ts      # formatCurrency, formatDate
│   └── calculations.ts # calculateAmount, calculateTotal
├── schemas/
│   └── expense.ts     # Zod 스키마
├── api/
│   └── error-handler.ts
├── prisma.ts
└── excel.ts

components/
├── ui/                # 재사용 가능한 UI
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── LoadingState.tsx
│   ├── ErrorState.tsx
│   └── FormField.tsx
├── print/             # 프린트 전용 (완료)
│   ├── PrintHeader.tsx
│   ├── PrintItems.tsx
│   └── PrintFooter.tsx
├── expense-form/      # 폼 섹션
│   └── ...
└── ...

hooks/
├── useExpenseForm.ts
├── useExpenseFilters.ts
└── usePagination.ts
```

---

## 결론

### 즉시 해결해야 할 문제
1. **금액 계산 함수 불일치** - 버그 발생 위험
2. **타입 중복** - 개발 효율 저하

### 단기적 개선 (1-2주)
1. 스타일 상수화
2. 공통 UI 컴포넌트 생성
3. API 에러 처리 통일

### 장기적 개선 (1개월+)
1. 컴포넌트 라이브러리 구축
2. 상태 관리 구조화
3. 테스트 커버리지 증대

---

*작성일: 2025-12-08*
*분석 대상: expense-system MVP*
