/**
 * (주)청연컨설팅 초기 사용자(결재선) 시드 스크립트
 *
 * 명단(2026년 기준):
 *   - 신창국: 재정팀장(재무팀) + 팀장(경영지원팀·재무팀·총무팀)
 *   - 정혜종: 회계(재무팀) + 팀장(기술지원팀)
 *   - 김흥래: 팀장(영업1팀·고객지원팀)
 *   - 김석현: 팀장(기술연구팀)  ← 컨설팅본부에 신규 부서로 생성
 *
 * 한 사람의 다부서 겸임은 UserYearRole(연도별 역할, year=2026) 다중 행으로 표현한다.
 * 재정팀장/회계는 결재선 서비스가 (year, role)로 전사 1명을 찾고, 팀장은 부서별로 찾는다.
 *
 * 재실행 안전(upsert 기반).
 *
 * 실행:
 *   TENANT_ADMIN_PASSWORD 불필요. 사용자 비밀번호는 아래 DEFAULT_PASSWORD.
 *   npx ts-node --project tsconfig.scripts.json prisma/seeds/chungyeon-consulting-users-seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TENANT_SUBDOMAIN = 'chungyeon-consulting';
const YEAR = 2026;
const DEFAULT_PASSWORD = 'chc2026'; // 첫 로그인 후 변경 안내

// 신규 생성이 필요한 부서 (컨설팅본부 소속)
const NEW_DEPARTMENT = { committee: '컨설팅본부', name: '기술연구팀' };

// 사용자(대표 역할)
const users = [
  { userid: '신창국', username: '신창국', role: 'finance_head' },
  { userid: '정혜종', username: '정혜종', role: 'accountant' },
  { userid: '김흥래', username: '김흥래', role: 'team_leader' },
  { userid: '김석현', username: '김석현', role: 'team_leader' },
];

// 연도별 역할(부서별 겸임) — (userid, role, department)
const yearRoleRows = [
  { userid: '신창국', role: 'finance_head', department: '재무팀' },
  { userid: '신창국', role: 'team_leader', department: '경영지원팀' },
  { userid: '신창국', role: 'team_leader', department: '재무팀' },
  { userid: '신창국', role: 'team_leader', department: '총무팀' },
  { userid: '정혜종', role: 'accountant', department: '재무팀' },
  { userid: '정혜종', role: 'team_leader', department: '기술지원팀' },
  { userid: '김흥래', role: 'team_leader', department: '영업1팀' },
  { userid: '김흥래', role: 'team_leader', department: '고객지원팀' },
  { userid: '김석현', role: 'team_leader', department: '기술연구팀' },
];

async function main() {
  console.log('(주)청연컨설팅 초기 사용자 시드 시작...\n');

  const tenant = await prisma.tenant.findUnique({
    where: { subdomain: TENANT_SUBDOMAIN },
    select: { id: true, name: true },
  });
  if (!tenant) {
    console.error(`❌ 테넌트를 찾을 수 없습니다: ${TENANT_SUBDOMAIN}. 먼저 chungyeon-consulting-seed.ts 를 실행하세요.`);
    process.exit(1);
  }
  const tenantId = tenant.id;

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await prisma.$transaction(async (tx) => {
    // 0. 역할 코드 -> Role.id
    const roles = await tx.role.findMany({ where: { tenantId }, select: { id: true, code: true } });
    const roleIdByCode = new Map(roles.map((r) => [r.code, r.id]));
    for (const code of new Set([...users.map((u) => u.role), ...yearRoleRows.map((y) => y.role)])) {
      if (!roleIdByCode.has(code)) throw new Error(`역할 코드 없음: ${code}`);
    }

    // 1. 신규 부서(기술연구팀) 보장
    const committee = await tx.committee.findFirst({
      where: { tenantId, name: NEW_DEPARTMENT.committee },
      select: { id: true, departments: { orderBy: { sortOrder: 'desc' }, take: 1, select: { sortOrder: true } } },
    });
    if (!committee) throw new Error(`위원회 없음: ${NEW_DEPARTMENT.committee}`);

    let newDept = await tx.department.findFirst({
      where: { tenantId, committeeId: committee.id, name: NEW_DEPARTMENT.name },
      select: { id: true },
    });
    if (!newDept) {
      const nextSort = (committee.departments[0]?.sortOrder ?? 0) + 1;
      newDept = await tx.department.create({
        data: { tenantId, committeeId: committee.id, name: NEW_DEPARTMENT.name, sortOrder: nextSort, isActive: true },
        select: { id: true },
      });
      console.log(`[CREATE] 부서 '${NEW_DEPARTMENT.committee} > ${NEW_DEPARTMENT.name}' 생성`);
    } else {
      console.log(`[SKIP] 부서 '${NEW_DEPARTMENT.name}' 이미 존재`);
    }

    // 2. 부서명 -> id 매핑 (전체)
    const departments = await tx.department.findMany({ where: { tenantId }, select: { id: true, name: true } });
    const deptIdByName = new Map(departments.map((d) => [d.name, d.id]));
    for (const y of yearRoleRows) {
      if (!deptIdByName.has(y.department)) throw new Error(`부서 없음: ${y.department}`);
    }

    // 3. 사용자 upsert
    const userIdByUserid = new Map<string, string>();
    for (const u of users) {
      const user = await tx.user.upsert({
        where: { tenantId_userid: { tenantId, userid: u.userid } },
        update: { username: u.username, role: u.role, roleId: roleIdByCode.get(u.role)!, isActive: true },
        create: {
          tenantId,
          userid: u.userid,
          username: u.username,
          password: hashedPassword,
          role: u.role,
          roleId: roleIdByCode.get(u.role)!,
          isActive: true,
        },
        select: { id: true },
      });
      userIdByUserid.set(u.userid, user.id);
      console.log(`[USER] ${u.userid} (${u.role})`);
    }

    // 4. 연도별 역할 upsert
    let yrCount = 0;
    for (const y of yearRoleRows) {
      const userId = userIdByUserid.get(y.userid)!;
      const departmentId = deptIdByName.get(y.department)!;
      const roleId = roleIdByCode.get(y.role)!;
      await tx.userYearRole.upsert({
        where: { userId_year_departmentId_role: { userId, year: YEAR, departmentId, role: y.role } },
        update: { roleId, tenantId },
        create: { tenantId, userId, year: YEAR, role: y.role, roleId, departmentId },
      });
      yrCount++;
      console.log(`  [YEAR-ROLE ${YEAR}] ${y.userid} · ${y.role} · ${y.department}`);
    }

    // 5. 사용자 수 갱신
    const total = await tx.user.count({ where: { tenantId } });
    await tx.tenant.update({ where: { id: tenantId }, data: { currentUsers: total } });

    console.log(`\n사용자 ${users.length}명, 연도별 역할 ${yrCount}건 처리 완료. (테넌트 총 사용자: ${total}명)`);
  }, { maxWait: 20000, timeout: 120000 });

  console.log('\n(주)청연컨설팅 초기 사용자 시드 완료!');
  console.log(`\n기본 비밀번호: ${DEFAULT_PASSWORD} (⚠️ 첫 로그인 후 변경 안내)`);
  console.log(`접속: http://localhost:3002?tenant=${TENANT_SUBDOMAIN}`);
}

main()
  .catch((e) => { console.error('사용자 시드 오류:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
