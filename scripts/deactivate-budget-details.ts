/**
 * 특정 예산 세목들을 비활성화하는 스크립트
 * 실행: npx tsx scripts/deactivate-budget-details.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 비활성화할 세목 패턴 (이 이름을 포함하는 세목들을 비활성화)
const PATTERNS_TO_DEACTIVATE = [
  '(예산외세목)',
];

// 비활성화할 특정 세목 목록 (예산항, 예산목, 예산세목 조합으로 정확히 일치하는 경우)
// 형식: [categoryName, subcategoryName, detailName]
const SPECIFIC_ITEMS_TO_DEACTIVATE: [string, string, string][] = [
  // 예시: ['교육사역비', '영유아사역비', '(예산외세목)'],
];

async function main() {
  console.log('='.repeat(60));
  console.log('예산 세목 비활성화 스크립트');
  console.log('='.repeat(60));

  let totalDeactivated = 0;
  let totalNotFound = 0;
  let totalAlreadyInactive = 0;

  // 1. 패턴으로 비활성화
  console.log('\n[1] 패턴으로 비활성화 중...');
  for (const pattern of PATTERNS_TO_DEACTIVATE) {
    console.log(`\n패턴: "${pattern}"`);

    const budgetDetails = await prisma.budgetDetail.findMany({
      where: {
        name: {
          contains: pattern
        },
        isActive: true
      },
      include: {
        subcategory: {
          include: {
            category: true
          }
        }
      }
    });

    if (budgetDetails.length === 0) {
      console.log(`   ⚠️  일치하는 활성 세목 없음`);
      continue;
    }

    for (const detail of budgetDetails) {
      await prisma.budgetDetail.update({
        where: { id: detail.id },
        data: { isActive: false }
      });
      console.log(`   ✅ 비활성화: ${detail.subcategory.category.name} > ${detail.subcategory.name} > ${detail.name}`);
      totalDeactivated++;
    }
  }

  // 2. 특정 항목 비활성화
  if (SPECIFIC_ITEMS_TO_DEACTIVATE.length > 0) {
    console.log('\n[2] 특정 항목 비활성화 중...');

    for (const [category, subcategory, detail] of SPECIFIC_ITEMS_TO_DEACTIVATE) {
      const budgetDetail = await prisma.budgetDetail.findFirst({
        where: {
          name: detail,
          subcategory: {
            name: subcategory,
            category: { name: category }
          }
        }
      });

      if (!budgetDetail) {
        console.log(`   ⚠️  찾을 수 없음: ${category} > ${subcategory} > ${detail}`);
        totalNotFound++;
        continue;
      }

      if (!budgetDetail.isActive) {
        console.log(`   ℹ️  이미 비활성: ${category} > ${subcategory} > ${detail}`);
        totalAlreadyInactive++;
        continue;
      }

      await prisma.budgetDetail.update({
        where: { id: budgetDetail.id },
        data: { isActive: false }
      });
      console.log(`   ✅ 비활성화: ${category} > ${subcategory} > ${detail}`);
      totalDeactivated++;
    }
  }

  // 3. BudgetDetailYear 연쇄 비활성화
  console.log('\n[3] BudgetDetailYear 연쇄 비활성화 중...');
  const budgetDetailYearResult = await prisma.budgetDetailYear.updateMany({
    where: {
      budgetDetail: {
        isActive: false
      },
      isActive: true
    },
    data: {
      isActive: false
    }
  });
  console.log(`   ✅ BudgetDetailYear ${budgetDetailYearResult.count}개 비활성화됨`);

  // 4. 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('결과 요약');
  console.log('='.repeat(60));
  console.log(`- BudgetDetail 비활성화됨: ${totalDeactivated}개`);
  console.log(`- BudgetDetailYear 비활성화됨: ${budgetDetailYearResult.count}개`);
  if (totalNotFound > 0) {
    console.log(`- 찾을 수 없음: ${totalNotFound}개`);
  }
  if (totalAlreadyInactive > 0) {
    console.log(`- 이미 비활성: ${totalAlreadyInactive}개`);
  }

  // 5. 현재 비활성화된 전체 세목 수 조회
  const inactiveCount = await prisma.budgetDetail.count({
    where: { isActive: false }
  });
  const activeCount = await prisma.budgetDetail.count({
    where: { isActive: true }
  });
  const inactiveYearCount = await prisma.budgetDetailYear.count({
    where: { isActive: false }
  });
  const activeYearCount = await prisma.budgetDetailYear.count({
    where: { isActive: true }
  });
  console.log(`\n현재 상태:`);
  console.log(`- 활성 BudgetDetail: ${activeCount}개`);
  console.log(`- 비활성 BudgetDetail: ${inactiveCount}개`);
  console.log(`- 활성 BudgetDetailYear: ${activeYearCount}개`);
  console.log(`- 비활성 BudgetDetailYear: ${inactiveYearCount}개`);

  await prisma.$disconnect();
  await pool.end();
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
