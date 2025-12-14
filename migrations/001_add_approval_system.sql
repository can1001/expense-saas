-- ========================================
-- 결재 시스템 마이그레이션 스크립트
-- 생성일: 2024-12-14
-- 설명: 지출결의서 결재 시스템 추가
-- ========================================

-- WARNING: Production DB에 적용하기 전에 반드시 백업하세요!
-- Neon 대시보드 > 프로젝트 > Branches > Create Branch (백업용)

BEGIN;

-- ========================================
-- 1. Enum 타입 생성
-- ========================================

-- 결재 상태 Enum
DO $$ BEGIN
    CREATE TYPE "ApprovalStatus" AS ENUM (
        'DRAFT',           -- 작성중
        'PENDING',         -- 결재 대기
        'IN_PROGRESS',     -- 결재 진행중
        'APPROVED',        -- 최종 승인
        'REJECTED',        -- 반려
        'WITHDRAWN'        -- 회수
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 결재 단계 상태 Enum
DO $$ BEGIN
    CREATE TYPE "StepStatus" AS ENUM (
        'PENDING',         -- 대기중
        'APPROVED',        -- 승인
        'REJECTED',        -- 반려
        'SKIPPED'          -- 건너뜀
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 결재 액션 타입 Enum
DO $$ BEGIN
    CREATE TYPE "ApprovalAction" AS ENUM (
        'SUBMIT',          -- 제출
        'APPROVE',         -- 승인
        'REJECT',          -- 반려
        'RESUBMIT',        -- 재제출
        'WITHDRAW',        -- 회수
        'MODIFY_LINE',     -- 결재선 수정
        'DELEGATE'         -- 위임/대리 지정
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- 2. Expense 테이블 컬럼 추가
-- ========================================

-- status 컬럼 추가 (기본값: DRAFT)
ALTER TABLE "Expense"
ADD COLUMN IF NOT EXISTS "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT';

-- 제출 일시
ALTER TABLE "Expense"
ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

-- 최종 승인 일시
ALTER TABLE "Expense"
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

-- 반려 일시
ALTER TABLE "Expense"
ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);

-- ========================================
-- 3. ApprovalLine 테이블 생성
-- ========================================

CREATE TABLE IF NOT EXISTS "ApprovalLine" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,

    -- 결재선 스냅샷 (제출 시점 고정)
    "snapshot" JSONB,

    -- 진행 상태
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "totalSteps" INTEGER NOT NULL,

    -- 긴급 처리 플래그
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,

    -- 메타
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalLine_pkey" PRIMARY KEY ("id")
);

-- ========================================
-- 4. ApprovalStep 테이블 생성
-- ========================================

CREATE TABLE IF NOT EXISTS "ApprovalStep" (
    "id" TEXT NOT NULL,
    "approvalLineId" TEXT NOT NULL,

    -- 단계 정보
    "stepNumber" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,

    -- 결재자 정보
    "approverName" TEXT NOT NULL,
    "approverEmail" TEXT,
    "approverTitle" TEXT,

    -- 대리 결재
    "delegatedTo" TEXT,
    "delegationReason" TEXT,

    -- 결재 상태
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "comment" TEXT,

    -- 필수 여부
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isParallel" BOOLEAN NOT NULL DEFAULT false,

    -- 메타
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- ========================================
-- 5. ApprovalLog 테이블 생성
-- ========================================

CREATE TABLE IF NOT EXISTS "ApprovalLog" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,

    -- 액션 정보
    "action" "ApprovalAction" NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT,
    "actorRole" TEXT,

    -- 결재 단계 정보
    "stepNumber" INTEGER,
    "stepName" TEXT,

    -- 상태 변화
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,

    -- 상세 정보
    "comment" TEXT,
    "metadata" JSONB,

    -- 스냅샷 (결재선 수정인 경우)
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,

    -- 메타
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalLog_pkey" PRIMARY KEY ("id")
);

-- ========================================
-- 6. 인덱스 생성
-- ========================================

-- ApprovalLine 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalLine_expenseId_key"
    ON "ApprovalLine"("expenseId");

CREATE INDEX IF NOT EXISTS "ApprovalLine_expenseId_idx"
    ON "ApprovalLine"("expenseId");

CREATE INDEX IF NOT EXISTS "ApprovalLine_currentStep_idx"
    ON "ApprovalLine"("currentStep");

-- ApprovalStep 인덱스
CREATE INDEX IF NOT EXISTS "ApprovalStep_approvalLineId_idx"
    ON "ApprovalStep"("approvalLineId");

CREATE INDEX IF NOT EXISTS "ApprovalStep_stepNumber_idx"
    ON "ApprovalStep"("stepNumber");

CREATE INDEX IF NOT EXISTS "ApprovalStep_approverName_idx"
    ON "ApprovalStep"("approverName");

CREATE INDEX IF NOT EXISTS "ApprovalStep_status_idx"
    ON "ApprovalStep"("status");

-- ApprovalLog 인덱스
CREATE INDEX IF NOT EXISTS "ApprovalLog_expenseId_idx"
    ON "ApprovalLog"("expenseId");

CREATE INDEX IF NOT EXISTS "ApprovalLog_action_idx"
    ON "ApprovalLog"("action");

CREATE INDEX IF NOT EXISTS "ApprovalLog_actorName_idx"
    ON "ApprovalLog"("actorName");

CREATE INDEX IF NOT EXISTS "ApprovalLog_createdAt_idx"
    ON "ApprovalLog"("createdAt");

-- Expense 추가 인덱스
CREATE INDEX IF NOT EXISTS "Expense_status_idx"
    ON "Expense"("status");

CREATE INDEX IF NOT EXISTS "Expense_applicantName_idx"
    ON "Expense"("applicantName");

-- ========================================
-- 7. 외래키 제약조건 추가
-- ========================================

-- ApprovalLine -> Expense
DO $$ BEGIN
    ALTER TABLE "ApprovalLine"
    ADD CONSTRAINT "ApprovalLine_expenseId_fkey"
    FOREIGN KEY ("expenseId")
    REFERENCES "Expense"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ApprovalStep -> ApprovalLine
DO $$ BEGIN
    ALTER TABLE "ApprovalStep"
    ADD CONSTRAINT "ApprovalStep_approvalLineId_fkey"
    FOREIGN KEY ("approvalLineId")
    REFERENCES "ApprovalLine"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- 8. 기존 데이터 마이그레이션 (선택사항)
-- ========================================

-- 기존 지출결의서의 status를 DRAFT로 설정 (이미 기본값으로 설정됨)
-- 필요시 추가 데이터 마이그레이션 로직 작성

-- ========================================
-- 9. 트리거 함수 생성 (updatedAt 자동 업데이트)
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ApprovalLine updatedAt 트리거
DROP TRIGGER IF EXISTS update_approvalline_updated_at ON "ApprovalLine";
CREATE TRIGGER update_approvalline_updated_at
    BEFORE UPDATE ON "ApprovalLine"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ApprovalStep updatedAt 트리거
DROP TRIGGER IF EXISTS update_approvalstep_updated_at ON "ApprovalStep";
CREATE TRIGGER update_approvalstep_updated_at
    BEFORE UPDATE ON "ApprovalStep"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ========================================
-- 10. 검증 쿼리
-- ========================================

-- 테이블 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('ApprovalLine', 'ApprovalStep', 'ApprovalLog')
ORDER BY table_name;

-- Expense 테이블 새 컬럼 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Expense'
AND column_name IN ('status', 'submittedAt', 'approvedAt', 'rejectedAt')
ORDER BY column_name;

-- 인덱스 확인
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND (tablename LIKE 'Approval%' OR indexname LIKE '%approval%')
ORDER BY tablename, indexname;
