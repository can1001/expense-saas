# ExpenseItem에 항/목 필드 추가 설계

## 배경

현재 `ExpenseItem` 테이블에는 `budgetDetail`(세목)만 저장되고, `budgetCategory`(항), `budgetSubcategory`(목)는 `Expense` 테이블 레벨에만 저장됩니다.

반면 `SimpleExpenseItem`은 이미 항/목/세목을 모두 저장하고 있어 데이터 구조의 일관성이 부족합니다.

## 목표

ExpenseItem 테이블에 `budgetCategory`(항), `budgetSubcategory`(목) 필드를 추가하여 SimpleExpenseItem과 데이터 구조 일관성 유지

## 현재 vs 변경 후

### 현재 구조
```
Expense
├─ budgetCategory (항)      ← 전체 항목 공통
├─ budgetSubcategory (목)   ← 전체 항목 공통
└─ ExpenseItem[]
    └─ budgetDetail (세목)  ← 항목별
```

### 변경 후 구조
```
Expense
├─ budgetCategory (항)      ← 유지 (결재선 산출용)
├─ budgetSubcategory (목)   ← 유지 (결재선 산출용)
└─ ExpenseItem[]
    ├─ budgetCategory (항)      ← 항목별 (신규)
    ├─ budgetSubcategory (목)   ← 항목별 (신규)
    └─ budgetDetail (세목)      ← 항목별 (기존)
```

## 수정 파일 목록

### 1. 스키마 변경
**파일**: `prisma/schema.prisma`

ExpenseItem 모델에 필드 추가:
```prisma
model ExpenseItem {
  id           String   @id @default(cuid())
  expenseId    String
  expense      Expense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)

  budgetCategory     String?   // 예산(항) - 신규 추가
  budgetSubcategory  String?   // 예산(목) - 신규 추가
  budgetDetail       String    // 예산(세목) - 기존
  description  String
  unitPrice    Int
  quantity     Int
  amount       Int

  order        Int
  createdAt    DateTime @default(now())

  @@index([expenseId])
}
```

> **참고**: nullable로 추가하여 기존 데이터와 호환성 유지

### 2. Zod 스키마 변경
**파일**: `lib/schemas/expense-schema.ts`

ExpenseItem 스키마에 항/목 필드 추가:
```typescript
const expenseItemSchema = z.object({
  budgetCategory: z.string().optional(),    // 신규
  budgetSubcategory: z.string().optional(), // 신규
  budgetDetail: z.string().min(1, '예산(세목)을 선택해주세요'),
  description: z.string().min(1, '적요를 입력해주세요'),
  unitPrice: z.number().min(1, '단가는 1 이상이어야 합니다'),
  quantity: z.number().min(1, '수량은 1 이상이어야 합니다'),
  amount: z.number().min(0),
});
```

### 3. 지출결의서 생성 API 수정
**파일**: `app/api/expenses/route.ts` (POST)

항목 생성 시 항/목 포함:
```typescript
const itemsWithCalculatedAmount = validatedData.items.map((item, index) => ({
  budgetCategory: validatedData.budgetCategory,       // 추가
  budgetSubcategory: validatedData.budgetSubcategory, // 추가
  budgetDetail: item.budgetDetail,
  description: item.description,
  unitPrice: item.unitPrice,
  quantity: item.quantity,
  amount: calculateAmount(item.unitPrice, item.quantity),
  order: index + 1,
}));
```

### 4. 지출결의서 수정 API 수정
**파일**: `app/api/expenses/[id]/route.ts` (PUT)

항목 수정 시 항/목 포함 (동일 패턴 적용)

### 5. 데이터 마이그레이션
기존 ExpenseItem에 Expense의 항/목 값 복사:

```sql
UPDATE "ExpenseItem" ei
SET "budgetCategory" = e."budgetCategory",
    "budgetSubcategory" = e."budgetSubcategory"
FROM "Expense" e
WHERE ei."expenseId" = e.id;
```

## 검증 방법

1. `npm run db:push` - 스키마 변경 적용
2. 마이그레이션 스크립트 실행 (기존 데이터 업데이트)
3. `/expenses/new`에서 새 지출결의서 작성
4. Prisma Studio 또는 DB에서 ExpenseItem에 항/목이 저장되었는지 확인
5. `npm run build` - 빌드 성공 확인

## 참고: SimpleExpenseItem 구조 (비교용)

```prisma
model SimpleExpenseItem {
  id           String         @id @default(cuid())
  expenseId    String
  expense      SimpleExpense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)

  budgetCategory     String    // 예산(항) - 이미 존재
  budgetSubcategory  String    // 예산(목) - 이미 존재
  budgetDetail       String    // 예산(세목) - 이미 존재
  description        String
  unitPrice          Int
  quantity           Int
  amount             Int

  order        Int
  createdAt    DateTime @default(now())

  @@index([expenseId])
}
```

## 향후 고려사항

- UI에서 각 항목별로 다른 항/목을 선택할 수 있도록 확장 가능
- 현재는 Expense 레벨의 항/목을 모든 항목에 동일하게 적용
- Expense.budgetCategory/budgetSubcategory는 결재선 산출용으로 유지
