/**
 * SuperAdmin 시드 스크립트
 *
 * 실행:
 * npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/super-admin-seed.ts
 *
 * 또는 환경변수로 비밀번호 지정:
 * SUPER_ADMIN_PASSWORD=mypassword npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seeds/super-admin-seed.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@expense-saas.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';
  const name = process.env.SUPER_ADMIN_NAME || 'Platform Admin';

  // 이미 존재하는지 확인
  const existing = await prisma.superAdmin.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`SuperAdmin already exists: ${email}`);
    console.log('To reset password, delete the existing record first.');
    return;
  }

  // 비밀번호 해싱
  const hashedPassword = await bcrypt.hash(password, 10);

  // SuperAdmin 생성
  const admin = await prisma.superAdmin.create({
    data: {
      email,
      password: hashedPassword,
      name,
      isActive: true,
    },
  });

  console.log('SuperAdmin created successfully!');
  console.log(`  ID: ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Name: ${admin.name}`);
  console.log('');
  console.log('⚠️  IMPORTANT: Change the default password immediately!');
  console.log(`  Default password: ${password}`);
}

main()
  .catch((e) => {
    console.error('Error creating SuperAdmin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
