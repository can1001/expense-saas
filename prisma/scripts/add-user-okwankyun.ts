/**
 * (주)청연컨설팅 일반 사용자 추가 스크립트 (1명)
 *
 * 추가 대상 (엑셀 일괄등록 템플릿 형식):
 *   userid=오관균, username=오관균, role=사용자(user), department=기술연구팀, isActive=Y
 *
 * 결재선(재정팀장/회계/팀장) 인원이 아니므로 UserYearRole 은 생성하지 않는다.
 * 재실행 안전(upsert 기반). 기본 비밀번호는 chc2026 (첫 로그인 후 변경 안내).
 *
 * 실행:
 *   npx ts-node --project tsconfig.scripts.json prisma/scripts/add-user-okwankyun.ts
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
const DEFAULT_PASSWORD = 'chc2026';

const NEW_USER = {
  userid: '오관균',
  username: '오관균',
  role: 'user',
  department: '기술연구팀',
  isActive: true,
};

async function main() {
  console.log('(주)청연컨설팅 사용자 추가 시작...\n');

  const tenant = await prisma.tenant.findUnique({
    where: { subdomain: TENANT_SUBDOMAIN },
    select: { id: true, name: true },
  });
  if (!tenant) {
    console.error(`❌ 테넌트를 찾을 수 없습니다: ${TENANT_SUBDOMAIN}`);
    process.exit(1);
  }
  const tenantId = tenant.id;

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await prisma.$transaction(async (tx) => {
    // 역할 코드 -> Role.id
    const role = await tx.role.findFirst({
      where: { tenantId, code: NEW_USER.role },
      select: { id: true },
    });
    if (!role) throw new Error(`역할 코드 없음: ${NEW_USER.role}`);

    // 부서 존재 확인 (참고용 저장이지만 오타 방지 위해 실제 부서와 대조)
    const dept = await tx.department.findFirst({
      where: { tenantId, name: NEW_USER.department },
      select: { id: true },
    });
    if (!dept) throw new Error(`부서 없음: ${NEW_USER.department}`);

    const user = await tx.user.upsert({
      where: { tenantId_userid: { tenantId, userid: NEW_USER.userid } },
      update: {
        username: NEW_USER.username,
        role: NEW_USER.role,
        roleId: role.id,
        department: NEW_USER.department,
        isActive: NEW_USER.isActive,
      },
      create: {
        tenantId,
        userid: NEW_USER.userid,
        username: NEW_USER.username,
        password: hashedPassword,
        role: NEW_USER.role,
        roleId: role.id,
        department: NEW_USER.department,
        isActive: NEW_USER.isActive,
      },
      select: { id: true, createdAt: true, updatedAt: true },
    });
    const isNew = user.createdAt.getTime() === user.updatedAt.getTime();
    console.log(`[${isNew ? 'CREATE' : 'UPDATE'}] ${NEW_USER.userid} (${NEW_USER.role}) · ${NEW_USER.department}`);

    // 테넌트 사용자 수 갱신
    const total = await tx.user.count({ where: { tenantId } });
    await tx.tenant.update({ where: { id: tenantId }, data: { currentUsers: total } });
    console.log(`\n처리 완료. (테넌트 총 사용자: ${total}명)`);
  }, { maxWait: 20000, timeout: 120000 });

  console.log('\n사용자 추가 완료!');
  console.log(`기본 비밀번호: ${DEFAULT_PASSWORD} (⚠️ 첫 로그인 후 변경 안내)`);
  console.log(`접속: http://localhost:3000?tenant=${TENANT_SUBDOMAIN}`);
}

main()
  .catch((e) => { console.error('사용자 추가 오류:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
