# 작업 요약 (2026-01-05)

## 개요

예산 관리 시스템의 정규화 및 결재선 자동화 작업 완료

---

## 1. 예산 테이블 정규화

### 1.1 기존 구조 (BudgetMaster)
```
BudgetMaster (단일 테이블)
├── committee (위원회)
├── department (사역팀)
├── category (예산 항)
├── subcategory (예산 목)
├── detail (예산 세목)
├── manager (담당자 이름)
├── accountCode
└── description
```

### 1.2 정규화된 구조 (6개 테이블)
```
Committee (위원회)
    └── Department (사역팀/부)
            └── DepartmentBudgetDetail (부서-세목 연결)
                    └── BudgetDetail (예산 세목)
                            └── BudgetSubcategory (예산 목)
                                    └── BudgetCategory (예산 항)

BudgetDetailYear (연도별 예산 관리)
├── budgetDetailId
├── year
├── managerId (담당자 - User 참조)
├── budgetAmount (배정 예산)
└── usedAmount (사용 금액)
```

### 1.3 정규화 장점
| 항목 | 기존 | 변경 후 |
|------|------|---------|
| 담당자 관리 | 문자열 (이름) | User 테이블 참조 (FK) |
| 연도별 관리 | 불가능 | BudgetDetailYear로 지원 |
| 예산 배정 | 없음 | budgetAmount, usedAmount |
| 데이터 무결성 | 낮음 | 높음 (FK 제약) |

---

## 2. 결재선 자동화

### 2.1 결재 규칙
```
3단계 결재 흐름:
1차: 담당자 (세목별 지정된 담당자)
2차: 회계 (accountant 역할)
3차: 재정팀장 (finance_head 역할)

전결 규칙:
- 담당자가 재정팀장인 경우 → 1차 자동승인
- 담당자 미지정 시 → 재정팀장이 1차 결재 담당
```

### 2.2 결재선 계산 서비스
**파일**: `lib/services/approval-line-service.ts`

```typescript
interface ApprovalLineInfo {
  budgetDetailId?: string;
  budgetDetailName?: string;
  managerId: string | null;
  managerName: string | null;
  isDirectApproval: boolean;  // 전결 여부
  totalSteps: number;         // 총 결재 단계 (항상 3)
  steps: ApprovalStep[];
  year: number;
  budget?: BudgetInfo;        // 예산 현황
}

interface BudgetInfo {
  budgetAmount: number;   // 배정 예산
  usedAmount: number;     // 사용 금액
  remainingAmount: number; // 잔여 예산
  isOverBudget: boolean;  // 예산 초과 여부
}
```

### 2.3 API 엔드포인트
**POST /api/approval-line/calculate**
```json
// Request
{
  "budgetCategory": "교육사역비",
  "budgetSubcategory": "영유아사역비",
  "items": [{ "budgetDetail": "교육교재비" }],
  "requestDate": "2026-01-05"
}

// Response
{
  "budgetDetailId": "...",
  "budgetDetailName": "교육교재비",
  "managerId": "...",
  "managerName": "박영미",
  "isDirectApproval": false,
  "totalSteps": 3,
  "steps": [
    { "stepNumber": 1, "stepName": "담당자", "approverName": "박영미", "isAutoApproved": false },
    { "stepNumber": 2, "stepName": "회계", "approverName": "윤운문", "isAutoApproved": false },
    { "stepNumber": 3, "stepName": "재정팀장", "approverName": "신창국", "isAutoApproved": false }
  ],
  "budget": {
    "budgetAmount": 1000000,
    "usedAmount": 300000,
    "remainingAmount": 700000,
    "isOverBudget": false
  }
}
```

---

## 3. 예산 초과 경고 UI

### 3.1 컴포넌트
**파일**: `components/expense-form/ApprovalLinePreview.tsx`

### 3.2 기능
- 예산 현황 표시 (배정/사용/잔여)
- 청구 후 잔액 실시간 계산
- 예산 초과 시 빨간색 경고 배너
- 결재선 미리보기 (3단계)
- 전결 적용 시 파란색 안내 문구

### 3.3 ExpenseForm 연동
```typescript
<ApprovalLinePreview
  budgetCategory={budgetCategory}
  budgetSubcategory={budgetSubcategory}
  budgetDetail={items?.[0]?.budgetDetail}
  requestDate={requestDate}
  requestAmount={items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0}
/>
```

---

## 4. budget-upload.ts 마이그레이션

