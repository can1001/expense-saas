/**
 * budget-view 누락 세목 수정 스크립트
 *
 * 문제: budget-view에서 144개 세목이 조회되어야 하는데 143개만 조회됨
 * 원인: 활성 BudgetDetail 중 API 조건을 충족하지 못하는 세목 존재
 *
 * 실행: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/scripts/fix-missing-budget-detail.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPECTED_COUNT = 144;

async function main() {
  console.log('='.repeat(70));
  console.log('budget-view 누락 세목 진단 및 수정');
  console.log('='.repeat(70));
  console.log();

  const year = 2026;

  // 1. 전체 BudgetDetail 중 isActive = true인 세목 수
  const activeBudgetDetails = await prisma.budgetDetail.findMany({
    where: { isActive: true },
    include: {
      subcategory: { include: { category: true } },
      departmentDetails: {
        include: {
          department: { include: { committee: true } }
        }
      },
      yearSettings: {
        where: { year }
      }
    }
  });
  console.log(`[진단] BudgetDetail.isActive = true: ${activeBudgetDetails.length}개`);

  // 2. API 조건을 충족하는 세목 ID 집합 구하기
  const committees = await prisma.committee.findMany({
    where: { isActive: true },
    include: {
      departments: {
        where: { isActive: true },
        include: {
          budgetDetails: {
            where: {
              isActive: true,
              budgetDetail: { isActive: true },
            },
            include: {
              budgetDetail: {
                include: {
                  yearSettings: {
                    where: { year, isActive: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  const apiVisibleIds = new Set<string>();
  for (const committee of committees) {
    for (const dept of committee.departments) {
      for (const dbd of dept.budgetDetails) {
        if (dbd.budgetDetail.yearSettings.length > 0) {
          apiVisibleIds.add(dbd.budgetDetailId);
        }
      }
    }
  }

  console.log(`[진단] API 조건 충족 세목: ${apiVisibleIds.size}개`);
  console.log(`[진단] 누락 세목: ${activeBudgetDetails.length - apiVisibleIds.size}개`);

  // 3. 누락된 세목 찾기
  const missingDetails = activeBudgetDetails.filter(bd => !apiVisibleIds.has(bd.id));

  if (missingDetails.length > 0) {
    console.log('\n📋 누락된 세목 상세:');
    for (const bd of missingDetails) {
      const dbd = bd.departmentDetails[0];
      const committeeName = dbd?.department.committee.name || '-';
      const deptName = dbd?.department.name || '-';

      console.log(`\n   [BudgetDetail ID: ${bd.id}] ${bd.name}`);
      console.log(`   위치: ${committeeName} > ${deptName} > ${bd.subcategory.category.name} > ${bd.subcategory.name}`);
      console.log(`   BudgetDetail.isActive: ${bd.isActive}`);

      // 원인 분석
      if (bd.departmentDetails.length === 0) {
        console.log(`   ❌ 원인: DepartmentBudgetDetail 레코드 없음`);
      } else {
        for (const dd of bd.departmentDetails) {
          console.log(`   DepartmentBudgetDetail [${dd.id}]:`);
          console.log(`     - department: ${dd.department.name} (isActive: ${dd.department.isActive})`);
          console.log(`     - committee: ${dd.department.committee.name} (isActive: ${dd.department.committee.isActive})`);
          console.log(`     - DepartmentBudgetDetail.isActive: ${dd.isActive}`);

          if (!dd.isActive) {
            console.log(`   ❌ 원인: DepartmentBudgetDetail.isActive = false`);
          }
          if (!dd.department.isActive) {
            console.log(`   ❌ 원인: Department.isActive = false`);
          }
          if (!dd.department.committee.isActive) {
            console.log(`   ❌ 원인: Committee.isActive = false`);
          }
        }
      }

      if (bd.yearSettings.length === 0) {
        console.log(`   ❌ 원인: BudgetDetailYear (${year}) 레코드 없음`);
      } else {
        for (const ys of bd.yearSettings) {
          console.log(`   BudgetDetailYear [${ys.id}]: year=${ys.year}, isActive=${ys.isActive}`);
          if (!ys.isActive) {
            console.log(`   ❌ 원인: BudgetDetailYear.isActive = false`);
          }
        }
      }
    }

    // 4. 자동 수정 시도
    console.log('\n' + '='.repeat(70));
    console.log('자동 수정');
    console.log('='.repeat(70));

    let fixedCount = 0;

    for (const bd of missingDetails) {
      // Case 1: DepartmentBudgetDetail.isActive = false 수정
      const inactiveDbd = bd.departmentDetails.filter(dd => !dd.isActive);
      if (inactiveDbd.length > 0) {
        for (const dd of inactiveDbd) {
          await prisma.departmentBudgetDetail.update({
            where: { id: dd.id },
            data: { isActive: true }
          });
          console.log(`✅ DepartmentBudgetDetail [${dd.id}] 활성화`);
          fixedCount++;
        }
      }

      // Case 2: Department.isActive = false 수정
      const inactiveDept = bd.departmentDetails.filter(dd => !dd.department.isActive);
      if (inactiveDept.length > 0) {
        for (const dd of inactiveDept) {
          await prisma.department.update({
            where: { id: dd.department.id },
            data: { isActive: true }
          });
          console.log(`✅ Department [${dd.department.id}] "${dd.department.name}" 활성화`);
          fixedCount++;
        }
      }

      // Case 3: BudgetDetailYear.isActive = false 수정
      const inactiveYears = bd.yearSettings.filter(ys => !ys.isActive);
      if (inactiveYears.length > 0) {
        for (const ys of inactiveYears) {
          await prisma.budgetDetailYear.update({
            where: { id: ys.id },
            data: { isActive: true }
          });
          console.log(`✅ BudgetDetailYear [${ys.id}] 활성화`);
          fixedCount++;
        }
      }

      // Case 4: BudgetDetailYear 레코드가 없는 경우 생성
      if (bd.yearSettings.length === 0) {
        await prisma.budgetDetailYear.create({
          data: {
            budgetDetailId: bd.id,
            year: year,
            budgetAmount: 0,
            isActive: true
          }
        });
        console.log(`✅ BudgetDetailYear 생성 (budgetDetailId: ${bd.id}, year: ${year})`);
        fixedCount++;
      }
    }

    if (fixedCount === 0) {
      console.log('⚠️ 자동 수정 가능한 항목이 없습니다. 수동 확인 필요.');
    }
  }

  // 5. 수정 후 검증
  console.log('\n' + '='.repeat(70));
  console.log('수정 후 검증');
  console.log('='.repeat(70));

  // API 쿼리와 동일한 조건으로 세목 수 카운트
  const committeesAfter = await prisma.committee.findMany({
    where: { isActive: true },
    include: {
      departments: {
        where: { isActive: true },
        include: {
          budgetDetails: {
            where: {
              isActive: true,
              budgetDetail: { isActive: true },
            },
            include: {
              budgetDetail: {
                include: {
                  yearSettings: {
                    where: { year, isActive: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  let totalDetails = 0;
  for (const committee of committeesAfter) {
    for (const dept of committee.departments) {
      for (const dbd of dept.budgetDetails) {
        if (dbd.budgetDetail.yearSettings.length > 0) {
          totalDetails++;
        }
      }
    }
  }

  console.log(`\n[검증] API 조건으로 조회되는 세목 수: ${totalDetails}개`);

  if (totalDetails === EXPECTED_COUNT) {
    console.log(`✅ 예상 값(${EXPECTED_COUNT}개)과 일치합니다!`);
  } else {
    console.log(`⚠️ 예상 값(${EXPECTED_COUNT}개)과 불일치. 차이: ${EXPECTED_COUNT - totalDetails}개`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('완료');
  console.log('='.repeat(70));
}

main()
  .catch((e) => {
    console.error('❌ 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
