// ============================================
// 프로덕션 환경 실행 차단
// NODE_ENV=development 일 때만 실행 가능
// ============================================
if (process.env.NODE_ENV !== 'development') {
  console.error('');
  console.error('❌ 오류: db:seed는 development 환경에서만 실행할 수 있습니다.');
  console.error('');
  console.error('   현재 NODE_ENV:', process.env.NODE_ENV || '(설정되지 않음)');
  console.error('');
  console.error('   실행 방법: NODE_ENV=development npm run db:seed');
  console.error('');
  process.exit(1);
}

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// 역할 코드 타입 (Role.code와 동일)
type UserRole = 'admin' | 'finance_head' | 'accountant' | 'team_leader' | 'admin_assistant' | 'user';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// 비밀번호 해시 함수
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

// .env 파일 로드
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 현재 연도
const CURRENT_YEAR = new Date().getFullYear();

// UserYearRole에 생성할 연도 목록 (현재 연도 + 이전 연도)
const YEARS_TO_SEED = [CURRENT_YEAR - 1, CURRENT_YEAR];

// 역할 시드 데이터
const rolesData = [
  {
    code: 'admin',
    name: '관리자',
    description: '시스템 관리자 - 모든 권한',
    stepNumber: null,
    sortOrder: 0,
    canApprove: false,
    canManageExpense: true,
    canAccessAdmin: true,
    canExportData: true,
    canRegisterUsers: true,
  },
  {
    code: 'finance_head',
    name: '재정팀장',
    description: '3차/최종 결재권자',
    stepNumber: 3,
    sortOrder: 1,
    canApprove: true,
    canManageExpense: true,
    canAccessAdmin: false,
    canExportData: true,
    canRegisterUsers: true,
  },
  {
    code: 'accountant',
    name: '회계',
    description: '2차 결재권자',
    stepNumber: 2,
    sortOrder: 2,
    canApprove: true,
    canManageExpense: true,
    canAccessAdmin: false,
    canExportData: true,
    canRegisterUsers: true,
  },
  {
    code: 'team_leader',
    name: '팀장',
    description: '1차 결재권자',
    stepNumber: 1,
    sortOrder: 3,
    canApprove: true,
    canManageExpense: false,
    canAccessAdmin: false,
    canExportData: false,
    canRegisterUsers: true,
  },
  {
    code: 'admin_assistant',
    name: '행정간사',
    description: '지출관리, 데이터 내보내기 권한',
    stepNumber: null,
    sortOrder: 4,
    canApprove: false,
    canManageExpense: true,
    canAccessAdmin: false,
    canExportData: true,
    canRegisterUsers: true,
  },
  {
    code: 'user',
    name: '사용자',
    description: '일반 사용자',
    stepNumber: null,
    sortOrder: 5,
    canApprove: false,
    canManageExpense: false,
    canAccessAdmin: false,
    canExportData: false,
    canRegisterUsers: false,
  },
];

// 역할 코드 → ID 캐시
const roleIdCache = new Map<string, string>();

/**
 * 역할 마스터 데이터 시드
 */
async function seedRoles() {
  console.log('\n🔑 Seeding roles...');

  for (const roleData of rolesData) {
    const role = await prisma.role.upsert({
      where: { code: roleData.code },
      update: {
        name: roleData.name,
        description: roleData.description,
        stepNumber: roleData.stepNumber,
        sortOrder: roleData.sortOrder,
        canApprove: roleData.canApprove,
        canManageExpense: roleData.canManageExpense,
        canAccessAdmin: roleData.canAccessAdmin,
        canExportData: roleData.canExportData,
        canRegisterUsers: roleData.canRegisterUsers,
      },
      create: roleData,
    });
    roleIdCache.set(roleData.code, role.id);
    console.log(`  ✓ ${roleData.code}: ${roleData.name}`);
  }

  console.log(`✅ Upserted ${rolesData.length} roles`);
}

// 사용자 시드 데이터
// - baseRole: User.role에 저장 (admin, user만 사용)
// - yearRole: UserYearRole에 저장 (연도별 역할) - 모든 연도에 동일하게 적용
// - password: 로그인 비밀번호 (E2E 테스트용)
const usersData: Array<{
  userid: string;
  username: string;
  baseRole: 'admin' | 'user';
  yearRole?: UserRole;        // 연도별 역할 (finance_head, accountant, team_leader, admin_assistant)
  departments?: string[];     // 복수 부서 지원 (팀장 겸직)
  password?: string;          // 로그인 비밀번호
}> = [
  // E2E 테스트 사용자
  { userid: '청연테스트', username: '테스트', baseRole: 'user', password: 'chc2026' },

  // 관리자/행정간사 (영구 역할)
  { userid: '청연송원경', username: '송원경', baseRole: 'user', yearRole: 'admin_assistant', departments: ['재정팀'] },

  // 재정팀장/회계 - 연도별 역할은 yearSpecificRoles에서 별도 관리
  { userid: '청연윤운문', username: '윤운문', baseRole: 'user' },
  { userid: '청연정혜종', username: '정혜종', baseRole: 'user', departments: ['재정팀'] },
  { userid: '청연신창국', username: '신창국', baseRole: 'user' },

  // 팀장 (DB 기준 2026년)
  { userid: '청연강홍재', username: '강홍재', baseRole: 'user', yearRole: 'team_leader', departments: ['목양팀'] },
  { userid: '청연김경민', username: '김경민', baseRole: 'user', yearRole: 'team_leader', departments: ['유년부'] },
  { userid: '청연김대현', username: '김대현', baseRole: 'user', yearRole: 'team_leader', departments: ['기획팀', '중고등부', '이웃사랑팀', '전교인행사TF'] },
  { userid: '청연김민광', username: '김민광', baseRole: 'user', yearRole: 'team_leader', departments: ['예배위원회/찬양팀'] },
  { userid: '청연김수정', username: '김수정', baseRole: 'user', yearRole: 'team_leader', departments: ['세바맘팀'] },
  { userid: '청연김영은', username: '김영은', baseRole: 'user', yearRole: 'team_leader', departments: ['새가족팀'] },
  { userid: '청연김예찬', username: '김예찬', baseRole: 'user', yearRole: 'team_leader', departments: ['방송팀'] },
  { userid: '청연김흥래', username: '김흥래', baseRole: 'user', yearRole: 'team_leader', departments: ['교육훈련위원회'] },
  { userid: '청연류지성', username: '류지성', baseRole: 'user', yearRole: 'team_leader', departments: ['마중물팀'] },
  { userid: '청연박영미', username: '박영미', baseRole: 'user', yearRole: 'team_leader', departments: ['영유아부'] },
  { userid: '청연박예송', username: '박예송', baseRole: 'user', yearRole: 'team_leader', departments: ['예배지원팀'] },
  { userid: '청연방순화', username: '방순화', baseRole: 'user', yearRole: 'team_leader', departments: ['기도팀'] },
  { userid: '청연서주형', username: '서주형', baseRole: 'user', yearRole: 'team_leader', departments: ['홍보팀'] },
  { userid: '청연양찬승', username: '양찬승', baseRole: 'user', yearRole: 'team_leader', departments: ['공간사역팀'] },
  { userid: '청연오혜성', username: '오혜성', baseRole: 'user', yearRole: 'team_leader', departments: ['청년유스'] },
  { userid: '청연유미정', username: '유미정', baseRole: 'user', yearRole: 'team_leader', departments: ['유치부'] },
  { userid: '청연이선아B', username: '이선아B', baseRole: 'user', yearRole: 'team_leader', departments: ['안내팀'] },
  { userid: '청연임대웅', username: '임대웅', baseRole: 'user', yearRole: 'team_leader', departments: ['양육지원'] },
  { userid: '청연조민경', username: '조민경', baseRole: 'user', yearRole: 'team_leader', departments: ['초등부'] },
  { userid: '청연최보영', username: '최보영', baseRole: 'user', yearRole: 'team_leader', departments: ['시설관리팀'] },
  { userid: '청연최준영', username: '최준영', baseRole: 'user', yearRole: 'team_leader', departments: ['청세포팀'] },
  { userid: '청연허지혜', username: '허지혜', baseRole: 'user', yearRole: 'team_leader', departments: ['찬양팀'] },
];

