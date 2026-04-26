/**
 * 예산 세목 이름 원복 스크립트
 *
 * 목적: "예산외지출" → "(예산외세목)" 원복
 *
 * 대상 테이블:
 *   - BudgetDetail.name만 원복
 *   - ExpenseItem.budgetDetail은 유지 (원복하지 않음)
 *
 * 제외 조건:
 *   - "(예산외세목)_" 같은 특수 케이스가 아닌, 정확히 "예산외지출"인 항목만 원복
 *
 * 실행: npx tsx prisma/scripts/rollback-budget-detail-name.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_NAME = '예산외지출';
const NEW_NAME = '(예산외세목)';

async function main() {
  console.log('='.repeat(70));
  console.log('예산 세목 이름 원복 스크립트');
  console.log(`"${OLD_NAME}" → "${NEW_NAME}"`);
  console.log('='.repeat(70));
  console.log();

  // 1. 기존에 "(예산외세목)"이 있는 subcategoryId 목록 조회 (중복 방지)
  const existingNewName = await prisma.budgetDetail.findMany({
    where: { name: NEW_NAME },
    select: { subcategoryId: true, id: true }
  });
  const subcategoryIdsWithNewName = new Set(existingNewName.map(d => d.subcategoryId));
  console.log(`📋 기존 "${NEW_NAME}" 항목: ${existingNewName.length}개 (subcategoryId 기준)`);
  console.log();

  // 2. BudgetDetail.name 업데이트 대상 조회
  console.log('📋 BudgetDetail 조회 중...');
  const budgetDetails = await prisma.budgetDetail.findMany({
    where: { name: OLD_NAME },  // 정확히 "예산외지출"인 항목만
    include: {
      subcategory: {
        include: { category: true }
      },
      departmentDetails: {
        include: {
          department: {
            include: { committee: true }
          }
        }
      }
    }
  });

  console.log(`   발견: ${budgetDetails.length}개`);
  console.log();

  for (const detail of budgetDetails) {
    const deptInfo = detail.departmentDetails[0];
    const committeeName = deptInfo?.department.committee.name || '-';
    const deptName = deptInfo?.department.name || '-';
    const categoryName = detail.subcategory.category.name || '-';
    const subcategoryName = detail.subcategory.name || '-';
    const isDuplicate = subcategoryIdsWithNewName.has(detail.subcategoryId);
    const status = isDuplicate ? '⚠️ 중복' : '✓';
    console.log(`   ${status} [${detail.id}] ${committeeName} > ${deptName} > ${categoryName} > ${subcategoryName} > ${detail.name}`);
  }
  console.log();

  // 3. 확인 후 업데이트 실행 (중복 subcategoryId는 스킵)
  console.log('📝 업데이트 실행 중...');
  console.log();

  let budgetDetailUpdated = 0;
  let budgetDetailSkipped = 0;
  for (const detail of budgetDetails) {
    // 같은 subcategoryId에 이미 "(예산외세목)"이 있는지 확인
    if (subcategoryIdsWithNewName.has(detail.subcategoryId)) {
      console.log(`   ⏭️ BudgetDetail [${detail.id}]: 스킵 (이미 "${NEW_NAME}" 존재)`);
      budgetDetailSkipped++;
      continue;
    }

    await prisma.budgetDetail.update({
      where: { id: detail.id },
      data: { name: NEW_NAME }
    });
    // 업데이트 후 set에 추가 (다음 항목에서 중복 체크 위해)
    subcategoryIdsWithNewName.add(detail.subcategoryId);
    console.log(`   ✅ BudgetDetail [${detail.id}]: "${detail.name}" → "${NEW_NAME}"`);
    budgetDetailUpdated++;
  }

  console.log();
  console.log('='.repeat(70));
  console.log('📊 결과 요약');
  console.log('='.repeat(70));
  console.log(`   BudgetDetail 원복: ${budgetDetailUpdated}개`);
  console.log(`   BudgetDetail 스킵: ${budgetDetailSkipped}개 (중복)`);
  console.log();

  // 3. 특정 지출결의서 ExpenseItem 확인
  console.log('📋 특정 지출결의서 ExpenseItem 확인...');
  const targetExpenseId = 'cmof8uft5000ueq27l9av91x0';
  const expenseItems = await prisma.expenseItem.findMany({
    where: { expenseId: targetExpenseId },
    select: {
      id: true,
      budgetDetail: true,
      description: true
    }
  });

  console.log(`   지출결의서 ID: ${targetExpenseId}`);
  console.log(`   항목 수: ${expenseItems.length}개`);
  for (const item of expenseItems) {
    console.log(`   - [${item.id}] budgetDetail: "${item.budgetDetail}" / ${item.description}`);
  }
  console.log();

  console.log('✅ 원복 완료!');
  console.log('ℹ️  ExpenseItem은 변경하지 않음 (유지됨)');
}

main()
  .catch((e) => {
    console.error('❌ 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
