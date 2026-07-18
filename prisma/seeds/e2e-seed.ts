/**
 * E2E 전용 테스트 DB 셋업 시드
 *
 * 로컬 Postgres의 e2e 전용 DB(예: expense_e2e)에 대해 실행한다.
 * users-seed / budget-seed 실행 후 마지막에 실행해야 한다.
 *
 * 하는 일:
 * 1. E2E 테넌트 생성 (subdomain: e2e)
 * 2. tenantId 가 NULL 인 시드 데이터를 전부 E2E 테넌트로 귀속
 *    (테넌트 스코핑 확장이 JWT tenantId 로 필터하므로 필수)
 * 3. testuser 비밀번호를 e2e 픽스처(test1234)와 일치시킴
 *
 * 실행:
 * DATABASE_URL="postgresql://localhost:5432/expense_e2e" pnpm run db:seed:e2e
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL ?? '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error('❌ e2e-seed 는 로컬 DB에만 실행할 수 있습니다. DATABASE_URL:', url);
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const E2E_TENANT_ID = 'e2e-test-tenant-0000000000';

// tenantId 컬럼을 가진, users-seed/budget-seed 가 생성하는 테이블들
const ADOPT_TABLES = [
  'User',
  'Role',
  'UserYearRole',
  'Committee',
  'Department',
  'BudgetCategory',
  'BudgetSubcategory',
  'BudgetDetail',
  'BudgetDetailYear',
  'DepartmentBudgetDetail',
];

async function main() {
  console.log('🧪 E2E 테넌트 셋업 시작...\n');

  await prisma.tenant.upsert({
    where: { id: E2E_TENANT_ID },
    update: { isActive: true },
    create: {
      id: E2E_TENANT_ID,
      name: 'E2E 테스트',
      subdomain: 'e2e',
      orgType: 'COMPANY',
      maxUsers: 1000,
      // settings 는 null 로 둔다 — resolveTenantSettings(A6)가 orgType 기본값으로 폴백
      isActive: true,
    },
  });
  console.log('✅ E2E 테넌트 생성/확인 완료');

  for (const table of ADOPT_TABLES) {
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "tenantId" = $1 WHERE "tenantId" IS NULL`,
      E2E_TENANT_ID
    );
    console.log(`   ↳ ${table}: ${updated}건 테넌트 귀속`);
  }

  // e2e 픽스처(e2e/fixtures/auth.ts)의 TEST_USER 비밀번호와 일치시킴
  const testuserHash = await bcrypt.hash('test1234', 10);
  const result = await prisma.user.updateMany({
    where: { userid: 'testuser' },
    data: { password: testuserHash },
  });
  console.log(`✅ testuser 비밀번호(test1234) 설정: ${result.count}건`);

  console.log('\n🎉 E2E 셋업 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
