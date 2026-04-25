/**
 * 잘못 비활성화된 세목 수정 스크립트
 *
 * 목적: 활성화되어야 하는데 비활성화된 6개 세목을 다시 활성화
 *
 * 실행: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/scripts/fix-budget-activation.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 활성화해야 할 세목들
const itemsToActivate = [
  '전임사역자생활비',
  '사택관리비',
  '고장 전자제품 교체',
  '담임목사 이사비용',
  '전임사역자 사택관리비',
  '담임목사 전세자금대출이자',
  '소모품비', // 여러 부서에서 사용 - 모두 활성화
  '아웃팅비', // 여러 부서에서 사용 - 확인 필요
];

// 예산외세목만 비활성화 상태로 유지해야 할 패턴
const shouldRemainInactive = [
  '(예산외세목)',
  '(예산외세목)_',
];

async function main() {
  console.log('='.repeat(70));
  console.log('세목 활성화 수정 스크립트');
  console.log('='.repeat(70));
  console.log();

  // 1. 현재 비활성화된 세목 조회
  const inactiveDetails = await prisma.budgetDetail.findMany({
    where: { isActive: false },
    include: {
      subcategory: {
        include: { category: true }
      },
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

  console.log(`현재 비활성화된 세목: ${inactiveDetails.length}개`);
  console.log();

  // 2. 예산외세목이 아닌 세목들 필터링 (활성화 대상)
  const toActivate = inactiveDetails.filter(detail => {
    // 예산외세목 패턴에 해당하면 비활성화 유지
    for (const pattern of shouldRemainInactive) {
      if (detail.name.includes(pattern)) {
        return false;
      }
    }
    return true;
  });

  console.log(`활성화 대상 세목: ${toActivate.length}개`);
  for (const detail of toActivate) {
    const deptInfo = detail.departmentDetails[0];
    const committeeName = deptInfo?.department.committee.name || '-';
    const deptName = deptInfo?.department.name || '-';
    console.log(`   - ${committeeName} > ${deptName} > ${detail.subcategory.name} > ${detail.name}`);
  }
  console.log();

  // 3. BudgetDetail 활성화
  console.log('📋 BudgetDetail 활성화 중...');
  let activatedCount = 0;
  let activatedYearCount = 0;

  for (const detail of toActivate) {
    // BudgetDetail 활성화
    await prisma.budgetDetail.update({
      where: { id: detail.id },
      data: { isActive: true }
    });
    activatedCount++;

    // BudgetDetailYear 활성화 (2026년)
    if (detail.yearSettings.length > 0) {
      await prisma.budgetDetailYear.updateMany({
        where: {
          budgetDetailId: detail.id,
          year: 2026,
          isActive: false
        },
        data: { isActive: true }
      });
      activatedYearCount += detail.yearSettings.length;
    }
  }

  console.log(`✅ BudgetDetail 활성화: ${activatedCount}개`);
  console.log(`✅ BudgetDetailYear (2026) 활성화: ${activatedYearCount}개`);
  console.log();

  // 4. "심방 교제비" 세목 존재 여부 확인
  console.log('📋 "심방 교제비" 세목 확인...');
  const shimang = await prisma.budgetDetail.findFirst({
    where: {
      name: {
        contains: '심방'
      }
    },
    include: {
      subcategory: true,
      departmentDetails: {
        include: {
          department: {
            include: { committee: true }
          }
        }
      }
    }
  });

  if (shimang) {
    console.log(`   발견: ${shimang.name} (isActive: ${shimang.isActive})`);
  } else {
    console.log('   ⚠️ "심방" 포함 세목을 찾을 수 없음');

    // 청년유스 세목 모두 확인
    const youthDetails = await prisma.budgetDetail.findMany({
      where: {
        subcategory: {
          name: '청년유스사역비'
        }
      },
      include: {
        subcategory: true
      }
    });

    console.log(`   청년유스사역비 하위 세목:`);
    for (const d of youthDetails) {
      console.log(`     - ${d.name} (isActive: ${d.isActive})`);
    }
  }

  console.log();

  // 5. 최종 상태 확인
  console.log('📋 최종 비활성화 세목 현황...');
  const finalInactive = await prisma.budgetDetail.findMany({
    where: { isActive: false },
    include: {
      subcategory: true,
      departmentDetails: {
        include: {
          department: {
            include: { committee: true }
          }
        }
      }
    }
  });

  console.log(`비활성화된 BudgetDetail: ${finalInactive.length}개`);
  for (const detail of finalInactive) {
    const deptInfo = detail.departmentDetails[0];
    const committeeName = deptInfo?.department.committee.name || '-';
    const deptName = deptInfo?.department.name || '-';
    console.log(`   - ${committeeName} > ${deptName} > ${detail.subcategory.name} > ${detail.name}`);
  }

  const finalInactiveYears = await prisma.budgetDetailYear.count({
    where: {
      isActive: false,
      year: 2026
    }
  });

  console.log(`\n비활성화된 BudgetDetailYear (2026): ${finalInactiveYears}개`);
  console.log();
  console.log('='.repeat(70));
  console.log('✅ 수정 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
