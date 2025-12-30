import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = 'chc2026';

async function main() {
  console.log('모든 사용자의 비밀번호를 기본값으로 설정합니다...');
  console.log(`기본 비밀번호: ${DEFAULT_PASSWORD}`);

  // 비밀번호 해시 생성
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  console.log('해시된 비밀번호 생성 완료');

  // 모든 사용자의 비밀번호 업데이트
  const result = await prisma.user.updateMany({
    data: {
      password: hashedPassword,
    },
  });

  console.log(`${result.count}명의 사용자 비밀번호가 업데이트되었습니다.`);
}

main()
  .catch((e) => {
    console.error('오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