// 연도별 다른 역할이 필요한 사용자 설정
// 예: 신창국은 2025년 재정팀장, 윤운문은 2026년 재정팀장
const yearSpecificRoles: Array<{
  userid: string;
  year: number;
  role: UserRole;
  department?: string;
}> = [
  // 2025년 역할
  { userid: '청연신창국', year: 2025, role: 'finance_head' },
  { userid: '청연정혜종', year: 2025, role: 'accountant', department: '재정팀' },
  // 2026년 역할
  { userid: '청연윤운문', year: 2026, role: 'finance_head' },
  { userid: '청연정혜종', year: 2026, role: 'accountant', department: '재정팀' },
];

async function seedUsers() {
  console.log('\n👥 Seeding users...');
  console.log(`📅 Years to seed: ${YEARS_TO_SEED.join(', ')}`);

  let userCount = 0;
  let yearRoleCount = 0;

  for (const userData of usersData) {
    try {
      // roleId 조회
      const baseRoleId = roleIdCache.get(userData.baseRole);
      const yearRoleId = userData.yearRole ? roleIdCache.get(userData.yearRole) : null;

      // 대표 부서 (첫 번째 부서 또는 undefined)
      const primaryDepartment = userData.departments?.[0];

      // 1. User 생성/업데이트 (기본 역할)
      const hashedPassword = userData.password ? await hashPassword(userData.password) : null;
      const user = await prisma.user.upsert({
        where: { userid: userData.userid },
        update: {
          username: userData.username,
          role: userData.baseRole,
          roleId: baseRoleId,
          department: primaryDepartment,
          ...(hashedPassword && { password: hashedPassword }),
        },
        create: {
          userid: userData.userid,
          username: userData.username,
          role: userData.baseRole,
          roleId: baseRoleId,
          department: primaryDepartment,
          password: hashedPassword,
        },
      });
      userCount++;

      // 2. 연도별 역할이 있으면 각 연도/부서에 대해 UserYearRole 생성
      if (userData.yearRole) {
        const departments = userData.departments?.length ? userData.departments : [undefined];

        for (const year of YEARS_TO_SEED) {
          for (const dept of departments) {
            await prisma.userYearRole.upsert({
              where: {
                userId_year_department: {
                  userId: user.id,
                  year: year,
                  department: dept || '',
                },
              },
              update: {
                role: userData.yearRole,
                roleId: yearRoleId,
              },
              create: {
                userId: user.id,
                year: year,
                role: userData.yearRole,
                roleId: yearRoleId,
                department: dept,
              },
            });
            yearRoleCount++;
          }
        }
      }
    } catch (error: unknown) {
      console.error('Error inserting user:', userData, error);
    }
  }

  console.log(`✅ Upserted ${userCount}/${usersData.length} users`);
  console.log(`✅ Upserted ${yearRoleCount} year roles for years: ${YEARS_TO_SEED.join(', ')}`);

  // 기본 역할별 통계
  const baseRoleStats = await prisma.user.groupBy({
    by: ['role'],
    _count: true,
  });

  console.log('\n📊 User Statistics by Base Role:');
  for (const stat of baseRoleStats) {
    console.log(`  - ${stat.role}: ${stat._count} users`);
  }

  // 연도별 특수 역할 설정 (finance_head, accountant 등)
  // 먼저 기존 finance_head, accountant 역할 삭제 (중복 방지)
  console.log('\n📅 Clearing existing finance_head/accountant roles...');
  const deleteResult = await prisma.userYearRole.deleteMany({
    where: {
      role: { in: ['finance_head', 'accountant'] },
      year: { in: YEARS_TO_SEED },
    },
  });
  console.log(`  Deleted ${deleteResult.count} existing finance_head/accountant roles`);

  console.log('\n📅 Setting year-specific roles...');
  let yearSpecificCount = 0;

  for (const roleData of yearSpecificRoles) {
    // 해당 연도가 YEARS_TO_SEED에 포함되어 있는지 확인
    if (!YEARS_TO_SEED.includes(roleData.year)) {
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { userid: roleData.userid },
    });

    if (!user) {
      console.log(`  ⚠️ User not found: ${roleData.userid}`);
      continue;
    }

    const yearRoleId = roleIdCache.get(roleData.role);

    await prisma.userYearRole.upsert({
      where: {
        userId_year_department: {
          userId: user.id,
          year: roleData.year,
          department: roleData.department || '',
        },
      },
      update: {
        role: roleData.role,
        roleId: yearRoleId,
      },
      create: {
        userId: user.id,
        year: roleData.year,
        role: roleData.role,
        roleId: yearRoleId,
        department: roleData.department,
      },
    });
    yearSpecificCount++;
    console.log(`  ✓ ${roleData.userid} → ${roleData.role} (${roleData.year})`);
  }

  console.log(`✅ Set ${yearSpecificCount} year-specific roles`);

  // 연도별 역할 통계 (각 연도별)
  for (const year of YEARS_TO_SEED) {
    const yearRoleStats = await prisma.userYearRole.groupBy({
      by: ['role'],
      where: { year },
      _count: true,
    });

    console.log(`\n📊 Year Role Statistics (${year}):`);
    for (const stat of yearRoleStats) {
      console.log(`  - ${stat.role}: ${stat._count} users`);
    }
  }
}

/**
 * 예산 마스터 데이터 (정규화 테이블용)
 */
interface BudgetMasterItem {
  committee: string;
  department: string;
  category: string;
  subcategory: string;
  detail: string;
  manager?: string | null;
  accountCode?: string | null;
  description?: string | null;
  isActive?: boolean;
}

