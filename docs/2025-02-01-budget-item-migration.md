# 항/목 ExpenseItem 이동 및 결재선 기반 세목 제한

**작업일**: 2025-02-01

## 개요

지출결의서의 `budgetCategory`(항)와 `budgetSubcategory`(목)을 `Expense` 테이블에서 `ExpenseItem` 테이블로 이동하고, 간편 지출결의서에서 동일 결재선(담당자)의 세목만 선택 가능하도록 제한하는 작업을 수행했습니다.

## 변경 배경

- **기존 구조**: `Expense` 테이블에 항/목이 저장되어 모든 항목이 동일한 항/목을 가짐
- **문제점**: 간편 지출결의서에서 여러 세목을 등록할 때 항/목이 다를 수 있음
- **해결 방안**: 항/목을 `ExpenseItem` 레벨로 이동하여 항목별로 독립적인 예산 분류 가능

## 주요 변경사항

### 1. DB 스키마 변경

**파일**: `prisma/schema.prisma`

#### Expense 모델에서 제거
```prisma
// 삭제됨
budgetCategory    String  // 예산(항)
budgetSubcategory String  // 예산(목)
```

#### ExpenseItem 모델에 추가
```prisma
model ExpenseItem {
  budgetCategory    String   @default("") // 예산(항)
  budgetSubcategory String   @default("") // 예산(목)
  budgetDetail      String   // 예산(세목)
  // ...
  @@index([budgetCategory, budgetSubcategory])
}
```

### 2. 데이터 마이그레이션

**파일**: `scripts/migrate-budget-to-items.ts`

기존 Expense 데이터를 ExpenseItem으로 마이그레이션하는 스크립트 작성 및 실행:

1. ExpenseItem에 컬럼 추가 (ALTER TABLE)
2. Expense → ExpenseItem 데이터 복사
3. 인덱스 생성
4. `prisma db push --accept-data-loss`로 스키마 동기화

**결과**: 45개 항목 마이그레이션 완료

### 3. 간편 지출결의서 결재선 기반 필터링

#### API 변경

**파일**: `app/api/budget/simple/all-details/route.ts`

- 기존: 재정팀장 담당 세목만 반환
- 변경: 모든 세목 반환 + `managerId`, `managerName` 포함

```typescript
// 응답 형식
{
  details: [
    {
      name: "아웃팅비_재정팀",
      category: "사무행정비",
      subcategory: "회의접대비",
      managerId: "clxxx...",
      managerName: "홍길동"
    },
    // ...
  ]
}
```

#### UI 컴포넌트 변경

**파일**: `components/simple-expense-form/SimpleItemsSection.tsx`

- `firstItemManagerId` 상태 추가
- 첫 번째 항목 세목 변경 시 담당자 저장
- 이후 항목 세목 초기화

```typescript
const [firstItemManagerId, setFirstItemManagerId] = useState<string | null>(null);

const handleBudgetChange = useCallback((index, value) => {
  if (index === 0) {
    setFirstItemManagerId(value.managerId || null);
    // 이후 항목 초기화
    for (let i = 1; i < fields.length; i++) {
      setValue(`items.${i}.budgetDetail`, '');
    }
  }
}, [setValue, fields.length]);
```

**파일**: `components/simple-expense-form/ItemBudgetSelector.tsx`

- `firstItemManagerId`, `isFirstItem` props 추가
- 결재선이 다른 세목 비활성화 + "(결재선 다름)" 표시

```typescript
const isDetailDisabled = (detail: BudgetDetailInfo): boolean => {
  if (isFirstItem) return false;
  if (!firstItemManagerId) return false;
  return detail.managerId !== firstItemManagerId;
};
```

#### 서버 검증

**파일**: `app/api/simple-expenses/route.ts`

- 모든 항목의 담당자가 첫 번째 항목과 동일한지 검증
- 다를 경우 400 에러 반환

```typescript
const firstManagerInfo = await getManagerIdForDetail(...);
for (let i = 1; i < validatedData.items.length; i++) {
  const managerInfo = await getManagerIdForDetail(...);
  if (managerInfo.managerId !== firstManagerInfo.managerId) {
    throw new ApiError(
      `항목 ${i + 1}의 세목 "${item.budgetDetail}"은 결재선이 다릅니다.`,
      400
    );
  }
}
```

### 4. 폼 바인딩 변경

**파일**: `components/expense-form/BudgetSection.tsx`

```typescript
// 변경 전
<Controller name="budgetCategory" ... />

// 변경 후
<Controller name="items.0.budgetCategory" ... />
```

**파일**: `components/ExpenseForm.tsx`

```typescript
// 변경 전
const budgetCategory = watch('budgetCategory');

// 변경 후
const items = watch('items');
const budgetCategory = items?.[0]?.budgetCategory || '';
```

### 5. 타입 정의 변경

**파일**: `lib/types/index.ts`

```typescript
// Expense에서 제거
export interface Expense {
  // budgetCategory: string;  // 삭제
  // budgetSubcategory: string;  // 삭제
  // ...
}

// ExpenseItem에 추가
export interface ExpenseItem {
  budgetCategory: string;    // 추가
  budgetSubcategory: string; // 추가
  budgetDetail: string;
  // ...
}
```

