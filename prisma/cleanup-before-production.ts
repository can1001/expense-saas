import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== 지급완료 제외 데이터 삭제 ===\n");

  // 삭제 대상 확인 (COMPLETED 제외)
  const toDelete = await prisma.expense.findMany({
    where: {
      paymentStatus: { not: "COMPLETED" }
    },
    select: { id: true, applicantName: true, paymentStatus: true, createdAt: true }
  });

  console.log(`삭제 대상: ${toDelete.length}건`);
  toDelete.forEach(e => console.log(`  - ${e.id} | ${e.applicantName} | ${e.paymentStatus}`));

  if (toDelete.length === 0) {
    console.log("삭제할 데이터가 없습니다.");
    return;
  }

  const expenseIds = toDelete.map(e => e.id);

  // ApprovalLog 삭제
  const logResult = await prisma.approvalLog.deleteMany({
    where: { expenseId: { in: expenseIds } }
  });
  console.log(`\nApprovalLog 삭제: ${logResult.count}건`);

  // NotificationLog 삭제
  const notifResult = await prisma.notificationLog.deleteMany({
    where: { expenseId: { in: expenseIds } }
  });
  console.log(`NotificationLog 삭제: ${notifResult.count}건`);

  // Expense 삭제
  const expenseResult = await prisma.expense.deleteMany({
    where: { paymentStatus: { not: "COMPLETED" } }
  });
  console.log(`Expense 삭제: ${expenseResult.count}건`);

  // 검증
  const remaining = await prisma.expense.findMany({
    select: { id: true, applicantName: true, paymentStatus: true }
  });
  console.log(`\n=== 남은 데이터 ===`);
  console.log(`총 ${remaining.length}건`);
  remaining.forEach(e => console.log(`  - ${e.applicantName} | ${e.paymentStatus}`));
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
