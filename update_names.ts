import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 찬양팀운영비 목 찾기
  const subcategory = await prisma.budgetSubcategory.findFirst({
    where: { name: '찬양팀운영비' }
  });

  if (!subcategory) {
    console.log('찬양팀운영비 목을 찾을 수 없습니다.');
    return;
  }

  console.log('찬양팀운영비 목 ID:', subcategory.id);

  // 유지관리비 -> 유지관리비_찬양팀
  const result1 = await prisma.budgetDetail.updateMany({
    where: {
      subcategoryId: subcategory.id,
      name: '유지관리비'
    },
    data: {
      name: '유지관리비_찬양팀'
    }
  });
  console.log('유지관리비 -> 유지관리비_찬양팀:', result1.count, '개 변경');

  // 아웃팅비 -> 아웃팅비_찬양팀
  const result2 = await prisma.budgetDetail.updateMany({
    where: {
      subcategoryId: subcategory.id,
      name: '아웃팅비'
    },
    data: {
      name: '아웃팅비_찬양팀'
    }
  });
  console.log('아웃팅비 -> 아웃팅비_찬양팀:', result2.count, '개 변경');

  // 변경 결과 확인
  const details = await prisma.budgetDetail.findMany({
    where: { subcategoryId: subcategory.id }
  });

  console.log('\n변경 후 찬양팀운영비 세목 목록:');
  for (const d of details) {
    console.log(' -', d.name);
  }

  await prisma.$disconnect();
}

main();
