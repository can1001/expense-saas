/**
 * 연도별 팀장 목록 MD 파일 생성
 * 실행: npx tsx scripts/generate-team-leaders-report.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface TeamLeaderEntry {
  committee: string;
  team: string;
  y2025: string;
  y2026: string;
}

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
    orderBy: [{ departmentId: 'asc' }, { year: 'asc' }]
  });

  // Parse department to get committee and team
  const data = yearRoles.map(yr => {
    const committee = yr.department?.committee.name || '';
    const team = yr.department?.name || '(부서없음)';

    return {
      committee,
      team,
      year: yr.year,
      username: yr.user.username
    };
  });

  // Group by committee/team
  const grouped = new Map<string, TeamLeaderEntry>();
  for (const d of data) {
    const key = d.committee + '|' + d.team;
    if (!grouped.has(key)) {
      grouped.set(key, { committee: d.committee, team: d.team, y2025: '', y2026: '' });
    }
    const entry = grouped.get(key)!;
    if (d.year === 2025) {
      entry.y2025 = d.username;
    } else if (d.year === 2026) {
      entry.y2026 = d.username;
    }
  }

  // Sort
  const sorted = [...grouped.values()].sort((a, b) => {
    if (a.committee !== b.committee) return a.committee.localeCompare(b.committee);
    return a.team.localeCompare(b.team);
  });

  // Generate MD content
  let md = `# 연도별 팀장 목록

생성일: ${new Date().toISOString().split('T')[0]}

## 위원회별 팀장

| 위원회 | 팀 | 2025년 | 2026년 |
|--------|-----|--------|--------|
`;

  for (const row of sorted) {
    md += `| ${row.committee || '-'} | ${row.team} | ${row.y2025 || '-'} | ${row.y2026 || '-'} |\n`;
  }

  // 연도별 차이 섹션
  const leaders2025 = new Set(yearRoles.filter(y => y.year === 2025).map(y => y.user.username));
  const leaders2026 = new Set(yearRoles.filter(y => y.year === 2026).map(y => y.user.username));

  const only2025 = [...leaders2025].filter(n => !leaders2026.has(n));
  const only2026 = [...leaders2026].filter(n => !leaders2025.has(n));

  md += `
## 연도별 변동 사항

### 2025년에만 팀장 (${only2025.length}명)
${only2025.length > 0 ? only2025.map(n => `- ${n}`).join('\n') : '없음'}

### 2026년에만 팀장 (${only2026.length}명)
${only2026.length > 0 ? only2026.map(n => `- ${n}`).join('\n') : '없음'}

## 통계

- 2025년 팀장: ${leaders2025.size}명
- 2026년 팀장: ${leaders2026.size}명
`;

  // Write to file
  const filePath = 'docs/team-leaders-by-year.md';
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync(filePath, md);
  console.log(`파일 생성 완료: ${filePath}`);
  console.log('\n--- 파일 내용 ---\n');
  console.log(md);

  await prisma.$disconnect();
  await pool.end();
}

main();
