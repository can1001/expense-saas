/**
 * Membership 백필 스크립트 (ARC-002 §2.2, B1)
 *
 * User.tenantId가 있는 모든 유저에 대해 Membership을 생성합니다.
 * - role: User.role이 'admin'이면 TENANT_ADMIN, 아니면 MEMBER
 * - isDefault: true (기존 단일 소속이 기본 진입 조직)
 * - 이미 존재하는 Membership은 건너뜁니다 (추가 전용 — 수동 변경을 덮어쓰지 않음)
 *
 * 실행 방법:
 *   # Dry-run (변경 없이 확인만)
 *   npx tsx scripts/backfill-memberships.ts --dry-run
 *
 *   # 실제 백필 실행
 *   npx tsx scripts/backfill-memberships.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

// .env 파일 로드 (Prisma 7: 어댑터에 연결 문자열 직접 전달)
config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const isDryRun = process.argv.includes('--dry-run');

// User.role → Membership.role 매핑 (lib/auth/permissions.ts의 ROLE_CODES 중 admin만 관리자성 역할)
function toMembershipRole(userRole: string): 'TENANT_ADMIN' | 'MEMBER' {
  return userRole === 'admin' ? 'TENANT_ADMIN' : 'MEMBER';
}

async function main() {
  console.log(`=== Membership 백필 ${isDryRun ? '(dry-run — 변경 없음)' : ''} ===\n`);

  const users = await prisma.user.findMany({
    where: { tenantId: { not: null } },
    select: { id: true, userid: true, username: true, role: true, tenantId: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`대상 유저: ${users.length}명 (User.tenantId 보유)\n`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const tenantId = user.tenantId!;
    const role = toMembershipRole(user.role);

    const existing = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });

    if (existing) {
      skipped++;
      console.log(`  [건너뜀] ${user.username}(${user.userid}) — 이미 소속됨 (role: ${existing.role})`);
      continue;
    }

    if (isDryRun) {
      created++;
      console.log(`  [생성 예정] ${user.username}(${user.userid}) → tenant ${tenantId} (role: ${role}, isDefault: true)`);
      continue;
    }

    await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId,
        role,
        isDefault: true,
      },
    });
    created++;
    console.log(`  [생성] ${user.username}(${user.userid}) → tenant ${tenantId} (role: ${role}, isDefault: true)`);
  }

  console.log(`\n=== 완료 — 생성${isDryRun ? ' 예정' : ''}: ${created}건, 건너뜀: ${skipped}건 ===`);
}

main()
  .catch((error) => {
    console.error('백필 실패:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
