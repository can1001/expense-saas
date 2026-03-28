/**
 * 예산 목(subcategory) 수정 스크립트
 *
 * 변경: 임차보증금 → 임차보증금(상환)적립금
 * (항: 적립금 하위)
 *
 * 실행: npx tsx scripts/update-budget-subcategory.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 예산 목(subcategory) 수정 시작 ===\n');

  // 1. 변경 전 확인
  console.log('📋 변경 전 데이터 확인:\n');

  const beforeSubcategory = await prisma.$queryRaw<any[]>`
    SELECT s.id, s.name as subcategory, c.name as category
    FROM "BudgetSubcategory" s
    JOIN "BudgetCategory" c ON s."categoryId" = c.id
    WHERE s.name LIKE '%임차보증금%'
  `;
  console.log('BudgetSubcategory:', beforeSubcategory);

  const beforeMaster = await prisma.$queryRaw<any[]>`
    SELECT id, category, subcategory, detail
    FROM "BudgetMaster"
    WHERE subcategory LIKE '%임차보증금%'
  `;
  console.log('BudgetMaster:', beforeMaster);

  const beforeExpenseItem = await prisma.$queryRaw<any[]>`
    SELECT id, "budgetCategory", "budgetSubcategory", "budgetDetail"
    FROM "ExpenseItem"
    WHERE "budgetSubcategory" LIKE '%임차보증금%'
  `;
  console.log('ExpenseItem:', beforeExpenseItem);

  const beforeSimpleExpenseItem = await prisma.$queryRaw<any[]>`
    SELECT id, "budgetCategory", "budgetSubcategory", "budgetDetail"
    FROM "SimpleExpenseItem"
    WHERE "budgetSubcategory" LIKE '%임차보증금%'
  `;
  console.log('SimpleExpenseItem:', beforeSimpleExpenseItem);

  // 2. 업데이트 실행
  console.log('\n🔄 업데이트 실행...\n');

  // 2-1. BudgetSubcategory 업데이트
  const result1 = await prisma.$executeRaw`
    UPDATE "BudgetSubcategory"
    SET name = '임차보증금(상환)적립금', "updatedAt" = NOW()
    WHERE name = '임차보증금'
    AND "categoryId" IN (SELECT id FROM "BudgetCategory" WHERE name = '적립금')
  `;
  console.log(`BudgetSubcategory 업데이트: ${result1}건`);

  // 2-2. BudgetMaster 업데이트
  const result2 = await prisma.$executeRaw`
    UPDATE "BudgetMaster"
    SET subcategory = '임차보증금(상환)적립금', "updatedAt" = NOW()
    WHERE category = '적립금' AND subcategory = '임차보증금'
  `;
  console.log(`BudgetMaster 업데이트: ${result2}건`);

  // 2-3. ExpenseItem 업데이트
  const result3 = await prisma.$executeRaw`
    UPDATE "ExpenseItem"
    SET "budgetSubcategory" = '임차보증금(상환)적립금'
    WHERE "budgetCategory" = '적립금' AND "budgetSubcategory" = '임차보증금'
  `;
  console.log(`ExpenseItem 업데이트: ${result3}건`);

  // 2-4. SimpleExpenseItem 업데이트
  const result4 = await prisma.$executeRaw`
    UPDATE "SimpleExpenseItem"
    SET "budgetSubcategory" = '임차보증금(상환)적립금'
    WHERE "budgetCategory" = '적립금' AND "budgetSubcategory" = '임차보증금'
  `;
  console.log(`SimpleExpenseItem 업데이트: ${result4}건`);

  // 3. 변경 후 확인
  console.log('\n✅ 변경 후 데이터 확인:\n');

  const afterSubcategory = await prisma.$queryRaw<any[]>`
    SELECT s.id, s.name as subcategory, c.name as category
    FROM "BudgetSubcategory" s
    JOIN "BudgetCategory" c ON s."categoryId" = c.id
    WHERE s.name LIKE '%임차보증금%'
  `;
  console.log('BudgetSubcategory:', afterSubcategory);

  const afterMaster = await prisma.$queryRaw<any[]>`
    SELECT id, category, subcategory, detail
    FROM "BudgetMaster"
    WHERE subcategory LIKE '%임차보증금%'
  `;
  console.log('BudgetMaster:', afterMaster);

  console.log('\n=== 완료 ===');
}

main()
  .catch((e) => {
    console.error('오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
