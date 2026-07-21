/**
 * (주)청연컨설팅 테넌트 시드 스크립트
 *
 * 제13기: 2026년01월01일 ~ 2026년12월31일 계정과목 기준
 *
 * 실행:
 * npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/chungyeon-consulting-seed.ts
 *
 * 환경변수 (필수):
 * - TENANT_ADMIN_PASSWORD: 테넌트 관리자 비밀번호 (필수)
 * - DATABASE_URL: 데이터베이스 연결 문자열 (필수)
 */

import { PrismaClient, OrgType, PlanType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { ROLE_PERMISSION_PRESETS, RoleCode } from '../../lib/auth/permissions';

config();

// 필수 환경변수 검증
function validateEnvironment(): string {
  const password = process.env.TENANT_ADMIN_PASSWORD;
  if (!password) {
    console.error('❌ 오류: TENANT_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.');
    console.error('');
    console.error('사용법:');
    console.error('  TENANT_ADMIN_PASSWORD="YourSecurePassword123!" npx ts-node prisma/seeds/chungyeon-consulting-seed.ts');
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

// 테넌트 정보
const tenantInfo = {
  name: '(주)청연컨설팅',
  subdomain: 'chungyeon-consulting',
  orgType: OrgType.COMPANY,
  plan: PlanType.PRO,
  description: '청연컨설팅 지출결의서 시스템 (제13기: 2026년)',
  maxUsers: 200,
  maxStorageMB: 51200,
};

// 기본 역할
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
    code: 'user',
    name: '일반 사용자',
    description: '일반 사용자',
    stepNumber: null,
    sortOrder: 5,
  },
];

// 위원회/부서 구조 (컨설팅 회사 조직)
const committees = [
  {
    name: '경영지원본부',
    sortOrder: 1,
    departments: [
      { name: '경영지원팀', sortOrder: 1 },
      { name: '재무팀', sortOrder: 2 },
      { name: '인사팀', sortOrder: 3 },
      { name: '총무팀', sortOrder: 4 },
    ],
  },
  {
    name: '환경사업본부',
    sortOrder: 2,
    departments: [
      { name: '환경측정팀', sortOrder: 1 },
      { name: '수질관리팀', sortOrder: 2 },
      { name: '대기관리팀', sortOrder: 3 },
      { name: '실험분석팀', sortOrder: 4 },
    ],
  },
  {
    name: '컨설팅본부',
    sortOrder: 3,
    departments: [
      { name: '환경컨설팅팀', sortOrder: 1 },
      { name: '안전컨설팅팀', sortOrder: 2 },
      { name: '기술지원팀', sortOrder: 3 },
    ],
  },
  {
    name: '영업본부',
    sortOrder: 4,
    departments: [
      { name: '영업1팀', sortOrder: 1 },
      { name: '영업2팀', sortOrder: 2 },
      { name: '고객지원팀', sortOrder: 3 },
    ],
  },
];

// 예산 계정과목 (PDF 기반 - 지출결의서에 사용되는 비용/경비 항목)
// PDF 코드 번호를 accountCode로 매핑
const budgetCategories = [
  {
    name: '인건비',
    sortOrder: 1,
    subcategories: [
      {
        name: '임원급여',
        sortOrder: 1,
        details: [
          { name: '임원급여', accountCode: '801', sortOrder: 1 },
        ],
      },
      {
        name: '직원급여',
        sortOrder: 2,
        details: [
          { name: '직원급여', accountCode: '802', sortOrder: 1 },
          { name: '상여금', accountCode: '803', sortOrder: 2 },
          { name: '제수당', accountCode: '804', sortOrder: 3 },
          { name: '잡급', accountCode: '805', sortOrder: 4 },
        ],
      },
      {
        name: '퇴직급여',
        sortOrder: 3,
        details: [
          { name: '퇴직급여충당금전입', accountCode: '806', sortOrder: 1 },
          { name: '퇴직급여', accountCode: '808', sortOrder: 2 },
          { name: '명예퇴직금', accountCode: '849', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '노무비',
    sortOrder: 2,
    subcategories: [
      {
        name: '직원근로',
        sortOrder: 1,
        details: [
          { name: '급여', accountCode: '503', sortOrder: 1 },
          { name: '임금', accountCode: '504', sortOrder: 2 },
          { name: '상여금', accountCode: '505', sortOrder: 3 },
          { name: '제수당', accountCode: '506', sortOrder: 4 },
          { name: '잡급', accountCode: '507', sortOrder: 5 },
        ],
      },
      {
        name: '퇴직관련',
        sortOrder: 2,
        details: [
          { name: '퇴직급여충당금전입', accountCode: '508', sortOrder: 1 },
          { name: '퇴직급여', accountCode: '510', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '복리후생비',
    sortOrder: 3,
    subcategories: [
      {
        name: '복리후생',
        sortOrder: 1,
        details: [
          { name: '복리후생비', accountCode: '511', sortOrder: 1 },
          { name: '복리후생비(판관비)', accountCode: '811', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '여비교통비',
    sortOrder: 4,
    subcategories: [
      {
        name: '여비교통',
        sortOrder: 1,
        details: [
          { name: '여비교통비', accountCode: '512', sortOrder: 1 },
          { name: '여비교통비(판관비)', accountCode: '812', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '접대비',
    sortOrder: 5,
    subcategories: [
      {
        name: '업무추진비',
        sortOrder: 1,
        details: [
          { name: '접대비(기업업무추진비)', accountCode: '513', sortOrder: 1 },
          { name: '접대비(판관비)', accountCode: '813', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '통신비',
    sortOrder: 6,
    subcategories: [
      {
        name: '통신',
        sortOrder: 1,
        details: [
          { name: '통신비', accountCode: '514', sortOrder: 1 },
          { name: '통신비(판관비)', accountCode: '814', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '수도광열비',
    sortOrder: 7,
    subcategories: [
      {
        name: '공과금',
        sortOrder: 1,
        details: [
          { name: '가스수도료', accountCode: '515', sortOrder: 1 },
          { name: '전력비', accountCode: '516', sortOrder: 2 },
          { name: '수도광열비(판관비)', accountCode: '815', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '세금과공과금',
    sortOrder: 8,
    subcategories: [
      {
        name: '세금공과',
        sortOrder: 1,
        details: [
          { name: '세금과공과금', accountCode: '517', sortOrder: 1 },
          { name: '세금과공과금(판관비)', accountCode: '817', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '감가상각비',
    sortOrder: 9,
    subcategories: [
      {
        name: '상각비',
        sortOrder: 1,
        details: [
          { name: '감가상각비', accountCode: '518', sortOrder: 1 },
          { name: '감가상각비(판관비)', accountCode: '818', sortOrder: 2 },
          { name: '무형고정자산상각', accountCode: '840', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '지급임차료',
    sortOrder: 10,
    subcategories: [
      {
        name: '임차료',
        sortOrder: 1,
        details: [
          { name: '지급임차료', accountCode: '519', sortOrder: 1 },
          { name: '지급임차료(판관비)', accountCode: '819', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '수선비',
    sortOrder: 11,
    subcategories: [
      {
        name: '수선유지',
        sortOrder: 1,
        details: [
          { name: '수선비', accountCode: '520', sortOrder: 1 },
          { name: '수선비(판관비)', accountCode: '820', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '보험료',
    sortOrder: 12,
    subcategories: [
      {
        name: '보험',
        sortOrder: 1,
        details: [
          { name: '보험료', accountCode: '521', sortOrder: 1 },
          { name: '보험료(판관비)', accountCode: '821', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '차량유지비',
    sortOrder: 13,
    subcategories: [
      {
        name: '차량관리',
        sortOrder: 1,
        details: [
          { name: '차량유지비', accountCode: '522', sortOrder: 1 },
          { name: '차량유지비(판관비)', accountCode: '822', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '연구개발비',
    sortOrder: 14,
    subcategories: [
      {
        name: '연구개발',
        sortOrder: 1,
        details: [
          { name: '경상연구개발비', accountCode: '523', sortOrder: 1 },
          { name: '연구개발비(판관비)', accountCode: '823', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '운반비',
    sortOrder: 15,
    subcategories: [
      {
        name: '운반',
        sortOrder: 1,
        details: [
          { name: '운반비', accountCode: '524', sortOrder: 1 },
          { name: '운반비(판관비)', accountCode: '824', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '교육훈련비',
    sortOrder: 16,
    subcategories: [
      {
        name: '교육',
        sortOrder: 1,
        details: [
          { name: '교육훈련비', accountCode: '525', sortOrder: 1 },
          { name: '교육훈련비(판관비)', accountCode: '825', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '도서인쇄비',
    sortOrder: 17,
    subcategories: [
      {
        name: '도서인쇄',
        sortOrder: 1,
        details: [
          { name: '도서인쇄비', accountCode: '526', sortOrder: 1 },
          { name: '도서인쇄비(판관비)', accountCode: '826', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '회의비',
    sortOrder: 18,
    subcategories: [
      {
        name: '회의',
        sortOrder: 1,
        details: [
          { name: '회의비', accountCode: '527', sortOrder: 1 },
          { name: '회의비(판관비)', accountCode: '827', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '사무용품비',
    sortOrder: 19,
    subcategories: [
      {
        name: '사무용품',
        sortOrder: 1,
        details: [
          { name: '사무용품비', accountCode: '529', sortOrder: 1 },
          { name: '사무용품비(판관비)', accountCode: '829', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '소모품비',
    sortOrder: 20,
    subcategories: [
      {
        name: '소모품',
        sortOrder: 1,
        details: [
          { name: '소모품비', accountCode: '530', sortOrder: 1 },
          { name: '소모품비(판관비)', accountCode: '830', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '지급수수료',
    sortOrder: 21,
    subcategories: [
      {
        name: '수수료',
        sortOrder: 1,
        details: [
          { name: '지급수수료', accountCode: '531', sortOrder: 1 },
          { name: '지급수수료(판관비)', accountCode: '831', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '외주비',
    sortOrder: 22,
    subcategories: [
      {
        name: '외주용역',
        sortOrder: 1,
        details: [
          { name: '외주가공비', accountCode: '533', sortOrder: 1 },
          { name: '외주비', accountCode: '836', sortOrder: 2 },
          { name: '외주공사비', accountCode: '638', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '시험비',
    sortOrder: 23,
    subcategories: [
      {
        name: '시험검사',
        sortOrder: 1,
        details: [
          { name: '시험비', accountCode: '534', sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: '광고선전비',
    sortOrder: 24,
    subcategories: [
      {
        name: '광고홍보',
        sortOrder: 1,
        details: [
          { name: '광고선전비', accountCode: '636', sortOrder: 1 },
          { name: '광고선전비(판관비)', accountCode: '833', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '판매촉진비',
    sortOrder: 25,
    subcategories: [
      {
        name: '판촉',
        sortOrder: 1,
        details: [
          { name: '판매촉진비', accountCode: '834', sortOrder: 1 },
          { name: '판매수수료', accountCode: '633', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '협회비',
    sortOrder: 26,
    subcategories: [
      {
        name: '협회단체',
        sortOrder: 1,
        details: [
          { name: '협회비', accountCode: '639', sortOrder: 1 },
          { name: '협회비(판관비)', accountCode: '845', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '잡비',
    sortOrder: 27,
    subcategories: [
      {
        name: '기타경비',
        sortOrder: 1,
        details: [
          { name: '잡비', accountCode: '536', sortOrder: 1 },
          { name: '잡비(판관비)', accountCode: '848', sortOrder: 2 },
          { name: '기밀비', accountCode: '535', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '원재료비',
    sortOrder: 28,
    subcategories: [
      {
        name: '재료비',
        sortOrder: 1,
        details: [
          { name: '원재료비', accountCode: '501', sortOrder: 1 },
          { name: '부재료비', accountCode: '502', sortOrder: 2 },
          { name: '원재료비(판관비)', accountCode: '841', sortOrder: 3 },
        ],
      },
    ],
  },
  {
    name: '설계용역비',
    sortOrder: 29,
    subcategories: [
      {
        name: '용역비',
        sortOrder: 1,
        details: [
          { name: '설계용역비', accountCode: '635', sortOrder: 1 },
          { name: '설계용역비(분양)', accountCode: '735', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '장비사용료',
    sortOrder: 30,
    subcategories: [
      {
        name: '장비',
        sortOrder: 1,
        details: [
          { name: '장비사용료', accountCode: '634', sortOrder: 1 },
          { name: '가설재손료', accountCode: '736', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '폐기물처리비',
    sortOrder: 31,
    subcategories: [
      {
        name: '환경처리',
        sortOrder: 1,
        details: [
          { name: '폐기물처리비', accountCode: '632', sortOrder: 1 },
          { name: '폐기물처리비(판관비)', accountCode: '832', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '하자보수비',
    sortOrder: 32,
    subcategories: [
      {
        name: '하자보수',
        sortOrder: 1,
        details: [
          { name: '하자보수비', accountCode: '627', sortOrder: 1 },
          { name: '하자보수충당금전입', accountCode: '847', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '대손상각비',
    sortOrder: 33,
    subcategories: [
      {
        name: '대손',
        sortOrder: 1,
        details: [
          { name: '대손상각비', accountCode: '835', sortOrder: 1 },
          { name: '기타의대손상각비', accountCode: '934', sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: '기부금',
    sortOrder: 34,
    subcategories: [
      {
        name: '기부',
        sortOrder: 1,
        details: [
          { name: '기부금', accountCode: '933', sortOrder: 1 },
        ],
      },
    ],
  },
];

async function main() {
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  console.log('(주)청연컨설팅 테넌트 시드 시작...\n');

  // 기존 테넌트 확인
  const existing = await prisma.tenant.findUnique({
    where: { subdomain: tenantInfo.subdomain },
  });

  if (existing) {
    console.log(`[SKIP] 테넌트 '${tenantInfo.name}' (${tenantInfo.subdomain}) 이미 존재`);
    console.log(`  - ID: ${existing.id}`);
    console.log('\n기존 테넌트를 삭제 후 다시 실행하거나, 다른 subdomain을 사용하세요.');
    return;
  }

  // 트랜잭션으로 모든 데이터 생성
  await prisma.$transaction(async (tx) => {
    // 1. 테넌트 생성
    const tenant = await tx.tenant.create({
      data: {
        name: tenantInfo.name,
        subdomain: tenantInfo.subdomain,
        orgType: tenantInfo.orgType,
        plan: tenantInfo.plan,
        description: tenantInfo.description,
        maxUsers: tenantInfo.maxUsers,
        maxStorageMB: tenantInfo.maxStorageMB,
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

    // 3. 관리자 계정 생성
    const adminUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        userid: 'chungyeon-admin',
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

    // 사용자 수 업데이트
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { currentUsers: 1 },
    });

    // 4. 위원회 및 부서 생성
    console.log(`  - 위원회/부서 생성 중...`);
    let committeesCreated = 0;
    let departmentsCreated = 0;

    for (const committeeData of committees) {
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
    console.log(`    위원회 ${committeesCreated}개, 부서 ${departmentsCreated}개 생성`);

    // 5. 예산 계정과목 생성
    console.log(`  - 예산 계정과목 생성 중...`);
    let categoriesCreated = 0;
    let subcategoriesCreated = 0;
    let detailsCreated = 0;

    for (const categoryData of budgetCategories) {
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
              sortOrder: detailData.sortOrder,
              isActive: true,
            },
          });
          detailsCreated++;
        }
      }
    }

    console.log(`    예산항목: 항 ${categoriesCreated}개, 목 ${subcategoriesCreated}개, 세목 ${detailsCreated}개 생성`);
  }, {
    // 원격 DB(Neon)에 다수의 순차 create가 발생하므로 기본 5초 타임아웃을 넉넉히 상향
    maxWait: 20000,
    timeout: 120000,
  });

  console.log('\n(주)청연컨설팅 테넌트 시드 완료!');
  console.log('\n접속 방법:');
  console.log(`  - 로컬: http://localhost:3002?tenant=${tenantInfo.subdomain}`);
  console.log(`  - 프로덕션: https://${tenantInfo.subdomain}.expense-saas.com`);
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
