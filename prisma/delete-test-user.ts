import { prisma } from '../lib/prisma';

async function deleteTestUser() {
  const userid = 'TestTest';

  // 1. 사용자 찾기
  const user = await prisma.user.findUnique({
    where: { userid },
    include: { expenses: true }
  });

  if (!user) {
    console.log('사용자를 찾을 수 없습니다.');
    return;
  }

  console.log(`삭제 대상: ${user.username} (${user.userid})`);
  console.log(`지출결의서 ${user.expenses.length}건`);

  // 2. 연도별 역할 해제 (UserYearRole)
  await prisma.userYearRole.deleteMany({
    where: { userId: user.id }
  });

  // 3. 예산 담당자 해제
  await prisma.budgetDetailYear.updateMany({
    where: { managerId: user.id },
    data: { managerId: null }
  });

  // 4. 지출결의서 삭제 (Cascade로 items, attachments, approvalLine 함께 삭제)
  await prisma.expense.deleteMany({
    where: { userId: user.id }
  });

  // 5. 사용자 삭제 (Cascade로 yearRoles, bankAccounts, signatures, notificationPreference 함께 삭제)
  await prisma.user.delete({
    where: { id: user.id }
  });

  console.log('삭제 완료');
}

deleteTestUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
