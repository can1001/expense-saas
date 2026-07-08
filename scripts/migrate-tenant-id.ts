/**
 * 기존 데이터 tenantId 마이그레이션 스크립트
 *
 * 이 스크립트는 기존 단일 테넌트 데이터를 멀티테넌트 구조로 마이그레이션합니다.
 *
 * 실행 방법:
 *   # Dry-run (변경 없이 확인만)
 *   npx tsx scripts/migrate-tenant-id.ts --dry-run
 *
 *   # 실제 마이그레이션 실행
 *   npx tsx scripts/migrate-tenant-id.ts
 *
 *   # 특정 테넌트 ID로 마이그레이션
 *   npx tsx scripts/migrate-tenant-id.ts --tenant-id=existing-tenant-id
 *
 * 환경변수:
 *   MIGRATION_TENANT_NAME: 새 테넌트 이름 (기본: "기본 조직")
 *   MIGRATION_TENANT_SUBDOMAIN: 새 테넌트 서브도메인 (기본: "default")
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 마이그레이션 대상 모델 목록 (의존성 순서대로)
// 부모 모델이 먼저 오도록 정렬
const MIGRATION_ORDER = [
  // 1. 독립 모델들 (다른 테넌트 스코프 모델에 의존하지 않음)
  'role',
  'committee',
  'budgetCategory',
  'curriculum',
  'systemSetting',

  // 2. 1차 의존 모델들
  'user', // role에 의존
  'department', // committee에 의존
  'budgetSubcategory', // budgetCategory에 의존
  'lesson', // curriculum에 의존

  // 3. 2차 의존 모델들
  'budgetDetail', // budgetSubcategory에 의존
  'question', // lesson에 의존
  'savedBankAccount', // user에 의존
  'userSignature', // user에 의존
  'notificationPreference', // user에 의존
  'pushSubscription', // user에 의존
  'fcmToken', // user에 의존
  'expenseTemplate', // user에 의존

  // 4. 3차 의존 모델들
  'budgetDetailYear', // budgetDetail에 의존
  'departmentBudgetDetail', // department, budgetDetail에 의존
  'expense', // user, committee, department 등에 의존
  'simpleExpense', // user에 의존
  'recurringExpense', // user에 의존
  'userYearRole', // user, role에 의존
  'attendance', // user, lesson에 의존
  'quizResponse', // user, question에 의존
  'studentPoints', // user에 의존
  'recitationSubmission', // user, lesson에 의존
  'accountReport', // 독립적

  // 5. 4차 의존 모델들
  'expenseItem', // expense에 의존
  'expenseAttachment', // expense에 의존
  'approvalLog', // expense에 의존
  'simpleExpenseItem', // simpleExpense에 의존
  'simpleExpenseAttachment', // simpleExpense에 의존
  'budgetDetailYearHistory', // budgetDetailYear에 의존
  'userYearRoleHistory', // userYearRole에 의존
  'accountReportIncome', // accountReport에 의존
  'accountReportExpense', // accountReport에 의존
  'accountReportBankAccount', // accountReport에 의존
  'accountReportReserve', // accountReport에 의존
  'accountReportAsset', // accountReport에 의존
  'accountReportLiability', // accountReport에 의존
  'accountReportCommitteeExpense', // accountReport에 의존

  // 6. 독립적 로그 모델들
  'offering',
  'adminNotification',
  'notificationLog',
  'webPushLog',
  'fcmLog',
] as const;

interface MigrationStats {
  model: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

interface MigrationResult {
  success: boolean;
  tenantId: string;
  stats: MigrationStats[];
  errors: string[];
}

async function getOrCreateTenant(
  existingTenantId?: string
): Promise<{ id: string; name: string; isNew: boolean }> {
  // 기존 테넌트 ID가 제공된 경우
  if (existingTenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: existingTenantId },
    });
    if (tenant) {
      return { id: tenant.id, name: tenant.name, isNew: false };
    }
    throw new Error(`테넌트를 찾을 수 없습니다: ${existingTenantId}`);
  }

  // 기존 테넌트가 있는지 확인
  const existingTenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (existingTenant) {
    return { id: existingTenant.id, name: existingTenant.name, isNew: false };
  }

  // 새 테넌트 생성
  const name = process.env.MIGRATION_TENANT_NAME || '기본 조직';
  const subdomain = process.env.MIGRATION_TENANT_SUBDOMAIN || 'default';

  const newTenant = await prisma.tenant.create({
    data: {
      name,
      subdomain,
      orgType: 'CHURCH',
      plan: 'FREE',
      maxUsers: 10,
      maxStorageMB: 1024,
      planStartAt: new Date(),
    },
  });

  console.log(`✅ 새 테넌트 생성됨: ${newTenant.name} (${newTenant.id})`);
  return { id: newTenant.id, name: newTenant.name, isNew: true };
}

async function migrateModel(
  modelName: string,
  tenantId: string,
  dryRun: boolean
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    model: modelName,
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Prisma 클라이언트에서 동적으로 모델 접근
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[modelName];

    if (!model) {
      console.warn(`⚠️  모델을 찾을 수 없음: ${modelName}`);
      return stats;
    }

    // tenantId가 null인 레코드 수 조회
    const nullCount = await model.count({
      where: { tenantId: null },
    });

    // 이미 tenantId가 있는 레코드 수 조회
    const existingCount = await model.count({
      where: { tenantId: { not: null } },
    });

    stats.total = nullCount + existingCount;
    stats.skipped = existingCount;

    if (nullCount === 0) {
      console.log(`  ✓ ${modelName}: 마이그레이션 필요 없음 (${existingCount}개 이미 완료)`);
      return stats;
    }

    if (dryRun) {
      console.log(`  → ${modelName}: ${nullCount}개 마이그레이션 예정 (dry-run)`);
      stats.migrated = nullCount;
      return stats;
    }

    // 실제 마이그레이션 실행
    const result = await model.updateMany({
      where: { tenantId: null },
      data: { tenantId },
    });

    stats.migrated = result.count;
    console.log(`  ✅ ${modelName}: ${result.count}개 마이그레이션 완료`);
  } catch (error) {
    stats.errors = 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ ${modelName}: 오류 발생 - ${message}`);
  }

  return stats;
}

async function updateTenantCounts(tenantId: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    console.log('\n📊 테넌트 통계 업데이트 예정 (dry-run)');
    return;
  }

  console.log('\n📊 테넌트 통계 업데이트 중...');

  // 활성 사용자 수
  const activeUsers = await prisma.user.count({
    where: { tenantId, isActive: true },
  });

  // 전체 스토리지 사용량 (첨부파일 기준 - 실제로는 파일 크기 합산 필요)
  // 여기서는 0으로 초기화하고 실제 파일 시스템 사용량은 별도 계산 필요
  const currentStorage = 0;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      currentUsers: activeUsers,
      currentStorage,
    },
  });

  console.log(`  ✅ 현재 사용자 수: ${activeUsers}`);
}

async function runMigration(options: {
  dryRun: boolean;
  tenantId?: string;
}): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    tenantId: '',
    stats: [],
    errors: [],
  };

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  기존 데이터 tenantId 마이그레이션');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  모드: ${options.dryRun ? 'Dry-run (변경 없음)' : '실제 마이그레이션'}`);
  console.log('');

  try {
    // 1. 테넌트 확인/생성
    console.log('📦 테넌트 확인 중...');
    const tenant = await getOrCreateTenant(options.tenantId);
    result.tenantId = tenant.id;
    console.log(`  테넌트: ${tenant.name} (${tenant.id})`);
    console.log(`  ${tenant.isNew ? '(새로 생성됨)' : '(기존 테넌트 사용)'}`);
    console.log('');

    // 2. 각 모델 마이그레이션
    console.log('🔄 모델 마이그레이션 시작...\n');

    for (const modelName of MIGRATION_ORDER) {
      const stats = await migrateModel(modelName, tenant.id, options.dryRun);
      result.stats.push(stats);

      if (stats.errors > 0) {
        result.errors.push(`${modelName}: 오류 발생`);
      }
    }

    // 3. 테넌트 통계 업데이트
    await updateTenantCounts(tenant.id, options.dryRun);

    // 4. 결과 요약
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  마이그레이션 결과 요약');
    console.log('═══════════════════════════════════════════════════════════');

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const stats of result.stats) {
      totalMigrated += stats.migrated;
      totalSkipped += stats.skipped;
      totalErrors += stats.errors;
    }

    console.log(`  총 마이그레이션: ${totalMigrated}개 레코드`);
    console.log(`  이미 완료됨: ${totalSkipped}개 레코드`);
    console.log(`  오류: ${totalErrors}개 모델`);
    console.log('');

    if (options.dryRun) {
      console.log('💡 실제 마이그레이션을 실행하려면 --dry-run 옵션을 제거하세요.');
    }

    result.success = totalErrors === 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    console.error(`\n❌ 마이그레이션 실패: ${message}`);
  }

  return result;
}

// CLI 실행
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tenantIdArg = args.find((arg) => arg.startsWith('--tenant-id='));
  const tenantId = tenantIdArg?.split('=')[1];

  try {
    const result = await runMigration({ dryRun, tenantId });

    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error('치명적 오류:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
