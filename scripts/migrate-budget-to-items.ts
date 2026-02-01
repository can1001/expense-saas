/**
 * 마이그레이션 스크립트: Expense의 budgetCategory/budgetSubcategory를 ExpenseItem으로 복사
 *
 * 단계:
 * 1. ExpenseItem에 budgetCategory/budgetSubcategory 컬럼 추가 (없으면)
 * 2. Expense에서 ExpenseItem으로 데이터 복사
 * 3. 인덱스 추가
 *
 * 실행 방법:
 *   npx dotenv -e .env -- npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-budget-to-items.ts
 */

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();

  try {
    console.log('='.repeat(60));
    console.log('Expense → ExpenseItem 예산 정보 마이그레이션');
    console.log('='.repeat(60));

    // Step 1: ExpenseItem에 컬럼 추가 (없으면)
    console.log('\n📦 Step 1: ExpenseItem에 컬럼 추가...');

    // budgetCategory 컬럼 확인 및 추가
    const checkCategory = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ExpenseItem' AND column_name = 'budgetCategory'
    `);

    if (checkCategory.rows.length === 0) {
      await client.query(`
        ALTER TABLE "ExpenseItem"
        ADD COLUMN "budgetCategory" TEXT NOT NULL DEFAULT ''
      `);
      console.log('   ✅ budgetCategory 컬럼 추가됨');
    } else {
      console.log('   ⏭️  budgetCategory 컬럼 이미 존재');
    }

    // budgetSubcategory 컬럼 확인 및 추가
    const checkSubcategory = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ExpenseItem' AND column_name = 'budgetSubcategory'
    `);

    if (checkSubcategory.rows.length === 0) {
      await client.query(`
        ALTER TABLE "ExpenseItem"
        ADD COLUMN "budgetSubcategory" TEXT NOT NULL DEFAULT ''
      `);
      console.log('   ✅ budgetSubcategory 컬럼 추가됨');
    } else {
      console.log('   ⏭️  budgetSubcategory 컬럼 이미 존재');
    }

    // Step 2: 데이터 복사
    console.log('\n📋 Step 2: 데이터 복사 (Expense → ExpenseItem)...');

    const result = await client.query(`
      UPDATE "ExpenseItem" ei
      SET "budgetCategory" = e."budgetCategory",
          "budgetSubcategory" = e."budgetSubcategory"
      FROM "Expense" e
      WHERE ei."expenseId" = e.id
        AND e."budgetCategory" IS NOT NULL
        AND e."budgetSubcategory" IS NOT NULL
        AND (ei."budgetCategory" = '' OR ei."budgetCategory" IS NULL)
    `);

    console.log(`   ✅ ${result.rowCount}개 항목 업데이트됨`);

    // Step 3: 인덱스 추가 (없으면)
    console.log('\n📊 Step 3: 인덱스 확인...');

    const checkIndex = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'ExpenseItem'
        AND indexname = 'ExpenseItem_budgetCategory_budgetSubcategory_idx'
    `);

    if (checkIndex.rows.length === 0) {
      await client.query(`
        CREATE INDEX "ExpenseItem_budgetCategory_budgetSubcategory_idx"
        ON "ExpenseItem" ("budgetCategory", "budgetSubcategory")
      `);
      console.log('   ✅ 인덱스 추가됨');
    } else {
      console.log('   ⏭️  인덱스 이미 존재');
    }

    // Step 4: 검증
    console.log('\n🔍 Step 4: 검증...');

    const emptyCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM "ExpenseItem"
      WHERE "budgetCategory" = '' OR "budgetCategory" IS NULL
    `);

    const emptyCount = parseInt(emptyCheck.rows[0].count);
    if (emptyCount > 0) {
      console.log(`   ⚠️  경고: ${emptyCount}개 항목의 budgetCategory가 비어있습니다.`);
    } else {
      console.log('   ✅ 모든 항목에 budgetCategory가 설정되었습니다.');
    }

    // 샘플 확인
    const sample = await client.query(`
      SELECT ei.id, ei."budgetCategory", ei."budgetSubcategory", ei."budgetDetail"
      FROM "ExpenseItem" ei
      WHERE ei."budgetCategory" != ''
      LIMIT 3
    `);

    if (sample.rows.length > 0) {
      console.log('\n📝 샘플 데이터:');
      sample.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.budgetCategory} > ${row.budgetSubcategory} > ${row.budgetDetail}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('마이그레이션 완료!');
    console.log('');
    console.log('다음 단계: npx dotenv -e .env -- npx prisma db push --accept-data-loss');
    console.log('='.repeat(60));

  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error('마이그레이션 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
