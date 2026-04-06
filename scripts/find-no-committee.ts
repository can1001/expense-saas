/**
 * 부서 정보 없는 팀장 조회 (departmentId가 null인 경우)
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
      user: { select: { username: true } },
      department: {
        include: {
          committee: { select: { name: true } }
        }
      }
    },
    orderBy: [{ year: 'asc' }, { departmentId: 'asc' }]
  });

  // Find entries without department (departmentId is null)
  const noDepartment = yearRoles.filter(yr => !yr.departmentId);

  console.log('=== 부서 정보 없는 팀장 ===\n');

  // Group by year
  for (const year of [2025, 2026]) {
    const forYear = noDepartment.filter(yr => yr.year === year);
    console.log(`--- ${year}년 (${forYear.length}건) ---`);
    for (const yr of forYear) {
      console.log(`  ${yr.user.username} (departmentId: null)`);
    }
    console.log('');
  }

  // Show all valid entries with department info
  console.log('=== 부서 정보 있는 팀장 ===\n');
  const withDepartment = yearRoles.filter(yr => yr.departmentId && yr.department);
  for (const year of [2025, 2026]) {
    const forYear = withDepartment.filter(yr => yr.year === year);
    console.log(`--- ${year}년 (${forYear.length}건) ---`);
    for (const yr of forYear) {
      const deptPath = yr.department
        ? `${yr.department.committee.name}/${yr.department.name}`
        : '(unknown)';
      console.log(`  ${yr.user.username} (${deptPath})`);
    }
    console.log('');
  }

  await prisma.$disconnect();
  await pool.end();
}

main();
