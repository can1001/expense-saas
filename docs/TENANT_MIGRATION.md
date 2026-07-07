# 테넌트 데이터 마이그레이션 가이드

## 개요

이 문서는 기존 단일 테넌트 데이터를 멀티테넌트 SaaS 구조로 마이그레이션하는 방법을 설명합니다.

## 마이그레이션 순서

1. 데이터베이스 스키마 마이그레이션 (Prisma)
2. 기존 데이터에 tenantId 할당
3. 테넌트 통계 업데이트
4. 검증

## 사전 요구사항

- Node.js 18+
- 데이터베이스 백업 완료
- Prisma 클라이언트 생성 완료 (`npx prisma generate`)

## 마이그레이션 실행

### 1. Dry-run (변경 없이 확인)

```bash
npx tsx scripts/migrate-tenant-id.ts --dry-run
```

출력 예시:
```
═══════════════════════════════════════════════════════════
  기존 데이터 tenantId 마이그레이션
═══════════════════════════════════════════════════════════
  모드: Dry-run (변경 없음)

📦 테넌트 확인 중...
  테넌트: 기본 조직 (clxxxxxx)
  (새로 생성됨)

🔄 모델 마이그레이션 시작...

  → role: 5개 마이그레이션 예정 (dry-run)
  → committee: 10개 마이그레이션 예정 (dry-run)
  → user: 50개 마이그레이션 예정 (dry-run)
  ...

═══════════════════════════════════════════════════════════
  마이그레이션 결과 요약
═══════════════════════════════════════════════════════════
  총 마이그레이션: 1,234개 레코드
  이미 완료됨: 0개 레코드
  오류: 0개 모델

💡 실제 마이그레이션을 실행하려면 --dry-run 옵션을 제거하세요.
```

### 2. 실제 마이그레이션 실행

```bash
npx tsx scripts/migrate-tenant-id.ts
```

### 3. 특정 테넌트로 마이그레이션

기존에 생성된 테넌트가 있는 경우:

```bash
npx tsx scripts/migrate-tenant-id.ts --tenant-id=your-tenant-id
```

### 4. 환경변수로 테넌트 정보 지정

새 테넌트 생성 시 정보 지정:

```bash
MIGRATION_TENANT_NAME="청연교회" \
MIGRATION_TENANT_SUBDOMAIN="chungyeon" \
npx tsx scripts/migrate-tenant-id.ts
```

## 롤백

문제가 발생한 경우 롤백할 수 있습니다:

```bash
# Dry-run
npx tsx scripts/migrate-tenant-id-rollback.ts --dry-run

# 실제 롤백 (확인 필요)
npx tsx scripts/migrate-tenant-id-rollback.ts --confirm
```

⚠️ **주의**: 롤백은 모든 tenantId를 null로 되돌립니다. 프로덕션에서는 신중하게 사용하세요.

## 마이그레이션 대상 모델

총 48개 모델이 마이그레이션됩니다:

### 핵심 모델
- `User`, `Role`, `Committee`, `Department`
- `Expense`, `ExpenseItem`, `ExpenseAttachment`
- `SimpleExpense`, `SimpleExpenseItem`, `SimpleExpenseAttachment`
- `RecurringExpense`, `ExpenseTemplate`

### 예산 관련
- `BudgetCategory`, `BudgetSubcategory`, `BudgetDetail`
- `BudgetDetailYear`, `DepartmentBudgetDetail`
- `BudgetDetailYearHistory`

### 결재/알림
- `ApprovalLog`, `NotificationPreference`, `NotificationLog`
- `PushSubscription`, `WebPushLog`, `FcmToken`, `FcmLog`

### 기타
- `SavedBankAccount`, `UserSignature`, `UserYearRole`
- `Offering`, `SystemSetting`, `AdminNotification`
- `AccountReport` 및 관련 7개 모델
- `Curriculum`, `Lesson`, `Question`, `Attendance` 등

## 검증

마이그레이션 후 검증:

```sql
-- tenantId가 null인 레코드 확인
SELECT 'User' as model, COUNT(*) FROM "User" WHERE "tenantId" IS NULL
UNION ALL
SELECT 'Expense', COUNT(*) FROM "Expense" WHERE "tenantId" IS NULL
UNION ALL
SELECT 'Role', COUNT(*) FROM "Role" WHERE "tenantId" IS NULL;

-- 테넌트별 레코드 수 확인
SELECT "tenantId", COUNT(*) as count
FROM "User"
GROUP BY "tenantId";
```

## 문제 해결

### "모델을 찾을 수 없음" 오류

Prisma 클라이언트가 최신인지 확인:
```bash
npx prisma generate
```

### 외래 키 제약 조건 오류

마이그레이션 순서가 의존성을 고려하도록 설계되어 있습니다.
순서를 변경하지 마세요.

### 부분 마이그레이션 후 재실행

스크립트는 이미 tenantId가 있는 레코드는 건너뜁니다.
안전하게 여러 번 실행할 수 있습니다.

## 관련 파일

- `scripts/migrate-tenant-id.ts` - 마이그레이션 스크립트
- `scripts/migrate-tenant-id-rollback.ts` - 롤백 스크립트
- `lib/prisma-tenant-extension.ts` - 테넌트 스코프 모델 목록
- `prisma/schema.prisma` - 데이터베이스 스키마
