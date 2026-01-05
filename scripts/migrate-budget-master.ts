/**
 * 예산 마스터 데이터 마이그레이션 스크립트
 *
 * 기존 BudgetMaster 테이블에서 정규화된 테이블로 데이터를 마이그레이션합니다.
 *
 * 실행: npx dotenv -e .env -- npx ts-node scripts/migrate-budget-master.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== 예산 마스터 데이터 마이그레이션 시작 ===\n');

  // 1. 기존 BudgetMaster 데이터 조회
  const budgetMasters = await prisma.budgetMaster.findMany({
    where: { isActive: true },
    orderBy: [
      { committee: 'asc' },
      { department: 'asc' },
      { category: 'asc' },
      { subcategory: 'asc' },
      { detail: 'asc' },
    ],
  });

  console.log(`기존 BudgetMaster 데이터: ${budgetMasters.length}건\n`);

  // 2. Committee 추출 및 생성
  const uniqueCommittees = [...new Set(budgetMasters.map((bm) => bm.committee))];
  console.log(`위원회 추출: ${uniqueCommittees.length}개`);

  const committeeMap = new Map<string, string>(); // name -> id
  for (let i = 0; i < uniqueCommittees.length; i++) {
    const name = uniqueCommittees[i];
    const existing = await prisma.committee.findUnique({ where: { name } });
    if (existing) {
      committeeMap.set(name, existing.id);
      console.log(`  - [기존] ${name}`);
    } else {
      const created = await prisma.committee.create({
        data: {
          name,
          sortOrder: i + 1,
          isActive: true,
        },
      });
      committeeMap.set(name, created.id);
      console.log(`  - [생성] ${name}`);
    }
  }

  // 3. Department 추출 및 생성
  const uniqueDepartments = [
    ...new Map(
      budgetMasters.map((bm) => [`${bm.committee}|${bm.department}`, { committee: bm.committee, department: bm.department }])
    ).values(),
  ];
  console.log(`\n사역팀(부) 추출: ${uniqueDepartments.length}개`);

  const departmentMap = new Map<string, string>(); // "committee|department" -> id
  for (let i = 0; i < uniqueDepartments.length; i++) {
    const { committee, department } = uniqueDepartments[i];
    const committeeId = committeeMap.get(committee)!;
    const key = `${committee}|${department}`;

    const existing = await prisma.department.findUnique({
      where: { committeeId_name: { committeeId, name: department } },
    });

    if (existing) {
      departmentMap.set(key, existing.id);
    } else {
      const created = await prisma.department.create({
        data: {
          committeeId,
          name: department,
          sortOrder: i + 1,
          isActive: true,
        },
      });
      departmentMap.set(key, created.id);
      console.log(`  - [생성] ${committee} > ${department}`);
    }
  }

  // 4. BudgetCategory 추출 및 생성
  const uniqueCategories = [...new Set(budgetMasters.map((bm) => bm.category))];
  console.log(`\n예산(항) 추출: ${uniqueCategories.length}개`);

  const categoryMap = new Map<string, string>(); // name -> id
  for (let i = 0; i < uniqueCategories.length; i++) {
    const name = uniqueCategories[i];
    const existing = await prisma.budgetCategory.findUnique({ where: { name } });
    if (existing) {
      categoryMap.set(name, existing.id);
    } else {
      const created = await prisma.budgetCategory.create({
        data: {
          name,
          sortOrder: i + 1,
          isActive: true,
        },
      });
      categoryMap.set(name, created.id);
      console.log(`  - [생성] ${name}`);
    }
  }

  // 5. BudgetSubcategory 추출 및 생성
  const uniqueSubcategories = [
    ...new Map(
      budgetMasters.map((bm) => [`${bm.category}|${bm.subcategory}`, { category: bm.category, subcategory: bm.subcategory }])
    ).values(),
  ];
  console.log(`\n예산(목) 추출: ${uniqueSubcategories.length}개`);

  const subcategoryMap = new Map<string, string>(); // "category|subcategory" -> id
  for (let i = 0; i < uniqueSubcategories.length; i++) {
    const { category, subcategory } = uniqueSubcategories[i];
    const categoryId = categoryMap.get(category)!;
    const key = `${category}|${subcategory}`;

    const existing = await prisma.budgetSubcategory.findUnique({
      where: { categoryId_name: { categoryId, name: subcategory } },
    });

    if (existing) {
      subcategoryMap.set(key, existing.id);
    } else {
      const created = await prisma.budgetSubcategory.create({
        data: {
          categoryId,
          name: subcategory,
          sortOrder: i + 1,
          isActive: true,
        },
      });
      subcategoryMap.set(key, created.id);
      console.log(`  - [생성] ${category} > ${subcategory}`);
    }
  }

  // 6. BudgetDetail 추출 및 생성
  const uniqueDetails = [
    ...new Map(
      budgetMasters.map((bm) => [
        `${bm.category}|${bm.subcategory}|${bm.detail}`,
        {
          category: bm.category,
          subcategory: bm.subcategory,
          detail: bm.detail,
          accountCode: bm.accountCode,
          description: bm.description,
        },
      ])
    ).values(),
  ];
  console.log(`\n예산(세목) 추출: ${uniqueDetails.length}개`);

  const detailMap = new Map<string, string>(); // "category|subcategory|detail" -> id
  for (let i = 0; i < uniqueDetails.length; i++) {
    const { category, subcategory, detail, accountCode, description } = uniqueDetails[i];
    const subcategoryKey = `${category}|${subcategory}`;
    const subcategoryId = subcategoryMap.get(subcategoryKey)!;
    const key = `${category}|${subcategory}|${detail}`;

    const existing = await prisma.budgetDetail.findUnique({
      where: { subcategoryId_name: { subcategoryId, name: detail } },
    });

    if (existing) {
      detailMap.set(key, existing.id);
    } else {
      const created = await prisma.budgetDetail.create({
        data: {
          subcategoryId,
          name: detail,
          accountCode,
          description,
          sortOrder: i + 1,
          isActive: true,
        },
      });
      detailMap.set(key, created.id);
      console.log(`  - [생성] ${detail}`);
    }
  }

  // 7. DepartmentBudgetDetail 연결 생성
  console.log(`\n부서-세목 연결 생성 중...`);
  let connectionCount = 0;

  for (const bm of budgetMasters) {
    const departmentKey = `${bm.committee}|${bm.department}`;
    const detailKey = `${bm.category}|${bm.subcategory}|${bm.detail}`;

    const departmentId = departmentMap.get(departmentKey);
    const budgetDetailId = detailMap.get(detailKey);

    if (departmentId && budgetDetailId) {
      const existing = await prisma.departmentBudgetDetail.findUnique({
        where: { departmentId_budgetDetailId: { departmentId, budgetDetailId } },
      });

      if (!existing) {
        await prisma.departmentBudgetDetail.create({
          data: {
            departmentId,
            budgetDetailId,
            isActive: true,
          },
        });
        connectionCount++;
      }
    }
  }
  console.log(`  - ${connectionCount}개 연결 생성됨`);

  // 8. BudgetDetailYear 생성 (2026년 기본값)
  console.log(`\n연도별 세목 설정 생성 중 (2026년)...`);
  const currentYear = 2026;
  let yearSettingCount = 0;

  for (const [key, budgetDetailId] of detailMap) {
    const existing = await prisma.budgetDetailYear.findUnique({
      where: { budgetDetailId_year: { budgetDetailId, year: currentYear } },
    });

    if (!existing) {
      await prisma.budgetDetailYear.create({
        data: {
          budgetDetailId,
          year: currentYear,
          budgetAmount: 0,
          usedAmount: 0,
          isActive: true,
        },
      });
      yearSettingCount++;
    }
  }
  console.log(`  - ${yearSettingCount}개 연도별 설정 생성됨`);

  // 결과 요약
  console.log('\n=== 마이그레이션 완료 ===');
  console.log(`위원회: ${committeeMap.size}개`);
  console.log(`사역팀(부): ${departmentMap.size}개`);
  console.log(`예산(항): ${categoryMap.size}개`);
  console.log(`예산(목): ${subcategoryMap.size}개`);
  console.log(`예산(세목): ${detailMap.size}개`);
  console.log(`부서-세목 연결: ${connectionCount}개`);
  console.log(`연도별 설정: ${yearSettingCount}개`);
}

main()
  .catch((e) => {
    console.error('마이그레이션 오류:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
