/**
 * 세목 활성화 상태 조정 스크립트
 *
 * - 6개 세목 비활성화
 * - 8개 세목 활성화
 *
 * 실행: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/scripts/adjust-budget-activation.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 비활성화할 6개 세목
const itemsToDeactivate = [
  '기타 비품',
  '아웃팅비_기도팀',
  '아웃팅비_찬양팀',
  '유지관리비_방송팀',
  '유지관리비_찬양팀',
  '행사비(전교인행사)',
];

// 활성화할 8개 세목
const itemsToActivate = [
  '아웃팅비',        // 청세포팀
  '행사비(스몰토크)', // 양육지원
  '심방교제비',       // 청년유스
  '소모품비',         // 영유아부
  '비품비',           // 방송팀
  '도서구입비',       // 행정위
  '인쇄비',           // 행정위
  '잡지출',           // 행정위
];

async function main() {
  console.log('='.repeat(70));
  console.log('세목 활성화 상태 조정 스크립트');
  console.log('='.repeat(70));
  console.log();

  // 1. 6개 세목 비활성화
  console.log('📋 1. 비활성화 처리 (6개)');
  console.log('-'.repeat(70));

  let deactivatedCount = 0;
  let deactivatedYearCount = 0;

  for (const name of itemsToDeactivate) {
    const detail = await prisma.budgetDetail.findFirst({
      where: { name },
      include: {
        departmentDetails: {
          include: {
            department: {
              include: { committee: true }
            }
          }
        }
      }
    });

    if (!detail) {
      console.log(`   ⚠️ 찾을 수 없음: ${name}`);
      continue;
    }

    if (detail.isActive === false) {
      console.log(`   ⏭️ 이미 비활성화: ${name}`);
      continue;
    }

    // BudgetDetail 비활성화
    await prisma.budgetDetail.update({
      where: { id: detail.id },
      data: { isActive: false }
    });

    // BudgetDetailYear 비활성화
    const yearResult = await prisma.budgetDetailYear.updateMany({
      where: {
        budgetDetailId: detail.id,
        year: 2026,
        isActive: true
      },
      data: { isActive: false }
    });

    const deptInfo = detail.departmentDetails[0];
    const committeeName = deptInfo?.department.committee.name || '-';
    const deptName = deptInfo?.department.name || '-';

    console.log(`   ✅ 비활성화: ${committeeName} > ${deptName} > ${name}`);
    deactivatedCount++;
    deactivatedYearCount += yearResult.count;
  }

  console.log();
  console.log(`   비활성화 완료: BudgetDetail ${deactivatedCount}개, BudgetDetailYear ${deactivatedYearCount}개`);
  console.log();

  // 2. 8개 세목 활성화
  console.log('📋 2. 활성화 처리 (8개)');
  console.log('-'.repeat(70));

  let activatedCount = 0;
  let activatedYearCount = 0;

  for (const name of itemsToActivate) {
    // 이름이 중복될 수 있으므로 비활성화된 것만 찾기
    const details = await prisma.budgetDetail.findMany({
      where: {
        name,
        isActive: false
      },
      include: {
        departmentDetails: {
          include: {
            department: {
              include: { committee: true }
            }
          }
        },
        yearSettings: {
          where: { year: 2026 }
        }
      }
    });

    if (details.length === 0) {
      // 이미 활성화되어 있거나 없는 경우
      const existing = await prisma.budgetDetail.findFirst({ where: { name } });
      if (existing) {
        console.log(`   ⏭️ 이미 활성화: ${name}`);
      } else {
        console.log(`   ⚠️ 찾을 수 없음: ${name}`);
      }
      continue;
    }

    for (const detail of details) {
      // BudgetDetail 활성화
      await prisma.budgetDetail.update({
        where: { id: detail.id },
        data: { isActive: true }
      });

      // BudgetDetailYear 활성화
      const yearResult = await prisma.budgetDetailYear.updateMany({
        where: {
          budgetDetailId: detail.id,
          year: 2026,
          isActive: false
        },
        data: { isActive: true }
      });

      const deptInfo = detail.departmentDetails[0];
      const committeeName = deptInfo?.department.committee.name || '-';
      const deptName = deptInfo?.department.name || '-';

      console.log(`   ✅ 활성화: ${committeeName} > ${deptName} > ${name}`);
      activatedCount++;
      activatedYearCount += yearResult.count;
    }
  }

  console.log();
  console.log(`   활성화 완료: BudgetDetail ${activatedCount}개, BudgetDetailYear ${activatedYearCount}개`);
  console.log();

  // 3. 최종 현황
  console.log('='.repeat(70));
  console.log('📊 최종 현황');
  console.log('='.repeat(70));

  const totalActive = await prisma.budgetDetail.count({ where: { isActive: true } });
  const totalInactive = await prisma.budgetDetail.count({ where: { isActive: false } });
  const totalActiveYear = await prisma.budgetDetailYear.count({ where: { isActive: true, year: 2026 } });
  const totalInactiveYear = await prisma.budgetDetailYear.count({ where: { isActive: false, year: 2026 } });

  console.log(`BudgetDetail: 활성 ${totalActive}개, 비활성 ${totalInactive}개`);
  console.log(`BudgetDetailYear (2026): 활성 ${totalActiveYear}개, 비활성 ${totalInactiveYear}개`);
  console.log();
  console.log('✅ 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
