# 지출결의서 시스템 리팩토링 분석

## 개요

지출결의서 관리 시스템의 코드베이스를 분석하여 리팩토링 가능한 부분들을 정리했습니다.

---

## 1. 코드 중복 (DRY 원칙 위반)

### 문제점

| 파일 | 중복 내용 | 예상 중복 줄 수 |
|------|----------|----------------|
| ExpenseForm.tsx / SimpleExpenseForm.tsx | 사용자 정보 자동 채우기, 데이터 로드, 폼 제출 | 200줄+ |
| expenses/page.tsx / expenses/simple/page.tsx | 필터링, 페이지네이션, 테이블 렌더링 | 150줄+ |
| ItemsSection.tsx / SimpleItemsSection.tsx | 항목 추가/제거, 금액 계산 | 50줄+ |

### 개선 방안

1. **공통 폼 훅 생성** (`useExpenseForm.ts`)
2. **재사용 가능한 리스트 컴포넌트** (`ListPageTemplate.tsx`)
3. **아이템 섹션 통합** (showBudgetSelector prop으로 차이 처리)

### 우선순위: **높음**
### 예상 작업량: **3-4일**

---

## 2. 복잡한 함수/컴포넌트 (단일 책임 원칙 위반)

### 문제점

| 컴포넌트/파일 | 줄 수 | 책임 수 |
|--------------|-------|---------|
| BudgetSelector.tsx | 300줄 | 5개 (계층 선택, API 호출, 상태 관리 등) |
| ExpenseForm.tsx | 346줄 | 6개 (제출, 로드, 자동채우기, 첨부파일 등) |
| expenses/page.tsx | 485줄 | 4개 (필터링, 페이지네이션, 검색, 렌더링) |

### 개선 방안

1. **BudgetSelector 분해**: `useBudgetHierarchy.ts` 훅 생성
2. **ExpenseForm 분해**: `useExpenseFormData.ts`, `useUserAutoFill.ts` 등
3. **서비스 레이어 생성**: `expense-service.ts`, `validation-service.ts`

### 우선순위: **높음**
### 예상 작업량: **4-5일**

---

## 3. 하드코딩된 값들

### 문제점

```typescript
// lib/approval-engine.ts
const COMMITTEE_TEAM_LEADERS: Record<string, string> = {
  '예배위원회': '김흥래',
  '교육훈련위원회': '김흥래',
  // 모든 값이 동일하게 하드코딩
};

// components/expense-form/ItemsSection.tsx
if (fields.length >= 10) {
  alert('최대 10개까지 항목을 추가할 수 있습니다.');
}
```

### 개선 방안

1. **데이터베이스 기반 설정**: `ApprovalConfig`, `SystemConfig` 테이블
2. **환경 변수 + 상수 파일**: `lib/constants/config.ts`
3. **설정 관리 서비스**: `configService`

### 우선순위: **중간**
### 예상 작업량: **2-3일**

---

## 4. 타입 안전성 개선

### 문제점

- `any` 타입 사용: `initialData?: any`
- 불완전한 타입 정의
- API 응답 타입 분산

### 개선 방안

```typescript
// lib/types/index.ts - 공통 타입 파일
export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseItem = z.infer<typeof expenseItemSchema>;
export type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED_STEP_1' | ...;

// lib/api-client.ts - 제네릭 API 클라이언트
export class ApiClient {
  async get<T>(url: string): Promise<T> { ... }
  async post<T>(url: string, data: unknown): Promise<T> { ... }
}
```

### 우선순위: **중간**
### 예상 작업량: **2-3일**

---

## 5. 성능 최적화

### 문제점

| 문제 | 위치 | 영향 |
|------|------|------|
| 클라이언트 필터링 | expenses/page.tsx | 10,000+ 레코드 시 성능 저하 |
| N+1 쿼리 가능성 | api/expenses/route.ts | DB 부하 |
| BudgetSelector API 과다 호출 | BudgetSelector.tsx | 5번의 API 호출 가능 |
| 폼 재렌더링 | ExpenseForm.tsx | 모든 필드 변경 시 전체 리렌더링 |

### 개선 방안

1. **서버 사이드 필터링**: 쿼리 파라미터로 필터링
2. **Prisma select로 필요한 필드만 조회**
3. **BudgetSelector 캐싱**: `Map` 기반 캐시
4. **폼 최적화**: `mode: 'onBlur'` 설정

### 우선순위: **중간-높음**
### 예상 작업량: **3-4일**

---

## 6. 테스트 용이성 개선

### 문제점

- 대부분의 컴포넌트 테스트 부재
- 의존성 주입 부재 (Prisma 직접 임포트)
- 복잡한 로직이 컴포넌트에 내재

### 개선 방안

1. **비즈니스 로직 분리**: 서비스 레이어로 추출
2. **의존성 주입 패턴**: `createApprovalService(prisma, config)`
3. **테스트용 팩토리 함수**: `createMockExpense()`

### 우선순위: **낮음-중간**
### 예상 작업량: **2-3일**

---

## 7. API 구조 개선

### 문제점

- 불일관한 API 응답 포맷
- 에러 응답 형식 불일관
- 검색/필터 기능 서버 미구현

### 개선 방안

```typescript
// 통일된 API 응답 포맷
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { pagination?: Pagination };
}

// 쿼리 파라미터 표준화
GET /api/expenses?search=검색어&committee=위원회&page=1&limit=20
```

### 우선순위: **중간**
### 예상 작업량: **2-3일**

---

## 8. 폴더/파일 구조 개선

### 현재 구조 문제점

- `lib/` 폴더 계층 일관성 없음
- 폼 관련 컴포넌트 분산
- 결재 관련 라우트 분산

### 제안 구조

```
lib/
├── core/               # 핵심 기능
│   ├── approval/
│   ├── expense/
│   └── budget/
├── shared/             # 공통
│   ├── constants/
│   ├── utils/
│   └── types/
├── infrastructure/     # 인프라
│   ├── db/
│   ├── storage/
│   └── auth/
└── services/           # 서비스
```

### 우선순위: **낮음**
### 예상 작업량: **2-3일**

---

## 로드맵

### Phase 1: 기초 (1주일)
- 코드 중복 제거
- 타입 안전성 개선

### Phase 2: 핵심 (2주일)
- API 구조 개선
- 컴포넌트 분해
- 서비스 레이어 생성

### Phase 3: 최적화 (1주일)
- 성능 최적화
- 폴더 재구성

### Phase 4: 품질 (1주일)
- 테스트 작성

---

## 빠른 승리 (Quick Wins)

| 작업 | 예상 시간 | 효과 |
|------|----------|------|
| API 응답 표준화 | 1일 | 모든 API 호출 코드 간소화 |
| 공통 에러 처리 | 1일 | API 라우트 20+ 줄 단축 |
| BudgetSelector 캐싱 | 1일 | API 호출 3-5배 감소 |
| 필터 로직 추상화 | 1일 | 리스트 페이지 50줄 단축 |

---

## 예상 전체 작업량

- **총 작업량**: 15-20일 (개발자 1명 기준)
- **코드 삭제**: 약 400-500줄
- **코드 추가**: 약 300-400줄
- **테스트 커버리지**: 현재 → 60% 향상 예상
