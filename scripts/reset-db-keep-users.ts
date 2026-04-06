/**
 * DB 초기화 스크립트 - User, Role 테이블 제외
 * 실행: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/reset-db-keep-users.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('DB 초기화 시작 (User, Role 테이블 제외)...\n');

  // 외래키 제약조건을 고려한 삭제 순서
  const deleteOperations = [
    // 1. 결재 관련 (가장 먼저)
    { name: 'ApprovalLog', fn: () => prisma.approvalLog.deleteMany() },
    { name: 'ApprovalStep', fn: () => prisma.approvalStep.deleteMany() },
    { name: 'ApprovalLine', fn: () => prisma.approvalLine.deleteMany() },

    // 2. 지출결의서 첨부파일/항목
    { name: 'ExpenseAttachment', fn: () => prisma.expenseAttachment.deleteMany() },
    { name: 'ExpenseItem', fn: () => prisma.expenseItem.deleteMany() },
    { name: 'Expense', fn: () => prisma.expense.deleteMany() },

    // 3. 예산 관련 히스토리/매핑
    { name: 'BudgetDetailYearHistory', fn: () => prisma.budgetDetailYearHistory.deleteMany() },
    { name: 'DepartmentBudgetDetail', fn: () => prisma.departmentBudgetDetail.deleteMany() },
    { name: 'BudgetDetailYear', fn: () => prisma.budgetDetailYear.deleteMany() },

    // 4. 예산 상세
    { name: 'BudgetDetail', fn: () => prisma.budgetDetail.deleteMany() },
    { name: 'BudgetSubcategory', fn: () => prisma.budgetSubcategory.deleteMany() },
    { name: 'BudgetCategory', fn: () => prisma.budgetCategory.deleteMany() },

    // 5. 조직 구조
    { name: 'Department', fn: () => prisma.department.deleteMany() },
    { name: 'Committee', fn: () => prisma.committee.deleteMany() },

    // 6. 사용자 연도별 역할 (User는 유지)
    { name: 'UserYearRoleHistory', fn: () => prisma.userYearRoleHistory.deleteMany() },
    { name: 'UserYearRole', fn: () => prisma.userYearRole.deleteMany() },

    // 7. 저장된 계좌
    { name: 'SavedBankAccount', fn: () => prisma.savedBankAccount.deleteMany() },
  ];

  let successCount = 0;
  let skipCount = 0;

  for (const op of deleteOperations) {
    try {
      const result = await op.fn();
      if (result.count > 0) {
        console.log(`✓ ${op.name}: ${result.count}개 삭제됨`);
        successCount++;
      } else {
        console.log(`- ${op.name}: 데이터 없음`);
        skipCount++;
      }
    } catch (error: any) {
      // 테이블이 존재하지 않는 경우 무시
      if (error.code === 'P2021') {
        console.log(`⊘ ${op.name}: 테이블 없음 (스킵)`);
        skipCount++;
      } else {
        console.error(`✗ ${op.name}: ${error.message}`);
      }
    }
  }

  console.log(`\n완료! 삭제: ${successCount}, 스킵: ${skipCount}`);
  console.log('User, Role 테이블은 유지됨');
}

main()
  .catch((e) => {
    console.error('오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
