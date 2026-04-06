/**
 * DB에서 사용자 데이터를 조회하여 seed.ts 형식으로 출력하는 스크립트
 * 실행: npx tsx scripts/export-users-to-seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 현재 연도
const CURRENT_YEAR = new Date().getFullYear();
const YEARS_TO_EXPORT = [CURRENT_YEAR - 1, CURRENT_YEAR];

type UserRole = 'admin' | 'finance_head' | 'accountant' | 'team_leader' | 'admin_assistant' | 'user';

interface ProcessedUser {
  userid: string;
  username: string;
  baseRole: 'admin' | 'user';
  yearRole?: UserRole;
  departments?: string[];
  password?: string;
}

interface YearSpecificRole {
  userid: string;
  year: number;
  role: UserRole;
  department?: string;
}

async function main() {
  console.log('='.repeat(60));
  console.log('DB 사용자 데이터 Export');
  console.log(`대상 연도: ${YEARS_TO_EXPORT.join(', ')}`);
  console.log('='.repeat(60));

  // 1. Role 데이터 조회
  const roles = await prisma.role.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`\n[1] Role 조회: ${roles.length}개`);

  // 2. User + UserYearRole 데이터 조회
  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: {
      yearRoles: {
        where: { year: { in: YEARS_TO_EXPORT } },
        orderBy: [{ year: 'asc' }, { departmentId: 'asc' }],
        include: {
          department: {
            include: {
              committee: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { username: 'asc' },
  });
  console.log(`[2] User 조회: ${users.length}명`);

  // Helper function to get department path string
  const getDepartmentPath = (yr: (typeof users)[0]['yearRoles'][0]) => {
    if (yr.department) {
      return `${yr.department.committee.name}/${yr.department.name}`;
    }
    return null;
  };

  // 3. 데이터 변환
  const processedUsers: ProcessedUser[] = [];
  const yearSpecificRoles: YearSpecificRole[] = [];

  for (const user of users) {
    // baseRole 결정 (admin 또는 user)
    const baseRole: 'admin' | 'user' = user.role === 'admin' ? 'admin' : 'user';

    // UserYearRole 분석
    const yearRolesByYear = new Map<number, { role: string; departments: string[] }>();

    for (const yr of user.yearRoles) {
      const deptPath = getDepartmentPath(yr);
      const existing = yearRolesByYear.get(yr.year);
      if (existing) {
        // 같은 연도에 같은 역할로 다른 부서 (겸직)
        if (deptPath && !existing.departments.includes(deptPath)) {
          existing.departments.push(deptPath);
        }
      } else {
        yearRolesByYear.set(yr.year, {
          role: yr.role,
          departments: deptPath ? [deptPath] : [],
        });
      }
    }

    // 연도별 역할이 같은지 확인
    const rolesArray = Array.from(yearRolesByYear.values());
    const allSameRole = rolesArray.length > 0 && rolesArray.every((r) => r.role === rolesArray[0].role);
    const uniqueRole = rolesArray[0]?.role as UserRole | undefined;

    // finance_head, accountant는 연도별로 다를 수 있으므로 yearSpecificRoles로 분리
    const isYearSpecificRole = uniqueRole === 'finance_head' || uniqueRole === 'accountant';

    if (isYearSpecificRole || !allSameRole) {
      // 연도별 역할이 다르거나, 재정팀장/회계인 경우 → yearSpecificRoles에 추가
      for (const [year, data] of yearRolesByYear) {
        if (data.role === 'finance_head' || data.role === 'accountant') {
          yearSpecificRoles.push({
            userid: user.userid,
            year,
            role: data.role as UserRole,
            department: data.departments[0], // 재정팀장/회계는 보통 단일 부서
          });
        }
      }

      // usersData에는 yearRole 없이 추가
      processedUsers.push({
        userid: user.userid,
        username: user.username,
        baseRole,
        // 재정팀/회계는 부서도 제외 (yearSpecificRoles에서 관리)
        departments: undefined,
      });
    } else if (uniqueRole && uniqueRole !== 'user') {
      // 모든 연도에서 같은 역할 (team_leader, admin_assistant 등)
      const allDepartments = new Set<string>();
      for (const data of rolesArray) {
        data.departments.forEach((d) => allDepartments.add(d));
      }

      processedUsers.push({
        userid: user.userid,
        username: user.username,
        baseRole,
        yearRole: uniqueRole,
        departments: allDepartments.size > 0 ? Array.from(allDepartments).sort() : undefined,
      });
    } else {
      // 일반 사용자 (역할 없음)
      processedUsers.push({
        userid: user.userid,
        username: user.username,
        baseRole,
      });
    }
  }

  // 4. TypeScript 코드 생성
  console.log('\n' + '='.repeat(60));
  console.log('GENERATED CODE - prisma/seed.ts에 복사하세요');
  console.log('='.repeat(60));

  // rolesData 생성
  console.log('\n// ========== rolesData ==========');
  console.log('const rolesData = [');
  for (const role of roles) {
    console.log('  {');
    console.log(`    code: '${role.code}',`);
    console.log(`    name: '${role.name}',`);
    console.log(`    description: ${role.description ? `'${escapeString(role.description)}'` : 'null'},`);
    console.log(`    stepNumber: ${role.stepNumber ?? 'null'},`);
    console.log(`    sortOrder: ${role.sortOrder},`);
    console.log(`    canApprove: ${role.canApprove},`);
    console.log(`    canManageExpense: ${role.canManageExpense},`);
    console.log(`    canAccessAdmin: ${role.canAccessAdmin},`);
    console.log(`    canExportData: ${role.canExportData},`);
    console.log(`    canRegisterUsers: ${role.canRegisterUsers},`);
    console.log('  },');
  }
  console.log('];');

  // usersData 생성
  console.log('\n// ========== usersData ==========');
  console.log(`const usersData: Array<{
  userid: string;
  username: string;
  baseRole: 'admin' | 'user';
  yearRole?: UserRole;
  departments?: string[];
  password?: string;
}> = [`);

  // 테스트 사용자를 먼저 (비밀번호 포함)
  const testUser = processedUsers.find((u) => u.userid === '청연테스트');
  if (testUser) {
    console.log(`  // E2E 테스트 사용자`);
    console.log(`  { userid: '${testUser.userid}', username: '${testUser.username}', baseRole: '${testUser.baseRole}', password: 'chc2026' },`);
    console.log('');
  }

  // 나머지 사용자 (그룹별로 정리)
  const adminAssistants = processedUsers.filter((u) => u.yearRole === 'admin_assistant');
  const financeUsers = processedUsers.filter(
    (u) => !u.yearRole && (u.userid.includes('윤운문') || u.userid.includes('정혜종') || u.userid.includes('신창국'))
  );
  const teamLeaders = processedUsers.filter((u) => u.yearRole === 'team_leader');
  const others = processedUsers.filter(
    (u) =>
      u.userid !== '청연테스트' &&
      !adminAssistants.includes(u) &&
      !financeUsers.includes(u) &&
      !teamLeaders.includes(u)
  );

  if (adminAssistants.length > 0) {
    console.log('  // 행정간사');
    for (const user of adminAssistants) {
      console.log(`  ${formatUserEntry(user)},`);
    }
    console.log('');
  }

  if (financeUsers.length > 0) {
    console.log('  // 재정팀장/회계 - 연도별 역할은 yearSpecificRoles에서 관리');
    for (const user of financeUsers) {
      console.log(`  ${formatUserEntry(user)},`);
    }
    console.log('');
  }

  if (teamLeaders.length > 0) {
    console.log('  // 팀장');
    for (const user of teamLeaders) {
      console.log(`  ${formatUserEntry(user)},`);
    }
    console.log('');
  }

  if (others.length > 0) {
    console.log('  // 기타 사용자');
    for (const user of others) {
      if (user.userid !== '청연테스트') {
        console.log(`  ${formatUserEntry(user)},`);
      }
    }
  }

  console.log('];');

  // yearSpecificRoles 생성
  console.log('\n// ========== yearSpecificRoles ==========');
  console.log(`const yearSpecificRoles: Array<{
  userid: string;
  year: number;
  role: UserRole;
  department?: string;
}> = [`);

  // 연도별로 그룹화
  for (const year of YEARS_TO_EXPORT) {
    const rolesForYear = yearSpecificRoles.filter((r) => r.year === year);
    if (rolesForYear.length > 0) {
      console.log(`  // ${year}년 역할`);
      for (const yr of rolesForYear) {
        let entry = `  { userid: '${yr.userid}', year: ${yr.year}, role: '${yr.role}'`;
        if (yr.department) {
          entry += `, department: '${yr.department}'`;
        }
        entry += ' },';
        console.log(entry);
      }
    }
  }
  console.log('];');

  // 통계 출력
  console.log('\n' + '='.repeat(60));
  console.log('통계');
  console.log('='.repeat(60));
  console.log(`- Role: ${roles.length}개`);
  console.log(`- User: ${processedUsers.length}명`);
  console.log(`  - 행정간사: ${adminAssistants.length}명`);
  console.log(`  - 팀장: ${teamLeaders.length}명`);
  console.log(`  - 재정팀장/회계 대상: ${financeUsers.length}명`);
  console.log(`- YearSpecificRoles: ${yearSpecificRoles.length}개`);

  await prisma.$disconnect();
  await pool.end();
}

function escapeString(str: string): string {
  return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function formatUserEntry(user: ProcessedUser): string {
  let entry = `{ userid: '${user.userid}', username: '${user.username}', baseRole: '${user.baseRole}'`;

  if (user.yearRole) {
    entry += `, yearRole: '${user.yearRole}'`;
  }
  if (user.departments && user.departments.length > 0) {
    entry += `, departments: [${user.departments.map((d) => `'${d}'`).join(', ')}]`;
  }
  if (user.password) {
    entry += `, password: '${user.password}'`;
  }
  entry += ' }';
  return entry;
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
