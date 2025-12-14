# 결재 시스템 구현 가이드

## 개요

지출결의서 결재 시스템이 성공적으로 설계 및 구현되었습니다. 이 가이드는 시스템을 프로덕션 환경에 배포하기 위한 단계별 지침을 제공합니다.

## 구현된 기능

### ✅ 완료된 항목

1. **결재 규칙 정의** (`APPROVAL_RULES.md`)
   - 교회 조직 맞춤 3단계 결재 프로세스
   - 금액별 자동 결재선 생성 규칙
   - 자기결재 방지 및 보안 정책

2. **데이터 모델 설계** (`prisma/schema.prisma`)
   - `ApprovalStatus` enum
   - `ApprovalLine` 모델 (결재선)
   - `ApprovalStep` 모델 (결재 단계)
   - `ApprovalLog` 모델 (감사 로그)
   - `Expense` 모델 확장 (status, 타임스탬프 필드)

3. **비즈니스 로직** (`lib/approval-engine.ts`)
   - 자동 결재선 생성
   - 금액 기반 단계 결정
   - 결재 권한 검증
   - 상태 전이 관리
   - 스냅샷 생성

4. **API 엔드포인트**
   - `POST /api/expenses/[id]/submit` - 제출
   - `POST /api/expenses/[id]/approve` - 승인
   - `POST /api/expenses/[id]/reject` - 반려
   - `POST /api/expenses/[id]/withdraw` - 회수
   - `GET /api/expenses/[id]/approval` - 결재선 조회
   - `PUT /api/expenses/[id]/approval` - 결재선 수정

5. **UI 컴포넌트**
   - `ApprovalLineDisplay` - 결재선 표시
   - `ApprovalActionButtons` - 승인/반려 버튼
   - `ApprovalStatusBadge` - 상태 배지

## DB 마이그레이션 가이드

### 주의사항

⚠️ **PRODUCTION 환경에서 작업하고 있으므로 신중하게 진행하세요!**

### 단계별 적용 방법

#### 1단계: 백업

```bash
# Neon 대시보드에서 백업 생성 또는
# pg_dump를 사용한 수동 백업
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 2단계: 스키마 검증

```bash
# 로컬에서 스키마 검증 (dry-run)
npx prisma migrate dev --name add-approval-system --create-only

# 생성된 마이그레이션 파일 검토
cat prisma/migrations/[timestamp]_add-approval-system/migration.sql
```

#### 3단계: Production 적용

**옵션 A: Prisma Migrate 사용 (권장)**

```bash
# WARNING: Production DB에 직접 적용됩니다!
npx prisma migrate deploy
```

**옵션 B: 수동 SQL 실행 (더 안전)**

```sql
-- 1. Enum 생성
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');
CREATE TYPE "ApprovalAction" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'RESUBMIT', 'WITHDRAW', 'MODIFY_LINE', 'DELEGATE');

-- 2. Expense 테이블에 컬럼 추가
ALTER TABLE "Expense" ADD COLUMN "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Expense" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- 3. ApprovalLine 테이블 생성
CREATE TABLE "ApprovalLine" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "snapshot" JSONB,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "totalSteps" INTEGER NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalLine_pkey" PRIMARY KEY ("id")
);

-- 4. ApprovalStep 테이블 생성
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "approvalLineId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "approverName" TEXT NOT NULL,
    "approverEmail" TEXT,
    "approverTitle" TEXT,
    "delegatedTo" TEXT,
    "delegationReason" TEXT,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "comment" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isParallel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- 5. ApprovalLog 테이블 생성
CREATE TABLE "ApprovalLog" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "stepNumber" INTEGER,
    "stepName" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "comment" TEXT,
    "metadata" JSONB,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalLog_pkey" PRIMARY KEY ("id")
);

-- 6. 인덱스 생성
CREATE UNIQUE INDEX "ApprovalLine_expenseId_key" ON "ApprovalLine"("expenseId");
CREATE INDEX "ApprovalLine_expenseId_idx" ON "ApprovalLine"("expenseId");
CREATE INDEX "ApprovalLine_currentStep_idx" ON "ApprovalLine"("currentStep");

CREATE INDEX "ApprovalStep_approvalLineId_idx" ON "ApprovalStep"("approvalLineId");
CREATE INDEX "ApprovalStep_stepNumber_idx" ON "ApprovalStep"("stepNumber");
CREATE INDEX "ApprovalStep_approverName_idx" ON "ApprovalStep"("approverName");
CREATE INDEX "ApprovalStep_status_idx" ON "ApprovalStep"("status");

CREATE INDEX "ApprovalLog_expenseId_idx" ON "ApprovalLog"("expenseId");
CREATE INDEX "ApprovalLog_action_idx" ON "ApprovalLog"("action");
CREATE INDEX "ApprovalLog_actorName_idx" ON "ApprovalLog"("actorName");
CREATE INDEX "ApprovalLog_createdAt_idx" ON "ApprovalLog"("createdAt");

CREATE INDEX "Expense_status_idx" ON "Expense"("status");
CREATE INDEX "Expense_applicantName_idx" ON "Expense"("applicantName");

