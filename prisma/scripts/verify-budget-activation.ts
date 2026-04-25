/**
 * 세목 비활성화 검증 스크립트
 *
 * 목적:
 * - 사용자가 제공한 43개 활성 세목이 DB에서 isActive=true인지 확인
 * - (예산외세목)_안내팀이 isActive=false인지 확인
 *
 * 실행: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/scripts/verify-budget-activation.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 사용자가 제공한 43개 활성 세목 목록 (위원회, 사역팀, 예산목, 예산세목)
const expectedActiveItems = [
  { committee: '(가칭)인사위', department: '인사위', subcategory: '전임사역자생활비', detail: '전임사역자생활비' },
  { committee: '(가칭)인사위', department: '인사위', subcategory: '사택관리비', detail: '사택관리비' },
  { committee: '(가칭)인사위', department: '인사위', subcategory: '차량관리비', detail: '차량관리비_인사위' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '상회부담금', detail: '동부시찰회 회비' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '사무_회의및접대비', detail: '식대_운영위원회' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '지급수수료', detail: '기타' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '목회_회의 및 접대비', detail: '목회_회의 및 접대비' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '비품비', detail: '고장 전자제품 교체' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '도서구입비', detail: '도서구입비' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '사택관리비', detail: '담임목사 이사비용' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '사택관리비', detail: '전임사역자 사택관리비' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '사택관리비', detail: '담임목사 전세자금대출이자' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '방송시설적립금', detail: '방송시설적립금' },
  { committee: '(가칭)행정위', department: '행정비', subcategory: '잡지출', detail: '잡지출' },
  { committee: '기획위원회', department: '이웃사랑팀', subcategory: '이웃사랑사역비', detail: '선교비(정기후원)' },
  { committee: '기획위원회', department: '이웃사랑팀', subcategory: '이웃사랑사역비', detail: '교육교제비' },
  { committee: '기획위원회', department: '홍보팀', subcategory: '홍보비', detail: '인쇄비' },
  { committee: '기획위원회', department: '홍보팀', subcategory: '홍보비', detail: '사용료(구독료)' },
  { committee: '기획위원회', department: '공간사역팀', subcategory: '공간사역비', detail: '운영비' },
  { committee: '기획위원회', department: '공간사역팀', subcategory: '공간사역비', detail: '운영비(소모임)' },
  { committee: '기획위원회', department: '재정팀', subcategory: '사무_회의및접대비', detail: '아웃팅비_재정팀' },
  { committee: '예배위원회', department: '기도팀', subcategory: '중보기도사역비', detail: '아웃팅비' },
  { committee: '예배위원회', department: '기도팀', subcategory: '중보기도사역비', detail: '소모품비' },
  { committee: '예배위원회', department: '방송팀', subcategory: '방송비', detail: '소모품비' },
  { committee: '예배위원회', department: '방송팀', subcategory: '방송비', detail: '비품비' },
  { committee: '예배위원회', department: '예배지원팀', subcategory: '예배준비비', detail: '행사비(선물)_예배지원팀' },
  { committee: '예배위원회', department: '예배지원팀', subcategory: '예배준비비', detail: '소모품비_예배지원팀' },
  { committee: '예배위원회', department: '찬양팀', subcategory: '찬양팀운영비', detail: '소모품비' },
  { committee: '예배위원회', department: '찬양팀', subcategory: '찬양팀운영비', detail: '아웃팅비' },
  { committee: '교육훈련위원회', department: '유치부', subcategory: '유치사역비', detail: '소모품비' },
  { committee: '교육훈련위원회', department: '초등부', subcategory: '초등사역비', detail: '소모품비' },
  { committee: '교육훈련위원회', department: '중고등부', subcategory: '중고등사역비', detail: '소모품비' },
  { committee: '목양위원회', department: '청년유스', subcategory: '청년유스사역비', detail: '심방교제비' },
  { committee: '목양위원회', department: '청년유스', subcategory: '청년유스사역비', detail: '소모품비' },
  { committee: '목양위원회', department: '양육지원', subcategory: '양육지원비', detail: '교육비(교재제작비)' },
  { committee: '목양위원회', department: '양육지원', subcategory: '양육지원비', detail: '행사비(전도학교)' },
  { committee: '목양위원회', department: '양육지원', subcategory: '양육지원비', detail: '행사비(스몰토크)' },
  { committee: '목양위원회', department: '양육지원', subcategory: '양육지원비', detail: '행사비(상담학교)' },
  { committee: '목양위원회', department: '양육지원', subcategory: '양육지원비', detail: '행사비(신입집사교육)' },
  { committee: '목양위원회', department: '양육지원', subcategory: '양육지원비', detail: '행사비(위원회)' },
  { committee: '목양위원회', department: '양육지원', subcategory: '양육지원비', detail: '행사비(목자교육)' },
  { committee: '목양위원회', department: '마중물팀', subcategory: '마중물비', detail: '아웃팅비' },
];

// 비활성화 상태여야 하는 세목
const expectedInactiveItems = [
  { committee: '예배위원회', department: '안내팀', subcategory: '예배준비비', detail: '(예산외세목)_안내팀' },
];

async function main() {
  console.log('='.repeat(70));
  console.log('세목 비활성화 검증 스크립트');
  console.log('='.repeat(70));
  console.log();

  // 1. 활성 세목 검증 (43개)
  console.log('📋 1. 활성 세목 검증 (43개)');
  console.log('-'.repeat(70));

  const activeResults: { item: typeof expectedActiveItems[0]; found: boolean; isActive: boolean | null }[] = [];

  for (const item of expectedActiveItems) {
    // 세목명으로 직접 검색
    const budgetDetail = await prisma.budgetDetail.findFirst({
      where: { name: item.detail },
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

    activeResults.push({
      item,
      found: budgetDetail !== null,
      isActive: budgetDetail?.isActive ?? null
    });
  }

  // 결과 출력
  const activeCorrect = activeResults.filter(r => r.found && r.isActive === true);
  const activeIncorrect = activeResults.filter(r => r.found && r.isActive !== true);
  const activeNotFound = activeResults.filter(r => !r.found);

  console.log(`✅ 활성 상태 정상: ${activeCorrect.length}개`);

  if (activeIncorrect.length > 0) {
    console.log(`\n❌ 비활성 상태인 세목 (문제 있음): ${activeIncorrect.length}개`);
    for (const r of activeIncorrect) {
      console.log(`   - ${r.item.committee} > ${r.item.department} > ${r.item.subcategory} > ${r.item.detail}`);
      console.log(`     isActive: ${r.isActive}`);
    }
  }

  if (activeNotFound.length > 0) {
    console.log(`\n⚠️ DB에서 찾을 수 없는 세목: ${activeNotFound.length}개`);
    for (const r of activeNotFound) {
      console.log(`   - ${r.item.committee} > ${r.item.department} > ${r.item.subcategory} > ${r.item.detail}`);
    }
  }

  console.log();

  // 2. 비활성 세목 검증 (1개)
  console.log('📋 2. 비활성 세목 검증 (1개)');
  console.log('-'.repeat(70));

  for (const item of expectedInactiveItems) {
    const budgetDetail = await prisma.budgetDetail.findFirst({
      where: { name: item.detail },
      include: {
        yearSettings: {
          where: { year: 2026 }
        }
      }
    });

    if (!budgetDetail) {
      console.log(`⚠️ DB에서 찾을 수 없음: ${item.detail}`);
    } else if (budgetDetail.isActive === false) {
      console.log(`✅ 비활성 상태 정상: ${item.detail}`);

      // BudgetDetailYear도 비활성화되었는지 확인
      const yearSetting = budgetDetail.yearSettings[0];
      if (yearSetting) {
        console.log(`   - BudgetDetailYear (2026): isActive=${yearSetting.isActive}`);
      } else {
        console.log(`   - BudgetDetailYear (2026): 설정 없음`);
      }
    } else {
      console.log(`❌ 활성 상태임 (비활성화 필요): ${item.detail}`);
      console.log(`   isActive: ${budgetDetail.isActive}`);
    }
  }

  console.log();

  // 3. 전체 비활성화 세목 현황
  console.log('📋 3. 전체 비활성화 세목 현황');
  console.log('-'.repeat(70));

  const allInactiveDetails = await prisma.budgetDetail.findMany({
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
      }
    }
  });

  console.log(`비활성화된 BudgetDetail 총: ${allInactiveDetails.length}개`);
  for (const detail of allInactiveDetails) {
    const deptInfo = detail.departmentDetails[0];
    const committeeName = deptInfo?.department.committee.name || '-';
    const deptName = deptInfo?.department.name || '-';
    console.log(`   - ${committeeName} > ${deptName} > ${detail.subcategory.name} > ${detail.name}`);
  }

  const allInactiveYearSettings = await prisma.budgetDetailYear.findMany({
    where: {
      isActive: false,
      year: 2026
    },
    include: {
      budgetDetail: {
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
      }
    }
  });

  console.log(`\n비활성화된 BudgetDetailYear (2026) 총: ${allInactiveYearSettings.length}개`);

  console.log();

  // 4. 요약
  console.log('='.repeat(70));
  console.log('📊 검증 요약');
  console.log('='.repeat(70));
  console.log(`총 검증 대상: ${expectedActiveItems.length + expectedInactiveItems.length}개`);
  console.log(`  - 활성 세목 검증: ${expectedActiveItems.length}개`);
  console.log(`    ✅ 정상 (isActive=true): ${activeCorrect.length}개`);
  console.log(`    ❌ 비정상 (isActive=false): ${activeIncorrect.length}개`);
  console.log(`    ⚠️ 미발견: ${activeNotFound.length}개`);
  console.log(`  - 비활성 세목 검증: ${expectedInactiveItems.length}개`);
  console.log(`\n전체 비활성화 현황:`);
  console.log(`  - BudgetDetail: ${allInactiveDetails.length}개`);
  console.log(`  - BudgetDetailYear (2026): ${allInactiveYearSettings.length}개`);

  const allGood = activeIncorrect.length === 0 && activeNotFound.length === 0;
  console.log();
  if (allGood) {
    console.log('✅ 모든 검증 통과!');
  } else {
    console.log('❌ 일부 검증 실패 - 위 내용을 확인하세요.');
  }
}

main()
  .catch((e) => {
    console.error('❌ 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