### 4.1 변경 사항
| 기능 | 기존 (BudgetMaster) | 변경 후 (정규화 테이블) |
|------|---------------------|-------------------------|
| 업로드 | 단일 테이블 upsert | 6개 테이블 계층적 upsert |
| 성능 | N/A | 캐시 맵으로 중복 조회 방지 |
| 내보내기 | BudgetMaster 조회 | 조인으로 정규화 테이블 조회 |

### 4.2 업로드 로직
```typescript
// 캐시 맵 (성능 최적화)
const committeeCache = new Map<string, string>();
const departmentCache = new Map<string, string>();
const categoryCache = new Map<string, string>();
const subcategoryCache = new Map<string, string>();

// 6단계 upsert
1. Committee upsert
2. Department upsert (committeeId 참조)
3. BudgetCategory upsert
4. BudgetSubcategory upsert (categoryId 참조)
5. BudgetDetail upsert (subcategoryId 참조)
6. DepartmentBudgetDetail upsert (연결 테이블)
```

---

## 5. prisma/seed.ts 업데이트

### 5.1 구조 변경
```typescript
// 기존
main() → BudgetMaster 삽입

// 변경 후
main()
├── seedUsers()              // User, UserYearRole
├── seedNormalizedBudget()   // 정규화 테이블 6개
└── seedBudgetMasterLegacy() // BudgetMaster (호환성)
```

### 5.2 데이터 정리
| 항목 | 기존 | 변경 후 |
|------|------|---------|
| 총 행수 | 2400+ 줄 | 569줄 |
| 유효 항목 | 혼재 | 138개 (정리됨) |
| 빈 필드 | 포함 | 필터링 제거 |

---

## 6. API 변경 사항

### 6.1 /api/budget (GET/POST)
- 정규화 테이블에서 계층적 조회 지원
- 기존 BudgetMaster 호환 모드 유지

### 6.2 /api/budget-details/year
- GET: 연도별 세목 목록 조회
- PUT: 담당자/예산 일괄 업데이트

### 6.3 /api/budget-details/year/auto-assign
- POST: 담당자 자동 지정 (이름 매칭)

### 6.4 /api/budget-details/year/copy
- POST: 이전 연도 데이터 복사

### 6.5 /api/expenses (POST)
- 결재선 자동 생성 로직 추가
- BudgetDetailYear에서 담당자 조회

### 6.6 /api/expenses/[id]/submit (POST)
- 결재선 재계산 및 첫 번째 결재자에게 할당

---

## 7. 관리자 페이지

### 7.1 담당자 관리 페이지
**경로**: `/admin/budget-managers`

**기능**:
- 연도별 세목 담당자 조회/편집
- 예산 배정/사용 금액 관리
- 담당자 자동 지정 (BudgetMaster 이름 매칭)
- 이전 연도 데이터 복사

---

## 8. 파일 변경 목록

### 8.1 신규 파일
```
app/admin/budget-managers/page.tsx
app/api/approval-line/calculate/route.ts
app/api/budget-details/year/route.ts
app/api/budget-details/year/auto-assign/route.ts
app/api/budget-details/year/copy/route.ts
components/expense-form/ApprovalLinePreview.tsx
lib/services/approval-line-service.ts
scripts/migrate-budget-master.ts
docs/BUDGET_NORMALIZATION.md
docs/budget_master_refactor-260104.md
```

### 8.2 수정 파일
```
prisma/schema.prisma          # 정규화 테이블 추가
prisma/seed.ts                # 정규화 테이블 시드
lib/budget-upload.ts          # 정규화 테이블 업로드
lib/approval-engine.ts        # 결재선 로직 단순화
app/api/budget/route.ts       # 정규화 테이블 조회
app/api/budget/simple/route.ts
app/api/expenses/route.ts     # 결재선 자동 생성
app/api/expenses/[id]/submit/route.ts
app/api/expenses/[id]/approval/route.ts
components/ExpenseForm.tsx    # ApprovalLinePreview 연동
app/admin/page.tsx            # 메뉴 추가
scripts/bulk-upload.ts
```

### 8.3 삭제 파일
```
lib/__tests__/approval-engine.test.ts  # 구조 변경으로 테스트 삭제
```

---

## 9. 남은 작업

| 작업 | 상태 | 비고 |
|------|------|------|
| 담당자 데이터 보완 | 미완료 | 91개 세목 미지정 |
| 브라우저 E2E 테스트 | 미완료 | 로그인 후 진행 |
| approval-engine 테스트 재작성 | 선택 | 구조 변경됨 |

---

## 10. 커밋 정보

```
Branch: 260105-budget-master-refactor
Commit: decc972
Message: feat: 예산 정규화 및 결재선 자동화 구현

Files: 23 changed, +4287 -3825
```
