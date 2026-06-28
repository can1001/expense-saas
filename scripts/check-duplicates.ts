/**
 * 자동이체에서 중복 생성된 지출결의서 검사 스크립트
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      frequency: true,
      dayOfMonth: true,
      generatedExpenses: {
        select: {
          id: true,
          createdAt: true,
          status: true,
          requestAmount: true,
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  console.log('=== 자동이체별 중복 생성 검사 ===\n');

  let hasDuplicates = false;

  for (const recurring of recurringExpenses) {
    const monthlyGroups: Record<string, typeof recurring.generatedExpenses> = {};

    for (const expense of recurring.generatedExpenses) {
      const date = new Date(expense.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyGroups[monthKey] === undefined) {
        monthlyGroups[monthKey] = [];
      }
      monthlyGroups[monthKey].push(expense);
    }

    const duplicateMonths = Object.entries(monthlyGroups).filter(([, expenses]) => expenses.length > 1);

    if (duplicateMonths.length > 0) {
      hasDuplicates = true;
      console.log(`🔴 ${recurring.name} (ID: ${recurring.id})`);
      console.log(`   이체일: 매월 ${recurring.dayOfMonth}일`);

      for (const [month, expenses] of duplicateMonths) {
        console.log(`   📅 ${month}: ${expenses.length}건 중복`);
        for (const exp of expenses) {
          const date = new Date(exp.createdAt);
          console.log(`      - ${exp.id} | ${date.toISOString().slice(0, 10)} | ${exp.status} | ${exp.requestAmount.toLocaleString()}원`);
        }
      }
      console.log('');
    }
  }

  if (!hasDuplicates) {
    console.log('✅ 중복 생성된 지출결의서가 없습니다.');
  }

  console.log('\n=== 통계 ===');
  console.log(`총 자동이체 수: ${recurringExpenses.length}개`);
  console.log(`총 생성된 지출결의서: ${recurringExpenses.reduce((sum, r) => sum + r.generatedExpenses.length, 0)}건`);

  await prisma.$disconnect();
}

main().catch(console.error);