-- 7. 외래키 제약조건 추가
ALTER TABLE "ApprovalLine" ADD CONSTRAINT "ApprovalLine_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approvalLineId_fkey"
    FOREIGN KEY ("approvalLineId") REFERENCES "ApprovalLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

#### 4단계: Prisma Client 재생성

```bash
npx prisma generate
```

#### 5단계: 애플리케이션 재배포

```bash
# Render에서 자동 배포되거나
git push origin main

# 또는 수동 재배포 트리거
```

## 부서별 결재자 설정

`lib/approval-engine.ts` 파일의 `DEPARTMENT_APPROVERS` 객체를 수정하여 실제 결재자 정보를 설정하세요:

```typescript
const DEPARTMENT_APPROVERS: Record<string, ApproverMapping> = {
  '재정팀': {
    department: '재정팀',
    teamManager: '실제팀장이름',
    teamManagerEmail: 'manager@church.org',
    accountant: '실제회계이름',
    accountantEmail: 'accountant@church.org',
    financeManager: '실제재정팀장이름',
    financeManagerEmail: 'finance@church.org',
  },
  // 추가 부서...
};
```

**더 나은 방법**: 나중에 DB 테이블로 관리하도록 확장 가능

## 페이지 통합 예시

### 지출결의서 상세 페이지에 결재선 추가

`app/expenses/[id]/page.tsx` 파일 수정:

```typescript
import ApprovalLineDisplay from '@/components/approval/ApprovalLineDisplay';
import ApprovalActionButtons from '@/components/approval/ApprovalActionButtons';
import ApprovalStatusBadge from '@/components/approval/ApprovalStatusBadge';

export default async function ExpenseDetailPage({ params }: { params: { id: string } }) {
  const expense = await prisma.expense.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      approvalLine: {
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' },
          },
        },
      },
    },
  });

  // 현재 사용자 정보 (임시: 나중에 인증 시스템 추가)
  const currentUserName = '홍길동'; // TODO: 인증 시스템에서 가져오기

  // 현재 결재 대기 중인 결재자
  const currentApprover = expense.approvalLine?.steps.find(
    (s) => s.stepNumber === expense.approvalLine?.currentStep
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">지출결의서 상세</h1>
        <ApprovalStatusBadge status={expense.status} size="lg" />
      </div>

      {/* 결재 액션 버튼 */}
      <ApprovalActionButtons
        expenseId={expense.id}
        status={expense.status}
        currentUserName={currentUserName}
        currentApproverName={currentApprover?.approverName}
        applicantName={expense.applicantName}
      />

      {/* 결재선 */}
      <ApprovalLineDisplay
        approvalLine={expense.approvalLine}
        expenseStatus={expense.status}
      />

      {/* 기존 지출결의서 내용 */}
      {/* ... */}
    </div>
  );
}
```

## 테스트 시나리오

### 1. 제출 테스트

```bash
curl -X POST http://localhost:3000/api/expenses/[ID]/submit
```

### 2. 승인 테스트

```bash
curl -X POST http://localhost:3000/api/expenses/[ID]/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approverName": "김재정",
    "comment": "승인합니다"
  }'
```

### 3. 반려 테스트

```bash
curl -X POST http://localhost:3000/api/expenses/[ID]/reject \
  -H "Content-Type: application/json" \
  -d '{
    "approverName": "박회계",
    "comment": "증빙서류가 부족합니다"
  }'
```

### 4. 회수 테스트

```bash
curl -X POST http://localhost:3000/api/expenses/[ID]/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "applicantName": "홍길동",
    "comment": "수정이 필요합니다"
  }'
```

## 향후 개선 사항

### Phase 2 (확장 기능)

1. **인증/권한 시스템**
   - NextAuth.js 통합
   - 역할 기반 접근 제어 (RBAC)
   - 사용자 관리 UI

2. **결재자 DB 관리**
   - `Approver` 테이블 생성
   - 부서별 결재자 관리 UI
   - 대리/위임 설정 기능

3. **알림 시스템**
   - 이메일 알림
   - 슬랙/카카오톡 연동
   - 푸시 알림

4. **대시보드**
   - 결재 대기 목록
   - 결재 통계
   - 월별/분기별 리포트

### Phase 3 (고도화)

1. **모바일 앱**
   - React Native 앱
   - 모바일 승인 기능

2. **전자서명**
   - 법적 효력 있는 전자서명
   - 인감 관리

3. **회계 시스템 연동**
   - ERP 시스템 연동
   - 자동 회계 처리

## 문제 해결

### 일반적인 오류

1. **"자기결재 불가" 오류**
   - 원인: 작성자가 결재선에 포함됨
   - 해결: `lib/approval-engine.ts`의 부서별 결재자 매핑 수정

2. **"결재 권한 없음" 오류**
   - 원인: 현재 사용자가 지정된 결재자가 아님
   - 해결: `currentUserName` 확인

3. **"이미 제출된 문서" 오류**
   - 원인: 중복 제출 시도
   - 해결: 상태 확인 후 처리

## 지원

문제가 발생하면 다음을 확인하세요:

1. `APPROVAL_RULES.md` - 결재 규칙
2. Prisma 로그 확인
3. 브라우저 콘솔 에러
4. API 응답 에러 메시지

## 라이센스 및 저작권

이 결재 시스템은 expense-system 프로젝트의 일부입니다.