const budgetMasterData: BudgetMasterItem[] = [
  // 기획위원회
  { committee: '기획위원회', department: '기획팀', category: '사역지원비', subcategory: '기획비', detail: '행사비(전교인행사)', manager: '김대현', accountCode: '100.0', description: '전교인 나들이, 전교인 수련회, 전교인 체육대회' },
  { committee: '기획위원회', department: '기획팀', category: '사역지원비', subcategory: '기획비', detail: '아웃팅비', manager: '김대현', accountCode: '101.0', description: '단합 식사, 회의비' },
  { committee: '기획위원회', department: '기획팀', category: '사역지원비', subcategory: '기획비', detail: '(예산외세목)', manager: '김대현', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '기획위원회', department: '홍보팀', category: '사역지원비', subcategory: '홍보비', detail: '인쇄비', manager: '서주형', accountCode: '110.0', description: '내부홍보(유인물 및 시각자료 제작 등)' },
  { committee: '기획위원회', department: '홍보팀', category: '사역지원비', subcategory: '홍보비', detail: '사용료(구독료)', manager: '서주형', accountCode: '111.0', description: '콘텐츠 제작 소스 사이트 구독료' },
  { committee: '기획위원회', department: '홍보팀', category: '사역지원비', subcategory: '홍보비', detail: '아웃팅비', manager: '서주형', accountCode: '112.0', description: '단합 식사, 회의비' },
  { committee: '기획위원회', department: '홍보팀', category: '사역지원비', subcategory: '홍보비', detail: '(예산외세목)', manager: '서주형', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '기획위원회', department: '재정팀', category: '사무행정비', subcategory: '사무_회의및접대비', detail: '아웃팅비_재정팀', manager: '신창국', accountCode: '120.0', description: '단합 식사, 회의비' },
  { committee: '기획위원회', department: '재정팀', category: '사무행정비', subcategory: '사무_회의및접대비', detail: '(예산외세목)', manager: '신창국', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '기획위원회', department: '공간사역팀', category: '비전사역비', subcategory: '공간사역비', detail: '행사비(공간사역)', manager: '양찬승', accountCode: '130.0', description: '플리마켓 준비, 공연 준비, 행사 홍보 (SNS, 배너, 부착물 등), 이벤트 준비' },
  { committee: '기획위원회', department: '공간사역팀', category: '비전사역비', subcategory: '공간사역비', detail: '운영비', manager: '양찬승', accountCode: null, description: '리플릿, 베너 인쇄 제작비' },
  { committee: '기획위원회', department: '공간사역팀', category: '비전사역비', subcategory: '공간사역비', detail: '운영비(조사비)', manager: '양찬승', accountCode: null, description: '참여자 선물' },
  { committee: '기획위원회', department: '공간사역팀', category: '비전사역비', subcategory: '공간사역비', detail: '운영비(소모임)', manager: '양찬승', accountCode: null, description: '연공간 소모임 지원비' },
  { committee: '기획위원회', department: '공간사역팀', category: '비전사역비', subcategory: '공간사역비', detail: '인건비', manager: '신창국', accountCode: '131.0', description: '연공간 아르바이트' },
  { committee: '기획위원회', department: '공간사역팀', category: '비전사역비', subcategory: '공간사역비', detail: '아웃팅비', manager: '양찬승', accountCode: '132.0', description: '단합 식사, 회의비' },
  { committee: '기획위원회', department: '공간사역팀', category: '비전사역비', subcategory: '공간사역비', detail: '(예산외세목)', manager: '양찬승', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '기획위원회', department: '시설관리팀', category: '건물및시설유지관리비', subcategory: '시설유지보수비', detail: '시설보수비', manager: '이문희', accountCode: '140.0', description: '각종 교회 내 시설보수' },
  { committee: '기획위원회', department: '시설관리팀', category: '건물및시설유지관리비', subcategory: '시설유지보수비', detail: '아웃팅비', manager: '이문희', accountCode: '146.0', description: '단합 식사, 회의비' },
  { committee: '기획위원회', department: '시설관리팀', category: '건물및시설유지관리비', subcategory: '시설유지보수비', detail: '(예산외세목)', manager: '이문희', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '기획위원회', department: '이웃사랑팀', category: '비전사역비', subcategory: '이웃사랑사역비', detail: '후원(기관)', manager: '임한결', accountCode: '150.0', description: '야나후원, 신망원,둥근나라 법인지원금, 부활절, 성탄절 헌금 후원' },
  { committee: '기획위원회', department: '이웃사랑팀', category: '비전사역비', subcategory: '이웃사랑사역비', detail: '사역비', manager: '임한결', accountCode: null, description: '신망원 나들이,둥근나라 나들이,자립준비청년지원,런포더러브행사' },
  { committee: '기획위원회', department: '이웃사랑팀', category: '비전사역비', subcategory: '이웃사랑사역비', detail: '교육교제비', manager: '임한결', accountCode: '153.0', description: '봉사자 리트릿(나들이 봉사자 모임, 가정연계 격려식사 등)' },
  { committee: '기획위원회', department: '이웃사랑팀', category: '비전사역비', subcategory: '이웃사랑사역비', detail: '선교비(정기후원)', manager: '신창국', accountCode: '156.0', description: '고신총회,보안국가,여린교회' },
  { committee: '기획위원회', department: '이웃사랑팀', category: '비전사역비', subcategory: '이웃사랑사역비', detail: '선교비', manager: '임한결', accountCode: null, description: '선교70주년, 고려신학대학원' },
  { committee: '기획위원회', department: '이웃사랑팀', category: '비전사역비', subcategory: '이웃사랑사역비', detail: '(예산외세목)', manager: '임한결', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },

  // 예배위원회
  { committee: '예배위원회', department: '찬양팀', category: '예배사역비', subcategory: '찬양팀운영비', detail: '소모품비', manager: '김민광', accountCode: '200.0', description: '소모품(마이크 커버, 물티슈 등), 드럼 스틱, 악보(총보)' },
  { committee: '예배위원회', department: '찬양팀', category: '예배사역비', subcategory: '찬양팀운영비', detail: '관리운영비(악기보수)', manager: '김민광', accountCode: '202.0', description: '베이스 기타 및 건반 세팅 및 보수' },
  { committee: '예배위원회', department: '찬양팀', category: '예배사역비', subcategory: '찬양팀운영비', detail: '아웃팅비', manager: '김민광', accountCode: '205.0', description: '단합 식사, 간식' },
  { committee: '예배위원회', department: '찬양팀', category: '예배사역비', subcategory: '찬양팀운영비', detail: '(예산외세목)', manager: '김민광', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '예배위원회', department: '방송팀', category: '예배사역비', subcategory: '방송비', detail: '소모품비', manager: '김예찬', accountCode: '210.0', description: '건전지,각종pc용품등' },
  { committee: '예배위원회', department: '방송팀', category: '예배사역비', subcategory: '방송비', detail: '비품비', manager: '김예찬', accountCode: '212.0', description: '음향 영상장비 보수(마이크,헤드폰,아이패드등)' },
  { committee: '예배위원회', department: '방송팀', category: '예배사역비', subcategory: '방송비', detail: '아웃팅비', manager: '김예찬', accountCode: '213.0', description: '팀원 보수교육 및 워크샵' },
  { committee: '예배위원회', department: '방송팀', category: '예배사역비', subcategory: '방송비', detail: '(예산외세목)', manager: '김예찬', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '예배위원회', department: '안내팀', category: '예배사역비', subcategory: '예배준비비', detail: '아웃팅비_안내팀', manager: '전수희', accountCode: '220.0', description: '워크샵,회의식대' },
  { committee: '예배위원회', department: '안내팀', category: '예배사역비', subcategory: '예배준비비', detail: '(예산외세목)', manager: '전수희', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '예배위원회', department: '예배지원팀', category: '예배사역비', subcategory: '예배준비비', detail: '소모품비_예배지원팀', manager: '유정희', accountCode: '230.0', description: '성찬식(빵/포도주)' },
  { committee: '예배위원회', department: '예배지원팀', category: '예배사역비', subcategory: '예배준비비', detail: '행사비(선물)_예배지원팀', manager: '유정희', accountCode: '231.0', description: '학습,세례,입교,유아세례 등' },
  { committee: '예배위원회', department: '예배지원팀', category: '예배사역비', subcategory: '예배준비비', detail: '아웃팅비_예배지원팀', manager: '유정희', accountCode: '231.0', description: '단합 식사' },
  { committee: '예배위원회', department: '예배지원팀', category: '예배사역비', subcategory: '예배준비비', detail: '(예산외세목)', manager: '유정희', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '예배위원회', department: '기도팀', category: '섬김사역비', subcategory: '중보기도사역비', detail: '아웃팅비', manager: '방순화', accountCode: '240.0', description: '여성도,기도소그룹,워크샵' },
  { committee: '예배위원회', department: '기도팀', category: '섬김사역비', subcategory: '중보기도사역비', detail: '소모품비', manager: '방순화', accountCode: '243.0', description: '기도 소그룹 훈련 책자 등' },
  { committee: '예배위원회', department: '기도팀', category: '섬김사역비', subcategory: '중보기도사역비', detail: '(예산외세목)', manager: '방순화', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },

  // 목양위원회
  { committee: '목양위원회', department: '목양팀', category: '목양사역비', subcategory: '목양비', detail: '심방 교제비', manager: '강홍재', accountCode: '300.0', description: '교인심방' },
  { committee: '목양위원회', department: '목양팀', category: '목양사역비', subcategory: '목양비', detail: '아웃팅비', manager: '강홍재', accountCode: '302.0', description: '단합 식사, 회의비' },
  { committee: '목양위원회', department: '목양팀', category: '목양사역비', subcategory: '목양비', detail: '(예산외세목)', manager: '강홍재', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '목양위원회', department: '마중물팀', category: '목양사역비', subcategory: '마중물비', detail: '구제비', manager: '류지성', accountCode: '310.0', description: '구제대상 지원활동비' },
  { committee: '목양위원회', department: '마중물팀', category: '목양사역비', subcategory: '마중물비', detail: '아웃팅비', manager: '류지성', accountCode: '311.0', description: '단합 식사, 회의비' },
  { committee: '목양위원회', department: '마중물팀', category: '목양사역비', subcategory: '마중물비', detail: '(예산외세목)', manager: '류지성', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '목양위원회', department: '청년유스', category: '교육사역비', subcategory: '청년유스사역비', detail: '심방 교제비', manager: '임대웅', accountCode: '450.0', description: '심방비' },
  { committee: '목양위원회', department: '청년유스', category: '교육사역비', subcategory: '청년유스사역비', detail: '행사비(수련회)', manager: '임대웅', accountCode: '451.0', description: '여름/겨울 수련회' },
  { committee: '목양위원회', department: '청년유스', category: '교육사역비', subcategory: '청년유스사역비', detail: '행사비(기타)', manager: '임대웅', accountCode: '452.0', description: '기독교 행사(전시, 공연 등) 단체 참가비, 또래모임 프로그램' },
  { committee: '목양위원회', department: '청년유스', category: '교육사역비', subcategory: '청년유스사역비', detail: '소모품비', manager: '임대웅', accountCode: '453.0', description: '문구류 및 각종 비품 구매' },
  { committee: '목양위원회', department: '청년유스', category: '교육사역비', subcategory: '청년유스사역비', detail: '아웃팅비', manager: '임대웅', accountCode: '454.0', description: '단합 식사비, 또래 조장 회의 간식비' },
  { committee: '목양위원회', department: '청년유스', category: '교육사역비', subcategory: '청년유스사역비', detail: '(예산외세목)', manager: '임대웅', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(부부세미나)', manager: '임대웅', accountCode: '480.0', description: '부부세미나 다과비, 강사비' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '교육비(교재제작비)', manager: '임대웅', accountCode: '481.0', description: '결혼학교 수료패, 교육 교재 제작비(링바인더)' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(교사세미나)', manager: '임대웅', accountCode: '482.0', description: '교사세미나 다과/프로그램준비비' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(일대일양육)', manager: '임대웅', accountCode: '483.0', description: '일대일 양육 종강모임' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(상담학교)', manager: '임대웅', accountCode: '484.0', description: '상담학교 다과비, 강사비' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(전도학교)', manager: '임대웅', accountCode: '486.0', description: '전도학교 다과비, 강사비' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(스몰토크)', manager: '임대웅', accountCode: '488.0', description: '스몰토크' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(목자교육)', manager: '임대웅', accountCode: '489.0', description: '목자세미나' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(암송대회)', manager: '임대웅', accountCode: '493.0', description: '암송대회 선물' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(신입집사교육)', manager: '임대웅', accountCode: '494.0', description: '신입집사교육(간식비)' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(리더세미나)', manager: '임대웅', accountCode: '495.0', description: '리더교육(간식비)' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(고난만찬)', manager: '임대웅', accountCode: null, description: '고난만찬' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(위원회)', manager: '임대웅', accountCode: null, description: '위원장&팀장 모임 다과비' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '행사비(교역자워크샵)', manager: '임대웅', accountCode: null, description: '교역자 워크샵 지원비' },
  { committee: '목양위원회', department: '양육지원', category: '양육사역비', subcategory: '양육지원비', detail: '(예산외세목)', manager: '임대웅', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },

  // 교육훈련위원회
  { committee: '교육훈련위원회', department: '영유아부', category: '교육사역비', subcategory: '영유아사역비', detail: '교육교재비', manager: '박영미', accountCode: '400.0', description: '공과 구입, 컨텐츠 구입' },
  { committee: '교육훈련위원회', department: '영유아부', category: '교육사역비', subcategory: '영유아사역비', detail: '심방 교제비', manager: '박영미', accountCode: '402.0', description: '심방비' },
  { committee: '교육훈련위원회', department: '영유아부', category: '교육사역비', subcategory: '영유아사역비', detail: '행사비(성경학교)', manager: '박영미', accountCode: '403.0', description: '성경 학교' },
  { committee: '교육훈련위원회', department: '영유아부', category: '교육사역비', subcategory: '영유아사역비', detail: '행사비(선물)', manager: '박영미', accountCode: '404.0', description: '출산/생일/새친구 선물, 말씀기도표 시상, 연말시상, 성구암송' },
  { committee: '교육훈련위원회', department: '영유아부', category: '교육사역비', subcategory: '영유아사역비', detail: '행사비(기타)', manager: '박영미', accountCode: '405.0', description: '첫돌 축하, 학부모기도회' },
  { committee: '교육훈련위원회', department: '영유아부', category: '교육사역비', subcategory: '영유아사역비', detail: '소모품비', manager: '박영미', accountCode: '406.0', description: '각종 사무용품' },
  { committee: '교육훈련위원회', department: '영유아부', category: '교육사역비', subcategory: '영유아사역비', detail: '아웃팅비', manager: '박영미', accountCode: '407.0', description: '교사 단합비, 회의비' },
  { committee: '교육훈련위원회', department: '영유아부', category: '교육사역비', subcategory: '영유아사역비', detail: '(예산외세목)', manager: '박영미', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '교육훈련위원회', department: '유치부', category: '교육사역비', subcategory: '유치사역비', detail: '교육교재비', manager: '유미정', accountCode: '410.0', description: '공과 학생용/교사용, 가정용 그림책, 큐티키즈, 설교도구' },
  { committee: '교육훈련위원회', department: '유치부', category: '교육사역비', subcategory: '유치사역비', detail: '심방 교제비', manager: '유미정', accountCode: '411.0', description: '학생 및 학부모 심방비' },
  { committee: '교육훈련위원회', department: '유치부', category: '교육사역비', subcategory: '유치사역비', detail: '행사비(성경학교)', manager: '유미정', accountCode: '412.0', description: '여름/겨울 성경학교' },
  { committee: '교육훈련위원회', department: '유치부', category: '교육사역비', subcategory: '유치사역비', detail: '행사비(선물)', manager: '유미정', accountCode: '413.0', description: '생일/새친구 선물, 말씀기도표 시상, 졸업 및 수료식' },
  { committee: '교육훈련위원회', department: '유치부', category: '교육사역비', subcategory: '유치사역비', detail: '행사비(기타)', manager: '유미정', accountCode: '414.0', description: '암송대회, 피자 파티,반별 나들이, 오후 프로그램 준비물' },
  { committee: '교육훈련위원회', department: '유치부', category: '교육사역비', subcategory: '유치사역비', detail: '소모품비', manager: '유미정', accountCode: '415.0', description: '각종 사무용품' },
  { committee: '교육훈련위원회', department: '유치부', category: '교육사역비', subcategory: '유치사역비', detail: '아웃팅비', manager: '유미정', accountCode: '416.0', description: '교사 단합비, 회의비' },
  { committee: '교육훈련위원회', department: '유치부', category: '교육사역비', subcategory: '유치사역비', detail: '(예산외세목)', manager: '유미정', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '교육훈련위원회', department: '유년부', category: '교육사역비', subcategory: '유년사역비', detail: '교육교재비', manager: '김경민', accountCode: '420.0', description: '공과 학생용/교사용, 가정용 그림책, 큐티키즈, 설교도구' },
  { committee: '교육훈련위원회', department: '유년부', category: '교육사역비', subcategory: '유년사역비', detail: '심방 교제비', manager: '김경민', accountCode: '421.0', description: '학생 및 학부모 심방비' },
  { committee: '교육훈련위원회', department: '유년부', category: '교육사역비', subcategory: '유년사역비', detail: '행사비(성경학교)', manager: '김경민', accountCode: '422.0', description: '여름/겨울 성경학교' },
  { committee: '교육훈련위원회', department: '유년부', category: '교육사역비', subcategory: '유년사역비', detail: '행사비(선물)', manager: '김경민', accountCode: '423.0', description: '생일/새친구 선물, 말씀기도표 시상, 졸업 및 수료식' },
  { committee: '교육훈련위원회', department: '유년부', category: '교육사역비', subcategory: '유년사역비', detail: '행사비(기타)', manager: '김경민', accountCode: '424.0', description: '암송대회, 피자 파티,반별 나들이, 오후 프로그램 준비물' },
  { committee: '교육훈련위원회', department: '유년부', category: '교육사역비', subcategory: '유년사역비', detail: '아웃팅비', manager: '김경민', accountCode: '426.0', description: '교사 단합비, 회의비' },
  { committee: '교육훈련위원회', department: '유년부', category: '교육사역비', subcategory: '유년사역비', detail: '(예산외세목)', manager: '김경민', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '교육훈련위원회', department: '초등부', category: '교육사역비', subcategory: '초등사역비', detail: '교육교재비', manager: '조민경', accountCode: '430.0', description: '공과(멤버쉽, 교사/학생용, 매일묵상), 큐티, 성품교육' },
  { committee: '교육훈련위원회', department: '초등부', category: '교육사역비', subcategory: '초등사역비', detail: '심방 교제비', manager: '조민경', accountCode: '431.0', description: '심방비' },
  { committee: '교육훈련위원회', department: '초등부', category: '교육사역비', subcategory: '초등사역비', detail: '행사비(성경학교)', manager: '조민경', accountCode: '432.0', description: '여름/겨울 성경학교' },
  { committee: '교육훈련위원회', department: '초등부', category: '교육사역비', subcategory: '초등사역비', detail: '행사비(선물)', manager: '조민경', accountCode: '433.0', description: '생일(교사&학생)선물, 졸업 및 수료' },
  { committee: '교육훈련위원회', department: '초등부', category: '교육사역비', subcategory: '초등사역비', detail: '행사비(기타)', manager: '조민경', accountCode: '434.0', description: '성품교육 교보재 및 활동비' },
  { committee: '교육훈련위원회', department: '초등부', category: '교육사역비', subcategory: '초등사역비', detail: '소모품비', manager: '조민경', accountCode: '435.0', description: '각종 사무용품' },
  { committee: '교육훈련위원회', department: '초등부', category: '교육사역비', subcategory: '초등사역비', detail: '아웃팅비', manager: '조민경', accountCode: '436.0', description: '교사 단합비, 회의비' },
  { committee: '교육훈련위원회', department: '초등부', category: '교육사역비', subcategory: '초등사역비', detail: '(예산외세목)', manager: '조민경', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '교육훈련위원회', department: '중고등부', category: '교육사역비', subcategory: '중고등사역비', detail: '교육교재비', manager: '김대현', accountCode: '440.0', description: '공과구입(학생용, 교사용), 기타 세계관 문화교육, 큐티' },
  { committee: '교육훈련위원회', department: '중고등부', category: '교육사역비', subcategory: '중고등사역비', detail: '심방 교제비', manager: '김대현', accountCode: '441.0', description: '심방비' },
  { committee: '교육훈련위원회', department: '중고등부', category: '교육사역비', subcategory: '중고등사역비', detail: '행사비(수련회)', manager: '김대현', accountCode: '442.0', description: '여름/겨울 수련회' },
  { committee: '교육훈련위원회', department: '중고등부', category: '교육사역비', subcategory: '중고등사역비', detail: '행사비(선물)', manager: '김대현', accountCode: '443.0', description: '생일 선물' },
  { committee: '교육훈련위원회', department: '중고등부', category: '교육사역비', subcategory: '중고등사역비', detail: '행사비(기타)', manager: '김대현', accountCode: '444.0', description: '신입생 환영회, 모닥불 캠핑, 수능 응원' },
  { committee: '교육훈련위원회', department: '중고등부', category: '교육사역비', subcategory: '중고등사역비', detail: '소모품비', manager: '김대현', accountCode: '445.0', description: '각종 사무용품 구입' },
  { committee: '교육훈련위원회', department: '중고등부', category: '교육사역비', subcategory: '중고등사역비', detail: '아웃팅비', manager: '김대현', accountCode: '446.0', description: '교사 단합비, 회의비' },
  { committee: '교육훈련위원회', department: '중고등부', category: '교육사역비', subcategory: '중고등사역비', detail: '(예산외세목)', manager: '김대현', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '교육훈련위원회', department: '새가족팀', category: '양육사역비', subcategory: '새가족운영비', detail: '교육교재비', manager: '장태규', accountCode: '460.0', description: '교재비' },
  { committee: '교육훈련위원회', department: '새가족팀', category: '양육사역비', subcategory: '새가족운영비', detail: '행사비(선물)', manager: '장태규', accountCode: '461.0', description: '새가족 선물비(꽃값 포함)' },
  { committee: '교육훈련위원회', department: '새가족팀', category: '양육사역비', subcategory: '새가족운영비', detail: '행사비(환영회)', manager: '장태규', accountCode: '462.0', description: '식사, 진행준비비, 간식' },
  { committee: '교육훈련위원회', department: '새가족팀', category: '양육사역비', subcategory: '새가족운영비', detail: '아웃팅비', manager: '장태규', accountCode: '463.0', description: '교사 단합비' },
  { committee: '교육훈련위원회', department: '새가족팀', category: '양육사역비', subcategory: '새가족운영비', detail: '(예산외세목)', manager: '장태규', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '교육훈련위원회', department: '세바맘팀', category: '양육사역비', subcategory: '세바맘운영비', detail: '강사비', manager: '허지혜', accountCode: '470.0', description: '외부특강 강사비' },
  { committee: '교육훈련위원회', department: '세바맘팀', category: '양육사역비', subcategory: '세바맘운영비', detail: '다과간식비', manager: '허지혜', accountCode: '472.0', description: '행사 간식' },
  { committee: '교육훈련위원회', department: '세바맘팀', category: '양육사역비', subcategory: '세바맘운영비', detail: '아웃팅비', manager: '허지혜', accountCode: '473.0', description: '스태프 식사비, 회의비, 개강/종강 모임비, 조별단합비' },
  { committee: '교육훈련위원회', department: '세바맘팀', category: '양육사역비', subcategory: '세바맘운영비', detail: '(예산외세목)', manager: '허지혜', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },
  { committee: '교육훈련위원회', department: '청세포팀', category: '양육사역비', subcategory: '양육지원비', detail: '강사비', manager: '오승환', accountCode: '300.0', description: '외부특강 강사비' },
  { committee: '교육훈련위원회', department: '청세포팀', category: '양육사역비', subcategory: '양육지원비', detail: '아웃팅비', manager: '오승환', accountCode: '302.0', description: '단합 식사, 회의비' },
  { committee: '교육훈련위원회', department: '청세포팀', category: '양육사역비', subcategory: '양육지원비', detail: '(예산외세목)', manager: '오승환', accountCode: '157.0', description: '예산에 편성되지 아니한 지출' },

  // (가칭)행정위
  { committee: '(가칭)행정위', department: '행정비', category: '교역자사례비', subcategory: '사택관리비', detail: '담임목사 전세자금대출이자', manager: '신창국', accountCode: '500.0', description: '전세자금대출이자' },
  { committee: '(가칭)행정위', department: '행정비', category: '교역자사례비', subcategory: '사택관리비', detail: '담임목사 이사비용', manager: '신창국', accountCode: '501.0', description: '부동산 중개수수료, 이사비용' },
  { committee: '(가칭)행정위', department: '행정비', category: '교역자사례비', subcategory: '사택관리비', detail: '전임사역자 사택관리비', manager: '신창국', accountCode: '502.0', description: '월 관리비, 도시가스, 전기료' },
  { committee: '(가칭)행정위', department: '행정비', category: '예배사역비', subcategory: '강사사례비', detail: '강사사례비', manager: '신창국', accountCode: '510.0', description: '외부 강사 사례비, 특별 집회 강사비' },
  { committee: '(가칭)행정위', department: '행정비', category: '양육사역비', subcategory: '도서구입비', detail: '도서구입비', manager: '신창국', accountCode: '520.0', description: '담임목사 도서구입비, 교회 비치용(전교인사용) 도서구입' },
  { committee: '(가칭)행정위', department: '행정비', category: '섬김사역비', subcategory: '경조비', detail: '경조비', manager: '신창국', accountCode: '530.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '섬김사역비', subcategory: '주일식사비', detail: '주일식사비', manager: '신창국', accountCode: '531.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '섬김사역비', subcategory: '주차비', detail: '주차비', manager: '신창국', accountCode: '535.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '건물및시설유지관리비', subcategory: '비품비', detail: '고장 전자제품 교체', manager: '신창국', accountCode: '540.0', description: '고장 전자제품 수리 및 추가 구입' },
  { committee: '(가칭)행정위', department: '행정비', category: '건물및시설유지관리비', subcategory: '공간임차료', detail: '공간임차료', manager: '신창국', accountCode: '542.0', description: '407,410,411호 임차료, 전기 및 난방요금' },
  { committee: '(가칭)행정위', department: '행정비', category: '건물및시설유지관리비', subcategory: '시설유지보수비', detail: '장비임차료', manager: '신창국', accountCode: '543.0', description: '세콤,정수기,' },
  { committee: '(가칭)행정위', department: '행정비', category: '건물및시설유지관리비', subcategory: '건물관리비', detail: '건물관리비', manager: '신창국', accountCode: '544.0', description: '건물사용관리비, 교회청소비(외주), 화재보험료' },
  { committee: '(가칭)행정위', department: '행정비', category: '목회활동비', subcategory: '목회_통신비', detail: '목회_통신비', manager: '신창국', accountCode: '550.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '목회활동비', subcategory: '목회_회의 및 접대비', detail: '목회_회의 및 접대비', manager: '임대웅', accountCode: '552.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '목회활동비', subcategory: '교육지원비', detail: '교육지원비', manager: '임대웅', accountCode: '554.0', description: '교역자 워크샵' },
  { committee: '(가칭)행정위', department: '행정비', category: '목회활동비', subcategory: '차량관리비', detail: '차량관리비', manager: '신창국', accountCode: '555.0', description: '담임목사 차량지원비' },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '사무_통신비', detail: '사무_통신비', manager: '신창국', accountCode: '560.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '소모품및사무용품비', detail: '소모품및사무용품비', manager: '신창국', accountCode: '561.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '사무_회의및접대비', detail: '식대_운영위원회', manager: '신창국', accountCode: '562.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '인쇄비', detail: '인쇄비', manager: '신창국', accountCode: '564.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '여비교통비', detail: '여비교통비', manager: '신창국', accountCode: '565.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '지급수수료', detail: '세무사사무실 수수료', manager: '신창국', accountCode: '566.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '지급수수료', detail: '교회음악 저작권 연회비', manager: '신창국', accountCode: '567.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '지급수수료', detail: '유튜브 프리미엄 사용료', manager: '신창국', accountCode: '569.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '지급수수료', detail: '소프트웨어', manager: '신창국', accountCode: '570.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '지급수수료', detail: '기타', manager: '신창국', accountCode: '571.0', description: '용달운반비,' },
  { committee: '(가칭)행정위', department: '행정비', category: '사무행정비', subcategory: '잡지출', detail: '잡지출', manager: '신창국', accountCode: '572.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '상회부담금', subcategory: '상회부담금', detail: '상회부담금', manager: '신창국', accountCode: '580.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '상회부담금', subcategory: '상회부담금', detail: '동부시찰회 회비', manager: '신창국', accountCode: '581.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '예비비', subcategory: '예비비', detail: '예비비', manager: '신창국', accountCode: '590.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '적립금', subcategory: '임차보증금(상환)적립금', detail: '임차보증금(상환)적립금', manager: '신창국', accountCode: '600.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '적립금', subcategory: '방송시설적립금', detail: '방송시설적립금', manager: '신창국', accountCode: '601.0', description: null },
  { committee: '(가칭)행정위', department: '행정비', category: '잡지출', subcategory: '잡지출', detail: '잡지출', manager: '신창국', accountCode: '610.0', description: '교재(일대일양육), 교재(여성도 책모임), 성탄준비물 등' },

  // (가칭)인사위
  { committee: '(가칭)인사위', department: '인사위', category: '교역자사례비', subcategory: '담임목사생활비', detail: '담임목사생활비', manager: '신창국', accountCode: '500.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '교역자사례비', subcategory: '전임사역자생활비', detail: '전임사역자생활비', manager: '신창국', accountCode: '501.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '교역자사례비', subcategory: '준전임사역자생활비', detail: '준전임사역자생활비', manager: '신창국', accountCode: '502.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '교역자사례비', subcategory: '파트사역자생활비', detail: '파트사역자생활비', manager: '신창국', accountCode: '503.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '교역자사례비', subcategory: '교역자_복리후생비', detail: '교역자_복리후생비', manager: '신창국', accountCode: '504.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '교역자사례비', subcategory: '자녀학비보조비', detail: '자녀학비보조비', manager: '신창국', accountCode: '505.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '교역자사례비', subcategory: '학자금지원비', detail: '학자금지원비', manager: '신창국', accountCode: '506.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '교역자사례비', subcategory: '사택관리비', detail: '사택관리비', manager: '신창국', accountCode: '507.0', description: '담임목사 사택 관리비, 도시가스, 전세자금 대출이자' },
  { committee: '(가칭)인사위', department: '인사위', category: '교역자사례비', subcategory: '교역자식대', detail: '교역자식대', manager: '신창국', accountCode: '508.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '사무사역비', subcategory: '사무간사급여', detail: '사무간사급여', manager: '신창국', accountCode: '510.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '사무사역비', subcategory: '사무_복리후생비', detail: '사무_복리후생비', manager: '신창국', accountCode: '511.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '사무사역비', subcategory: '사무간사식대', detail: '사무간사식대', manager: '신창국', accountCode: '512.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '목회활동비', subcategory: '차량관리비', detail: '차량관리비', manager: '신창국', accountCode: '520.0', description: null },
  { committee: '(가칭)인사위', department: '인사위', category: '적립금', subcategory: '퇴직적립금', detail: '퇴직적립금', manager: '신창국', accountCode: '531.0', description: null },
];

/**
 * 정규화된 예산 테이블에 시드 데이터 삽입
 */
async function seedNormalizedBudget() {
  console.log('\n💰 Seeding normalized budget tables...');

  // 유효한 데이터만 필터링 (빈 필드가 없는 항목)
  const validData = budgetMasterData.filter(
    (item) => item.committee && item.department && item.category && item.subcategory && item.detail
  );

  console.log(`📊 Valid budget items: ${validData.length}/${budgetMasterData.length}`);

  // 사용자 이름 → ID 캐시 생성 (manager 연결용)
  const userCache = new Map<string, string>();
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, username: true },
  });
  for (const user of allUsers) {
    userCache.set(user.username, user.id);
  }
  console.log(`📊 User cache: ${userCache.size} users`);

  // 캐시 맵 (성능 최적화)
  const committeeCache = new Map<string, string>();
  const departmentCache = new Map<string, string>();
  const categoryCache = new Map<string, string>();
  const subcategoryCache = new Map<string, string>();

  let detailCount = 0;
  let departmentDetailCount = 0;
  let budgetDetailYearCount = 0;

  for (const item of validData) {
    try {
      // 1. Committee upsert
      let committeeId = committeeCache.get(item.committee);
      if (!committeeId) {
        const committee = await prisma.committee.upsert({
          where: { name: item.committee },
          update: {},
          create: { name: item.committee, isActive: true },
        });
        committeeId = committee.id;
        committeeCache.set(item.committee, committeeId);
      }

      // 2. Department upsert
      const deptKey = `${item.committee}|${item.department}`;
      let departmentId = departmentCache.get(deptKey);
      if (!departmentId) {
        const department = await prisma.department.upsert({
          where: {
            committeeId_name: {
              committeeId,
              name: item.department,
            },
          },
          update: {},
          create: {
            committeeId,
            name: item.department,
            isActive: true,
          },
        });
        departmentId = department.id;
        departmentCache.set(deptKey, departmentId);
      }

      // 3. BudgetCategory upsert
      let categoryId = categoryCache.get(item.category);
      if (!categoryId) {
        const category = await prisma.budgetCategory.upsert({
          where: { name: item.category },
          update: {},
          create: { name: item.category, isActive: true },
        });
        categoryId = category.id;
        categoryCache.set(item.category, categoryId);
      }

      // 4. BudgetSubcategory upsert
      const subcatKey = `${item.category}|${item.subcategory}`;
      let subcategoryId = subcategoryCache.get(subcatKey);
      if (!subcategoryId) {
        const subcategory = await prisma.budgetSubcategory.upsert({
          where: {
            categoryId_name: {
              categoryId,
              name: item.subcategory,
            },
          },
          update: {},
          create: {
            categoryId,
            name: item.subcategory,
            isActive: true,
          },
        });
        subcategoryId = subcategory.id;
        subcategoryCache.set(subcatKey, subcategoryId);
      }

      // 5. BudgetDetail upsert
      const existingDetail = await prisma.budgetDetail.findFirst({
        where: {
          subcategoryId,
          name: item.detail,
        },
      });

      let budgetDetailId: string;

      if (existingDetail) {
        // 업데이트
        await prisma.budgetDetail.update({
          where: { id: existingDetail.id },
          data: {
            accountCode: item.accountCode,
            description: item.description,
            isActive: item.isActive ?? true,
          },
        });
        budgetDetailId = existingDetail.id;
      } else {
        // 새로 생성
        const newDetail = await prisma.budgetDetail.create({
          data: {
            subcategoryId,
            name: item.detail,
            accountCode: item.accountCode,
            description: item.description,
            isActive: item.isActive ?? true,
          },
        });
        budgetDetailId = newDetail.id;
        detailCount++;
      }

      // 6. DepartmentBudgetDetail 연결 (upsert)
      await prisma.departmentBudgetDetail.upsert({
        where: {
          departmentId_budgetDetailId: {
            departmentId,
            budgetDetailId,
          },
        },
        update: { isActive: true },
        create: {
          departmentId,
          budgetDetailId,
          isActive: true,
        },
      });
      departmentDetailCount++;

      // 7. BudgetDetailYear 생성 (연도별 담당자 설정)
      // manager 이름으로 User ID 조회
      const managerId = item.manager ? userCache.get(item.manager) : null;
      if (item.manager && !managerId) {
        console.log(`  ⚠️ Manager not found: ${item.manager} for ${item.detail}`);
      }

      for (const year of YEARS_TO_SEED) {
        await prisma.budgetDetailYear.upsert({
          where: {
            budgetDetailId_year: { budgetDetailId, year },
          },
          update: {
            managerId: managerId || null,
          },
          create: {
            budgetDetailId,
            year,
            managerId: managerId || null,
            budgetAmount: 0,
            usedAmount: 0,
          },
        });
        budgetDetailYearCount++;
      }

    } catch (error) {
      console.error('Error inserting budget item:', item, error);
    }
  }

  console.log(`✅ Created ${detailCount} new budget details`);
  console.log(`✅ Created/Updated ${departmentDetailCount} department-detail links`);
  console.log(`✅ Created/Updated ${budgetDetailYearCount} budget detail years`);

  // 통계 출력
  const committeeStats = await prisma.committee.count();
  const departmentStats = await prisma.department.count();
  const categoryStats = await prisma.budgetCategory.count();
  const subcategoryStats = await prisma.budgetSubcategory.count();
  const detailStats = await prisma.budgetDetail.count();
  const detailYearStats = await prisma.budgetDetailYear.count();

  // 담당자가 설정된 세목 수
  const detailWithManager = await prisma.budgetDetailYear.count({
    where: { managerId: { not: null } },
  });

  console.log('\n📊 Normalized Budget Statistics:');
  console.log(`  - Committees: ${committeeStats}`);
  console.log(`  - Departments: ${departmentStats}`);
  console.log(`  - Categories: ${categoryStats}`);
  console.log(`  - Subcategories: ${subcategoryStats}`);
  console.log(`  - Details: ${detailStats}`);
  console.log(`  - Detail Years: ${detailYearStats} (with manager: ${detailWithManager})`);
}

