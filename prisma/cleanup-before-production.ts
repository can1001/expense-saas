import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const cutoffDate = new Date("2026-02-06");

  console.log("=== 2026-02-06 이전 데이터 삭제 ===\n");

  // Step 1: 삭제 대상 확인
  const expensesToDelete = await prisma.expense.findMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
      createdAt: true,
      applicantName: true,
    },
  });

  console.log(`삭제 대상 지출결의서: ${expensesToDelete.length}건`);

  if (expensesToDelete.length === 0) {
    console.log("삭제할 데이터가 없습니다.");
    return;
  }

  const expenseIds = expensesToDelete.map((e) => e.id);

  console.log("\n삭제 대상 목록:");
  expensesToDelete.forEach((e) => {
    console.log(`  - ${e.id} | ${e.applicantName} | ${e.createdAt.toISOString()}`);
  });

  // Step 2: ApprovalLog 삭제 (Cascade 미설정)
  const logDeleteResult = await prisma.approvalLog.deleteMany({
    where: {
      expenseId: {
        in: expenseIds,
      },
    },
  });
  console.log(`\nApprovalLog 삭제: ${logDeleteResult.count}건`);

  // Step 3: NotificationLog 삭제 (Cascade 미설정)
  const notificationDeleteResult = await prisma.notificationLog.deleteMany({
    where: {
      expenseId: {
        in: expenseIds,
      },
    },
  });
  console.log(`NotificationLog 삭제: ${notificationDeleteResult.count}건`);

  // Step 4: Expense 삭제 (Cascade로 관련 테이블 자동 삭제)
  const expenseDeleteResult = await prisma.expense.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });
  console.log(`Expense 삭제: ${expenseDeleteResult.count}건`);
  console.log("  → ExpenseItem, ExpenseAttachment, ApprovalLine, ApprovalStep 자동 삭제");

  // Step 5: 검증
  const remainingCount = await prisma.expense.count({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`\n=== 삭제 완료 ===`);
  console.log(`남은 2026-02-06 이전 Expense: ${remainingCount}건`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
