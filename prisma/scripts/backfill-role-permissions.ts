/**
 * Role.permissions 백필 스크립트 (Phase 5 컬럼 제거 전 실행)
 *
 * 기존 역할의 permissions[] 가 비어 있으면 역할 코드 프리셋(ROLE_PERMISSION_PRESETS)으로 채운다.
 * → 불리언 플래그 컬럼을 DROP 하기 전에 실행해 어떤 역할도 권한을 잃지 않도록 한다.
 * (permissions[] 가 비어 있어도 런타임 resolver 는 프리셋으로 폴백하지만,
 *  DB를 명시적으로 채워 두면 커스터마이즈/조회가 명확해진다.)
 *
 * 실행: npx ts-node --project tsconfig.scripts.json prisma/scripts/backfill-role-permissions.ts
 */

import { prismaBase } from '../../lib/prisma';
import { ROLE_PERMISSION_PRESETS, RoleCode, isRoleCode } from '../../lib/auth/permissions';

async function main() {
  const roles = await prismaBase.role.findMany({
    select: { id: true, code: true, name: true, tenantId: true, permissions: true },
  });

  let updated = 0;
  let skipped = 0;
  const unknown: string[] = [];

  for (const role of roles) {
    if (role.permissions && role.permissions.length > 0) {
      skipped++;
      continue;
    }
    if (!isRoleCode(role.code)) {
      unknown.push(`${role.code} (${role.name})`);
      continue;
    }
    const preset = ROLE_PERMISSION_PRESETS[role.code as RoleCode];
    await prismaBase.role.update({
      where: { id: role.id },
      data: { permissions: [...preset] },
    });
    updated++;
    console.log(`  ✔ ${role.code} (tenant=${role.tenantId ?? 'global'}) ← ${preset.length}개 권한`);
  }

  console.log('\n=== 백필 완료 ===');
  console.log(`업데이트: ${updated}, 건너뜀(이미 설정): ${skipped}`);
  if (unknown.length) {
    console.log(`⚠️ 프리셋 없는 커스텀 코드(수동 확인 필요): ${unknown.join(', ')}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
