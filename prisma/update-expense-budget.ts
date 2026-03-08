/**
 * 지출결의서 예산 계층 변경 스크립트
 *
 * 사용 방법:
 *   npx tsx prisma/update-expense-budget.ts
 *
 * 변경 전에 아래 설정값들을 수정하세요:
 *   - EXPENSE_ID: 변경할 지출결의서 ID
 *   - FROM_DETAIL: 현재 세목명
 *   - TO_*: 변경할 예산 계층 값들
 *
 * 실행 예시 (2026-03-08):
 *   cmm073etc000027jjo3uibx24 결의서의 세목을
 *   "아웃팅비_기도팀" → "여성도모임"으로 변경
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Load environment variables from .env file
config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// ============================================
// 설정값 - 필요에 따라 수정하세요
// ============================================
const EXPENSE_ID = 'cmm073etc000027jjo3uibx24'; // 변경할 지출결의서 ID
const FROM_DETAIL = '아웃팅비_기도팀'; // 현재 세목명

// 변경할 값들
const TO_COMMITTEE = '목양위원회'; // 위원회
const TO_DEPARTMENT = '양육지원'; // 사역팀
const TO_CATEGORY = '양육사역비'; // 항
const TO_SUBCATEGORY = '양육지원비'; // 목
const TO_DETAIL = '여성도모임'; // 세목
// ============================================

async function updateExpenseBudget() {
  // 1. 현재 상태 확인
  const expense = await prisma.expense.findUnique({
    where: { id: EXPENSE_ID },
    include: { items: true },
  });

  if (!expense) {
    console.error(`결의서를 찾을 수 없습니다: ${EXPENSE_ID}`);
    return;
  }

  console.log('변경 전 Expense:', {
    committee: expense.committee,
    department: expense.department,
  });
  console.log('변경 전 Items:', expense.items);

  // 2. Expense 테이블 업데이트 (위원회, 사역팀)
  await prisma.expense.update({
    where: { id: EXPENSE_ID },
    data: {
      committee: TO_COMMITTEE,
      department: TO_DEPARTMENT,
    },
  });

  // 3. ExpenseItem 테이블 업데이트 (항, 목, 세목)
  const result = await prisma.expenseItem.updateMany({
    where: {
      expenseId: EXPENSE_ID,
      budgetDetail: FROM_DETAIL,
    },
    data: {
      budgetCategory: TO_CATEGORY,
      budgetSubcategory: TO_SUBCATEGORY,
      budgetDetail: TO_DETAIL,
    },
  });
  console.log('변경된 항목 수:', result.count);

  // 4. 변경 후 확인
  const updated = await prisma.expense.findUnique({
    where: { id: EXPENSE_ID },
    include: { items: true },
  });
  console.log('변경 후 Expense:', {
    committee: updated?.committee,
    department: updated?.department,
  });
  console.log('변경 후 Items:', updated?.items);
}

updateExpenseBudget()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
