/**
 * 예산 세목 이름 변경 마이그레이션 스크립트
 *
 * 목적: "(예산외세목)" 패턴을 "예산외지출"로 변경
 *
 * 대상 테이블:
 *   - BudgetDetail.name
 *   - ExpenseItem.budgetDetail
 *
 * 중복 처리: 같은 subcategoryId에 이미 "예산외지출"이 있으면 해당 항목은 스킵
 *
 * 실행: npx tsx prisma/scripts/migrate-budget-detail-name.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_PATTERN = '(예산외세목)';
const NEW_PATTERN = '예산외지출';

async function main() {
  console.log('='.repeat(70));
  console.log('예산 세목 이름 변경 마이그레이션');
  console.log(`"${OLD_PATTERN}" → "${NEW_PATTERN}"`);
  console.log('='.repeat(70));
  console.log();

  // 1. 기존에 "예산외지출"이 있는 subcategoryId 목록 조회
  const existingNewPattern = await prisma.budgetDetail.findMany({
    where: { name: NEW_PATTERN },
    select: { subcategoryId: true, name: true }
  });
  const subcategoryIdsWithNewPattern = new Set(existingNewPattern.map(d => d.subcategoryId));
  console.log(`📋 기존 "${NEW_PATTERN}" 항목: ${existingNewPattern.length}개 (subcategoryId 기준)`);
  console.log();

  // 2. BudgetDetail.name 업데이트 대상 조회
  console.log('📋 BudgetDetail 조회 중...');
  const budgetDetails = await prisma.budgetDetail.findMany({
    where: { name: { contains: OLD_PATTERN } },
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
  for (const detail of budgetDetails) {
    const deptInfo = detail.departmentDetails[0];
    const committeeName = deptInfo?.department.committee.name || '-';
    const deptName = deptInfo?.department.name || '-';
    const isDuplicate = subcategoryIdsWithNewPattern.has(detail.subcategoryId);
    const status = isDuplicate ? '⚠️ 중복' : '✓';
    console.log(`   ${status} [${detail.id}] ${committeeName} > ${deptName} > ${detail.subcategory.name} > ${detail.name}`);
  }
  console.log();

  // 3. ExpenseItem.budgetDetail 업데이트 대상 조회
  console.log('📋 ExpenseItem 조회 중...');
  const expenseItems = await prisma.expenseItem.findMany({
    where: { budgetDetail: { contains: OLD_PATTERN } },
    include: {
      expense: {
        select: { id: true, applicantName: true }
      }
    }
  });

  console.log(`   발견: ${expenseItems.length}개`);
  for (const item of expenseItems) {
    console.log(`   - [${item.id}] Expense: ${item.expense.applicantName} / budgetDetail: ${item.budgetDetail}`);
  }
  console.log();

  // 4. 업데이트 실행
  console.log('📝 업데이트 실행 중...');
  console.log();

  // BudgetDetail 업데이트 (중복 subcategoryId는 스킵)
  let budgetDetailUpdated = 0;
  let budgetDetailSkipped = 0;
  for (const detail of budgetDetails) {
    const newName = detail.name.replace(OLD_PATTERN, NEW_PATTERN);

    // 같은 subcategoryId에 이미 newName이 있는지 확인
    if (subcategoryIdsWithNewPattern.has(detail.subcategoryId)) {
      console.log(`   ⏭️ BudgetDetail [${detail.id}]: 스킵 (이미 "${NEW_PATTERN}" 존재)`);
      budgetDetailSkipped++;
      continue;
    }

    await prisma.budgetDetail.update({
      where: { id: detail.id },
      data: { name: newName }
    });
    // 업데이트 후 set에 추가 (다음 항목에서 중복 체크 위해)
    subcategoryIdsWithNewPattern.add(detail.subcategoryId);
    console.log(`   ✅ BudgetDetail [${detail.id}]: "${detail.name}" → "${newName}"`);
    budgetDetailUpdated++;
  }

  // ExpenseItem 업데이트
  let expenseItemUpdated = 0;
  for (const item of expenseItems) {
    const newBudgetDetail = item.budgetDetail.replace(OLD_PATTERN, NEW_PATTERN);
    await prisma.expenseItem.update({
      where: { id: item.id },
      data: { budgetDetail: newBudgetDetail }
    });
    console.log(`   ✅ ExpenseItem [${item.id}]: "${item.budgetDetail}" → "${newBudgetDetail}"`);
    expenseItemUpdated++;
  }

  console.log();
  console.log('='.repeat(70));
  console.log('📊 결과 요약');
  console.log('='.repeat(70));
  console.log(`   BudgetDetail 변경: ${budgetDetailUpdated}개`);
  console.log(`   BudgetDetail 스킵: ${budgetDetailSkipped}개 (중복)`);
  console.log(`   ExpenseItem 변경: ${expenseItemUpdated}개`);
  console.log();
  console.log('✅ 마이그레이션 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