/**
 * BudgetMaster 레거시 테이블에도 시드 (호환성 유지)
 */
async function seedBudgetMasterLegacy() {
  console.log('\n📦 Seeding BudgetMaster (legacy)...');

  // 기존 데이터 삭제
  await prisma.budgetMaster.deleteMany();
  console.log('  Cleared existing budget master data');

  let successCount = 0;
  for (const item of budgetMasterData) {
    try {
      await prisma.budgetMaster.create({
        data: {
          committee: item.committee,
          department: item.department,
          category: item.category,
          subcategory: item.subcategory,
          detail: item.detail,
          manager: item.manager,
          accountCode: item.accountCode,
          description: item.description,
          isActive: item.isActive ?? true,
        },
      });
      successCount++;
    } catch (error: unknown) {
      // 중복 키 에러는 무시 (unique constraint)
      if ((error as { code?: string }).code !== 'P2002') {
        console.error('Error inserting item:', item, error);
      }
    }
  }

  console.log(`✅ Inserted ${successCount}/${budgetMasterData.length} budget master items`);
}

/**
 * UserYearRole 기반으로 Department.leaderId 업데이트
 */
async function updateDepartmentLeaders() {
  console.log('\n👔 Updating department leaders...');

  // team_leader 역할을 가진 사용자들 조회
  const teamLeaders = await prisma.userYearRole.findMany({
    where: {
      role: 'team_leader',
      year: CURRENT_YEAR,
      department: { not: null },
    },
    include: {
      user: true,
    },
  });

  let updatedCount = 0;

  for (const yearRole of teamLeaders) {
    if (!yearRole.department) continue;

    // department 형식: '기획위원회/홍보팀' 또는 '교육훈련위원회'
    const parts = yearRole.department.split('/');

    if (parts.length !== 2) {
      // 위원회만 있는 경우 (위원장) - Committee.leaderId 업데이트
      const committeeName = parts[0];
      await prisma.committee.updateMany({
        where: { name: committeeName },
        data: { leaderId: yearRole.userId },
      });
      continue;
    }

    const [committeeName, departmentName] = parts;

    // 해당 위원회 찾기
    const committee = await prisma.committee.findUnique({
      where: { name: committeeName },
    });

    if (!committee) {
      console.log(`  ⚠️ Committee not found: ${committeeName}`);
      continue;
    }

    // Department 업데이트
    const result = await prisma.department.updateMany({
      where: {
        committeeId: committee.id,
        name: departmentName,
      },
      data: {
        leaderId: yearRole.userId,
      },
    });

    if (result.count > 0) {
      updatedCount++;
      console.log(`  ✓ ${committeeName}/${departmentName} → ${yearRole.user.username}`);
    }
  }

  console.log(`✅ Updated ${updatedCount} department leaders`);
}

async function main() {
  console.log('🌱 Starting seed...');

  // 역할 마스터 데이터 시드 (먼저 실행)
  await seedRoles();

  // 사용자 시드
  await seedUsers();

  // 정규화된 예산 테이블 시드
  await seedNormalizedBudget();

  // Department 팀장 연결
  await updateDepartmentLeaders();

  // BudgetMaster 레거시 테이블 시드 (호환성)
  await seedBudgetMasterLegacy();

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
