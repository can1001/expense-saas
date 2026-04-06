/**
 * 연도별 팀장 목록 조회
 * 실행: npx tsx scripts/show-team-leaders-by-year.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const yearRoles = await prisma.userYearRole.findMany({
    where: {
      role: 'team_leader',
      year: { in: [2025, 2026] }
    },
    include: {
      user: { select: { userid: true, username: true } },
      department: {
        include: {
          committee: { select: { name: true } }
        }
      }
    },
    orderBy: [{ year: 'asc' }, { departmentId: 'asc' }]
  });

  // Group by year
  const byYear = new Map<number, Array<{username: string, department: string}>>();

  for (const yr of yearRoles) {
    if (!byYear.has(yr.year)) {
      byYear.set(yr.year, []);
    }
    const arr = byYear.get(yr.year);
    if (arr) {
      const deptPath = yr.department
        ? `${yr.department.committee.name}/${yr.department.name}`
        : '(부서없음)';
      arr.push({
        username: yr.user.username,
        department: deptPath
      });
    }
  }

  for (const [year, leaders] of byYear) {
    console.log(`\n===== ${year}년 팀장 (${leaders.length}명) =====`);
    for (const l of leaders) {
      console.log(`  - ${l.username} (${l.department})`);
    }
  }

  // 연도별 차이 확인
  const leaders2025 = new Set(yearRoles.filter(y => y.year === 2025).map(y => y.user.username));
  const leaders2026 = new Set(yearRoles.filter(y => y.year === 2026).map(y => y.user.username));

  const only2025 = [...leaders2025].filter(n => !leaders2026.has(n));
  const only2026 = [...leaders2026].filter(n => !leaders2025.has(n));

  console.log(`\n===== 연도별 차이 =====`);
  console.log(`2025년에만 팀장: ${only2025.length > 0 ? only2025.join(', ') : '없음'}`);
  console.log(`2026년에만 팀장: ${only2026.length > 0 ? only2026.join(', ') : '없음'}`);

  await prisma.$disconnect();
  await pool.end();
}

main();
