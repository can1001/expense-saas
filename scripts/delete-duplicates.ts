/**
 * 자동이체에서 중복 생성된 지출결의서 삭제 스크립트
 * 각 월별로 가장 오래된 1건만 남기고 나머지 삭제
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      generatedExpenses: {
        select: {
          id: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' } // 오래된 순으로 정렬
      }
    }
  });

  const idsToDelete: string[] = [];

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

    // 같은 월에 2건 이상 있는 경우, 첫 번째(가장 오래된 것)를 제외하고 삭제 대상에 추가
    for (const [month, expenses] of Object.entries(monthlyGroups)) {
      if (expenses.length > 1) {
        // 첫 번째(가장 오래된 것)는 유지, 나머지는 삭제
        const toDelete = expenses.slice(1);
        for (const exp of toDelete) {
          idsToDelete.push(exp.id);
          console.log(`삭제 예정: ${recurring.name} | ${month} | ${exp.id}`);
        }
      }
    }
  }

  console.log(`\n=== 총 ${idsToDelete.length}건 삭제 예정 ===\n`);

  if (idsToDelete.length > 0) {
    const result = await prisma.expense.deleteMany({
      where: {
        id: { in: idsToDelete }
      }
    });
    console.log(`✅ ${result.count}건 삭제 완료`);
  } else {
    console.log('삭제할 항목이 없습니다.');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
