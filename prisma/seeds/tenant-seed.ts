/**
 * 테넌트 시드 스크립트
 *
 * 실행:
 * npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/tenant-seed.ts
 *
 * 환경변수 (필수):
 * - TENANT_ADMIN_PASSWORD: 테넌트 관리자 비밀번호 (필수)
 * - DATABASE_URL: 데이터베이스 연결 문자열 (필수)
 */

import { PrismaClient, OrgType, PlanType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { getDefaultDataForOrgType } from '../../lib/tenant/default-chart-of-accounts';
import { ROLE_PERMISSION_PRESETS, RoleCode } from '../../lib/auth/permissions';

// .env 파일 로드
config();

// 필수 환경변수 검증
function validateEnvironment(): string {
  const password = process.env.TENANT_ADMIN_PASSWORD;
  if (!password) {
    console.error('❌ 오류: TENANT_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.');
    console.error('');
    console.error('사용법:');
    console.error('  TENANT_ADMIN_PASSWORD="YourSecurePassword123!" npx ts-node prisma/seeds/tenant-seed.ts');
    console.error('');
    console.error('또는 .env 파일에 추가:');
    console.error('  TENANT_ADMIN_PASSWORD=YourSecurePassword123!');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('❌ 오류: 비밀번호는 최소 12자 이상이어야 합니다.');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ 오류: DATABASE_URL 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  return password;
}

const defaultPassword = validateEnvironment();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// 샘플 테넌트 데이터
const sampleTenants = [
  {
    name: '청연교회',
    subdomain: 'chungyeon',
    orgType: OrgType.CHURCH,
    plan: PlanType.PRO,
    description: '청연교회 지출결의서 시스템',
    maxUsers: 200,
    maxStorageMB: 51200, // 50GB
  },
  {
    name: '소망교회',
    subdomain: 'somang',
    orgType: OrgType.CHURCH,
    plan: PlanType.BASIC,
    description: '소망교회 지출결의서 시스템',
    maxUsers: 50,
    maxStorageMB: 10240, // 10GB
  },
  {
    name: '테스트 단체',
    subdomain: 'test',
    orgType: OrgType.OTHER,
    plan: PlanType.FREE,
    description: '테스트용 단체',
    maxUsers: 10,
    maxStorageMB: 1024, // 1GB
  },
];

// 기본 역할 데이터
const defaultRoles = [
  {
    code: 'admin',
    name: '관리자',
    description: '시스템 전체 관리 권한',
    stepNumber: null,
    sortOrder: 1,
  },
  {
    code: 'finance_head',
    name: '재정팀장',
    description: '재정팀장 - 최종 결재 권한',
    stepNumber: 3,
    sortOrder: 2,
  },
  {
    code: 'accountant',
    name: '회계',
    description: '회계 담당자 - 2차 결재 권한',
    stepNumber: 2,
    sortOrder: 3,
  },
  {
    code: 'team_leader',
    name: '팀장',
    description: '팀장 - 1차 결재 권한',
    stepNumber: 1,
    sortOrder: 4,
  },
  {
    code: 'admin_assistant',
    name: '행정간사',
    description: '행정 지원 담당',
    stepNumber: null,
    sortOrder: 5,
  },
  {
    code: 'user',
    name: '일반 사용자',
    description: '일반 사용자',
    stepNumber: null,
    sortOrder: 6,
  },
];

async function seedTenant(
  tenantData: typeof sampleTenants[0],
  hashedPassword: string
): Promise<void> {
  // 기존 테넌트 확인
  const existing = await prisma.tenant.findUnique({
    where: { subdomain: tenantData.subdomain },
  });

  if (existing) {
    console.log(`[SKIP] 테넌트 '${tenantData.name}' (${tenantData.subdomain}) 이미 존재`);
    return;
  }

  // 트랜잭션으로 모든 데이터 생성
  await prisma.$transaction(async (tx) => {
    // 1. 테넌트 생성
    const tenant = await tx.tenant.create({
      data: {
        name: tenantData.name,
        subdomain: tenantData.subdomain,
        orgType: tenantData.orgType,
        plan: tenantData.plan,
        description: tenantData.description,
        maxUsers: tenantData.maxUsers,
        maxStorageMB: tenantData.maxStorageMB,
        isActive: true,
        planStartAt: new Date(),
      },
    });

    console.log(`[CREATE] 테넌트 '${tenant.name}' 생성 완료`);
    console.log(`  - ID: ${tenant.id}`);
    console.log(`  - Subdomain: ${tenant.subdomain}`);
    console.log(`  - Plan: ${tenant.plan}`);

    // 2. 기본 역할 생성
    console.log(`  - 역할 생성 중...`);
    const roleMap: Record<string, string> = {};

    for (const roleData of defaultRoles) {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          code: roleData.code,
          name: roleData.name,
          description: roleData.description,
          stepNumber: roleData.stepNumber,
          sortOrder: roleData.sortOrder,
          permissions: [...(ROLE_PERMISSION_PRESETS[roleData.code as RoleCode] ?? [])],
          isActive: true,
        },
      });
      roleMap[roleData.code] = role.id;
    }
    console.log(`    ${defaultRoles.length}개 역할 생성 완료`);

    // 3. 관리자 사용자 생성
    const adminUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        userid: `${tenantData.subdomain}admin`,
        username: '관리자',
        password: hashedPassword,
        role: 'admin',
        roleId: roleMap['admin'],
        isActive: true,
      },
    });

    console.log(`  - 관리자 계정 생성 완료`);
    console.log(`    - 아이디: ${adminUser.userid}`);
    console.log(`    - 비밀번호: [환경변수로 설정됨]`);

    // 4. 테스트 일반 사용자 생성
    const testUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        userid: `${tenantData.subdomain}user`,
        username: '테스트 사용자',
        password: hashedPassword,
        role: 'user',
        roleId: roleMap['user'],
        isActive: true,
      },
    });

    console.log(`  - 테스트 사용자 계정 생성 완료`);
    console.log(`    - 아이디: ${testUser.userid}`);
    console.log(`    - 비밀번호: [환경변수로 설정됨]`);

    // 5. 현재 사용자 수 업데이트
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { currentUsers: 2 },
    });

    // 6. 기본 계정과목 생성 (조직 유형에 따라)
    console.log(`  - 기본 계정과목 생성 중 (${tenantData.orgType})...`);
    const defaultData = getDefaultDataForOrgType(tenantData.orgType);

    let committeesCreated = 0;
    let departmentsCreated = 0;
    let categoriesCreated = 0;
    let subcategoriesCreated = 0;
    let detailsCreated = 0;

    // 위원회 및 부서 생성
    for (const committeeData of defaultData.committees) {
      const committee = await tx.committee.create({
        data: {
          tenantId: tenant.id,
          name: committeeData.name,
          sortOrder: committeeData.sortOrder,
          isActive: true,
        },
      });
      committeesCreated++;

      for (const deptData of committeeData.departments) {
        await tx.department.create({
          data: {
            tenantId: tenant.id,
            committeeId: committee.id,
            name: deptData.name,
            sortOrder: deptData.sortOrder,
            isActive: true,
          },
        });
        departmentsCreated++;
      }
    }

    // 예산 항목 생성
    for (const categoryData of defaultData.budgetCategories) {
      const category = await tx.budgetCategory.create({
        data: {
          tenantId: tenant.id,
          name: categoryData.name,
          sortOrder: categoryData.sortOrder,
          isActive: true,
        },
      });
      categoriesCreated++;

      for (const subcategoryData of categoryData.subcategories) {
        const subcategory = await tx.budgetSubcategory.create({
          data: {
            tenantId: tenant.id,
            categoryId: category.id,
            name: subcategoryData.name,
            sortOrder: subcategoryData.sortOrder,
            isActive: true,
          },
        });
        subcategoriesCreated++;

        for (const detailData of subcategoryData.details) {
          await tx.budgetDetail.create({
            data: {
              tenantId: tenant.id,
              subcategoryId: subcategory.id,
              name: detailData.name,
              accountCode: detailData.accountCode,
              description: detailData.description,
              sortOrder: detailData.sortOrder,
              isActive: true,
            },
          });
          detailsCreated++;
        }
      }
    }

    console.log(`    위원회 ${committeesCreated}개, 부서 ${departmentsCreated}개 생성`);
    console.log(`    예산항목: 항 ${categoriesCreated}개, 목 ${subcategoriesCreated}개, 세목 ${detailsCreated}개 생성`);
  });

  console.log('');
}

async function main() {
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  console.log('테넌트 시드 시작...\n');

  for (const tenantData of sampleTenants) {
    await seedTenant(tenantData, hashedPassword);
  }

  console.log('테넌트 시드 완료!\n');
  console.log('접속 방법:');
  console.log('  - 로컬: http://localhost:3000?tenant=chungyeon');
  console.log('  - 프로덕션: https://chungyeon.expense-saas.com');
  console.log('');
  console.log('⚠️  중요: 첫 로그인 후 비밀번호를 반드시 변경하세요!');
}

main()
  .catch((e) => {
    console.error('테넌트 시드 오류:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