### 6. 표시/내보내기 수정

모든 표시 및 내보내기 로직에서 `expense.budgetCategory` → `expense.items[0].budgetCategory`로 변경:

| 파일 | 변경 내용 |
|------|----------|
| `components/ExpenseCard.tsx` | 카드 표시 |
| `app/expenses/page.tsx` | 목록 필터링 |
| `app/expenses/[id]/page.tsx` | 상세 표시 |
| `app/approvals/[id]/page.tsx` | 결재 상세 |
| `components/PDFDocument.tsx` | PDF 생성 |
| `components/print/PrintHeader.tsx` | 인쇄 헤더 |
| `lib/excel.ts` | 엑셀 내보내기 |
| `lib/excel-export.ts` | 엑셀 내보내기 |
| `scripts/bulk-upload.ts` | 일괄 업로드 |

## 수정된 파일 목록

### 스키마/타입
- `prisma/schema.prisma`
- `lib/schemas/expense-schema.ts`
- `lib/validators.ts`
- `lib/types/index.ts`

### API
- `app/api/expenses/route.ts`
- `app/api/expenses/[id]/route.ts`
- `app/api/simple-expenses/route.ts`
- `app/api/budget/simple/all-details/route.ts`
- `app/api/expenses/[id]/submit/route.ts`
- `app/api/approvals/route.ts`
- `app/api/expenses/export/excel/route.ts`

### UI 컴포넌트
- `components/ExpenseForm.tsx`
- `components/expense-form/BudgetSection.tsx`
- `components/simple-expense-form/SimpleItemsSection.tsx`
- `components/simple-expense-form/ItemBudgetSelector.tsx`
- `components/ExpenseCard.tsx`
- `components/PDFDocument.tsx`
- `components/print/PrintHeader.tsx`
- `components/HomeClient.tsx` (세목 담당자 결재함 접근)

### 페이지
- `app/page.tsx` (세목 담당자 결재함 접근)
- `app/expenses/page.tsx`
- `app/expenses/[id]/page.tsx`
- `app/approvals/[id]/page.tsx`

### 서비스/유틸
- `lib/services/approval-line-service.ts`
- `lib/excel.ts`
- `lib/excel-export.ts`

### 스크립트
- `scripts/bulk-upload.ts`
- `scripts/migrate-budget-to-items.ts` (신규)

## 테스트 방법

### 1. 스키마 변경 확인
```bash
npm run db:studio
```
- Expense 테이블에 항/목 없음 확인
- ExpenseItem 테이블에 항/목 있음 확인

### 2. 간편 지출결의서 테스트
1. `/expenses/simple/new` 접속
2. 첫 번째 항목 세목 선택
3. 두 번째 항목 추가
4. 결재선이 다른 세목 → 비활성화 + "(결재선 다름)" 표시 확인

### 3. 일반 지출결의서 테스트
1. `/expenses/new` 접속
2. 항/목 선택 후 저장
3. 상세/수정 페이지에서 항/목 표시 확인

### 4. 빌드 확인
```bash
npm run build
```

## 간편 지출결의서 접근 권한

다음 역할만 간편 지출결의서 작성 가능:

| 역할 | 한글명 |
|------|--------|
| `admin` | 관리자 |
| `finance_head` | 재정팀장 |
| `accountant` | 회계 |
| `admin_assistant` | 행정간사 |

## 결재함 접근 권한 (세목 담당자 추가)

### 변경 내용

세목 담당자(BudgetDetailYear.managerId)인 경우에도 메인화면에서 "결재 & 관리" 섹션의 결재함이 표시되도록 변경했습니다.

### 수정 파일

**파일**: `app/page.tsx`

```typescript
// 현재 연도의 세목 담당자인지 확인
const currentYear = new Date().getFullYear();
const budgetManagerCount = await prisma.budgetDetailYear.count({
  where: {
    managerId: user.id,
    year: currentYear,
    isActive: true,
  },
});
const isBudgetManager = budgetManagerCount > 0;

return <HomeClient user={user} isBudgetManager={isBudgetManager} />;
```

**파일**: `components/HomeClient.tsx`

```typescript
interface Props {
  user: UserInfo;
  isBudgetManager?: boolean;  // 세목 담당자 여부
}

export default function HomeClient({ user, isBudgetManager = false }: Props) {
  // 세목 담당자도 결재함 접근 가능
  const showApprovalMenu = canAccessApprovalMenu(user.role) || isBudgetManager;
  // ...
}
```

### 결재함 접근 권한 (최종)

| 조건 | 결재함 표시 |
|------|------------|
| `admin` (관리자) | ✅ |
| `finance_head` (재정팀장) | ✅ |
| `accountant` (회계) | ✅ |
| `team_leader` (팀장) | ✅ |
| **세목 담당자** (현재 연도 BudgetDetailYear.managerId) | ✅ |
| 일반 `user` | ❌ |

## 롤백 방법

1. Git에서 이전 커밋으로 복원
2. DB 마이그레이션 역순 실행 필요 (ExpenseItem → Expense 데이터 복사)
3. `prisma db push`로 스키마 복원

## 관련 문서

- `docs/EXPENSE_ITEM_DESIGN.md` - 기존 설계 문서
- `PRD.md` - 제품 요구사항
