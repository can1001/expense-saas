-- DB 초기화 스크립트 - User, Role 테이블 제외
-- 외래키 제약조건을 고려한 삭제 순서

-- 1. 결재 관련
DELETE FROM "ApprovalLog";
DELETE FROM "ApprovalStep";
DELETE FROM "ApprovalLine";

-- 2. 지출결의서 첨부파일/항목
DELETE FROM "ExpenseAttachment";
DELETE FROM "ExpenseItem";
DELETE FROM "Expense";

-- 3. 간편 지출결의서
DELETE FROM "SimpleExpenseAttachment";
DELETE FROM "SimpleExpenseItem";
DELETE FROM "SimpleExpense";

-- 4. 예산 관련 히스토리/매핑
DELETE FROM "BudgetDetailYearHistory";
DELETE FROM "DepartmentBudgetDetail";
DELETE FROM "BudgetDetailYear";

-- 5. 예산 상세
DELETE FROM "BudgetDetail";
DELETE FROM "BudgetSubcategory";
DELETE FROM "BudgetCategory";

-- 6. 조직 구조
DELETE FROM "Department";
DELETE FROM "Committee";

-- 7. 마스터 데이터
DELETE FROM "BudgetMaster";

-- 8. 사용자 연도별 역할 (User는 유지)
DELETE FROM "UserYearRoleHistory";
DELETE FROM "UserYearRole";

-- 9. 저장된 계좌
DELETE FROM "SavedBankAccount";
