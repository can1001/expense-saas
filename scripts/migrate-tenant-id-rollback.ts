/**
 * tenantId 마이그레이션 롤백 스크립트
 *
 * 주의: 이 스크립트는 모든 레코드의 tenantId를 null로 되돌립니다.
 * 프로덕션에서는 신중하게 사용하세요.
 *
 * 실행 방법:
 *   # Dry-run (변경 없이 확인만)
 *   npx tsx scripts/migrate-tenant-id-rollback.ts --dry-run
 *
 *   # 실제 롤백 실행 (확인 필요)
 *   npx tsx scripts/migrate-tenant-id-rollback.ts --confirm
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 롤백 대상 모델 목록 (역순)
const ROLLBACK_ORDER = [
  // 로그/히스토리 모델들 먼저
  'fcmLog',
  'webPushLog',
  'notificationLog',
  'adminNotification',
  'offering',
  'accountReportCommitteeExpense',
  'accountReportLiability',
  'accountReportAsset',
  'accountReportReserve',
  'accountReportBankAccount',
  'accountReportExpense',
  'accountReportIncome',
  'userYearRoleHistory',
  'budgetDetailYearHistory',
  'simpleExpenseAttachment',
  'simpleExpenseItem',
  'approvalLog',
  'expenseAttachment',
  'expenseItem',
  'accountReport',
  'recitationSubmission',
  'studentPoints',
  'quizResponse',
  'attendance',
  'userYearRole',
  'recurringExpense',
  'simpleExpense',
  'expense',
  'departmentBudgetDetail',
  'budgetDetailYear',
  'expenseTemplate',
  'fcmToken',
  'pushSubscription',
  'notificationPreference',
  'userSignature',
  'savedBankAccount',
  'question',
  'budgetDetail',
  'lesson',
  'budgetSubcategory',
  'department',
  'user',
  'systemSetting',
  'curriculum',
  'budgetCategory',
  'committee',
  'role',
] as const;

async function rollbackModel(
  modelName: string,
  dryRun: boolean
): Promise<{ count: number; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[modelName];

    if (!model) {
      return { count: 0, error: '모델을 찾을 수 없음' };
    }

    // tenantId가 있는 레코드 수 조회
    const count = await model.count({
      where: { tenantId: { not: null } },
    });

    if (count === 0) {
      console.log(`  ✓ ${modelName}: 롤백 필요 없음`);
      return { count: 0 };
    }

    if (dryRun) {
      console.log(`  → ${modelName}: ${count}개 롤백 예정 (dry-run)`);
      return { count };
    }

    // 실제 롤백 실행
    const result = await model.updateMany({
      where: { tenantId: { not: null } },
      data: { tenantId: null },
    });

    console.log(`  ⏪ ${modelName}: ${result.count}개 롤백 완료`);
    return { count: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ ${modelName}: 오류 - ${message}`);
    return { count: 0, error: message };
  }
}

async function runRollback(options: { dryRun: boolean; confirm: boolean }): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  tenantId 마이그레이션 롤백');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  모드: ${options.dryRun ? 'Dry-run (변경 없음)' : '실제 롤백'}`);
  console.log('');

  if (!options.dryRun && !options.confirm) {
    console.log('⚠️  경고: 이 작업은 모든 레코드의 tenantId를 null로 되돌립니다.');
    console.log('    실행하려면 --confirm 옵션을 추가하세요.');
    console.log('    예: npx tsx scripts/migrate-tenant-id-rollback.ts --confirm');
    return;
  }

  console.log('🔄 롤백 시작...\n');

  let totalRolledBack = 0;
  let totalErrors = 0;

  for (const modelName of ROLLBACK_ORDER) {
    const result = await rollbackModel(modelName, options.dryRun);
    totalRolledBack += result.count;
    if (result.error) totalErrors++;
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  롤백 결과');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  롤백된 레코드: ${totalRolledBack}개`);
  console.log(`  오류: ${totalErrors}개 모델`);

  if (options.dryRun) {
    console.log('\n💡 실제 롤백을 실행하려면 --dry-run을 제거하고 --confirm을 추가하세요.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const confirm = args.includes('--confirm');

  try {
    await runRollback({ dryRun, confirm });
  } catch (error) {
    console.error('치명적 오류:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
