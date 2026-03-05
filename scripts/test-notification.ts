/**
 * 알림 서비스 로컬 테스트 스크립트
 *
 * 실행 방법:
 * npx tsx scripts/test-notification.ts
 */

import { config } from 'dotenv';
// .env 로드 (Prisma 초기화 전에 실행 필요)
config({ path: '.env' });

async function main() {
  // 환경변수 로드 후 동적 import
  const { notificationService } = await import('../lib/services/notification');
  const { prisma } = await import('../lib/prisma');

  console.log('=== 알림 서비스 테스트 시작 ===\n');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '설정됨' : '미설정');
  console.log('NOTIFICATION_ENABLED:', process.env.NOTIFICATION_ENABLED || '미설정');
  console.log('NOTIFICATION_HUB_APP_KEY:', process.env.NOTIFICATION_HUB_APP_KEY ? '설정됨' : '미설정 (테스트 모드)');
  console.log('');

  // 테스트용 데이터
  const testExpenseId = 'test-expense-' + Date.now();
  const testContext = {
    applicantName: '테스트사용자',
    requestAmount: 50000,
    department: '테스트부서',
    budgetDetail: '테스트예산',
  };

  // 1. SUBMIT 이벤트 테스트
  console.log('1. SUBMIT 알림 테스트...');
  const submitResults = await notificationService.notifyOnSubmit(
    testExpenseId,
    '010-1234-5678',
    'test-approver-user-id',
    '결재자테스트',
    testContext
  );
  console.log('   결과:', JSON.stringify(submitResults, null, 2));

  // 2. APPROVE 이벤트 테스트
  console.log('\n2. APPROVE 알림 테스트...');
  const approveResults = await notificationService.notifyOnApprove(
    testExpenseId,
    '010-9876-5432',
    'test-applicant-user-id',
    { ...testContext, approverName: '승인자' }
  );
  console.log('   결과:', JSON.stringify(approveResults, null, 2));

  // 3. NotificationLog 확인
  console.log('\n3. NotificationLog DB 확인...');
  const logs = await prisma.notificationLog.findMany({
    where: {
      expenseId: testExpenseId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`   총 ${logs.length}개 로그 기록됨:\n`);
  logs.forEach((log, i) => {
    console.log(`   [${i + 1}] ${log.eventType} - ${log.channel}`);
    console.log(`       수신자: ${log.recipientName} (${log.recipientPhone})`);
    console.log(`       상태: ${log.status}`);
    console.log(`       messageId: ${log.providerMessageId}`);
    console.log(`       메시지: ${log.message?.substring(0, 50)}...`);
    console.log('');
  });

  // 4. 테스트 데이터 정리 (선택)
  // await prisma.notificationLog.deleteMany({ where: { expenseId: testExpenseId } });

  console.log('=== 테스트 완료 ===');
  await prisma.$disconnect();
}

main().catch(console.error);
