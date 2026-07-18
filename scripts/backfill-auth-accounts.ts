/**
 * AuthAccount 백필 스크립트 (ARC-003 §3, C1)
 *
 * password가 있는 모든 유저에 대해 provider: "email" AuthAccount를 생성합니다.
 * - providerUserId: User.userid (로그인 아이디 — 기존 이메일 로그인의 식별자)
 * - 이미 존재하는 연결은 건너뜁니다 (추가 전용 — 수동 변경을 덮어쓰지 않음)
 * - (provider, providerUserId)는 전역 유니크인데 userid는 테넌트 내 유니크이므로,
 *   테넌트 간 userid 충돌 시 먼저 연결된 유저를 유지하고 나머지는 경고 후 건너뜁니다.
 *
 * 실행 방법 (M2 게이트 — 루프에서 실행 금지):
 *   # Dry-run (변경 없이 확인만)
 *   npx tsx scripts/backfill-auth-accounts.ts --dry-run
 *
 *   # 실제 백필 실행
 *   npx tsx scripts/backfill-auth-accounts.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== AuthAccount(email) 백필 ${isDryRun ? '(dry-run — 변경 없음)' : ''} ===\n`);

  const users = await prisma.user.findMany({
    where: { password: { not: null } },
    select: { id: true, userid: true, username: true, tenantId: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`대상 유저: ${users.length}명 (password 보유)\n`);

  let created = 0;
  let skipped = 0;
  let conflicted = 0;

  for (const user of users) {
    const providerUserId = user.userid;

    const existing = await prisma.authAccount.findUnique({
      where: { provider_providerUserId: { provider: 'email', providerUserId } },
    });

    if (existing) {
      if (existing.userId === user.id) {
        skipped++;
        console.log(`  [건너뜀] ${user.username}(${user.userid}) — 이미 연결됨`);
      } else {
        conflicted++;
        console.warn(
          `  [충돌] ${user.username}(${user.userid}, tenant ${user.tenantId}) — 같은 userid가 다른 유저(${existing.userId})에 이미 연결됨. 수동 확인 필요`
        );
      }
      continue;
    }

    if (isDryRun) {
      created++;
      console.log(`  [생성 예정] ${user.username}(${user.userid}) → provider: email`);
      continue;
    }

    await prisma.authAccount.create({
      data: { userId: user.id, provider: 'email', providerUserId },
    });
    created++;
    console.log(`  [생성] ${user.username}(${user.userid}) → provider: email`);
  }

  console.log(
    `\n=== 완료 — 생성${isDryRun ? ' 예정' : ''}: ${created}건, 건너뜀: ${skipped}건, 충돌: ${conflicted}건 ===`
  );
  if (conflicted > 0) {
    console.warn('충돌 건은 백필되지 않았습니다. 테넌트 간 userid 중복을 확인하세요.');
  }
}

main()
  .catch((error) => {
    console.error('백필 실패:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
