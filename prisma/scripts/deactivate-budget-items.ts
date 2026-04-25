/**
 * 44개 세목 비활성화 스크립트
 *
 * 목적: 사용자가 지정한 44개 세목을 비활성화 (isActive=false)
 *
 * 실행: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/scripts/deactivate-budget-items.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 비활성화할 세목 목록 (위원회, 사역팀, 예산목, 예산세목)
const itemsToDeactivate = [
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
  { committee: '예배위원회', department: '안내팀', subcategory: '예배준비비', detail: '(예산외세목)_안내팀' },
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
  { committee: '목양위원회', department: '청년유스', subcategory: '청년유스사역비', detail: '심방교제비' }, // DB에서는 공백 없음
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

async function main() {
  console.log('='.repeat(70));
  console.log('44개 세목 비활성화 스크립트');
  console.log('='.repeat(70));
  console.log();

  let deactivatedCount = 0;
  let deactivatedYearCount = 0;
  const notFound: typeof itemsToDeactivate = [];
  const alreadyInactive: typeof itemsToDeactivate = [];

  for (const item of itemsToDeactivate) {
    // 세목명으로 검색
    const budgetDetail = await prisma.budgetDetail.findFirst({
      where: { name: item.detail },
      include: {
        yearSettings: {
          where: { year: 2026 }
        }
      }
    });

    if (!budgetDetail) {
      notFound.push(item);
      continue;
    }

    if (budgetDetail.isActive === false) {
      alreadyInactive.push(item);
      continue;
    }

    // BudgetDetail 비활성화
    await prisma.budgetDetail.update({
      where: { id: budgetDetail.id },
      data: { isActive: false }
    });
    deactivatedCount++;

    // BudgetDetailYear 비활성화 (2026년)
    const yearResult = await prisma.budgetDetailYear.updateMany({
      where: {
        budgetDetailId: budgetDetail.id,
        year: 2026,
        isActive: true
      },
      data: { isActive: false }
    });
    deactivatedYearCount += yearResult.count;

    console.log(`✅ 비활성화: ${item.committee} > ${item.department} > ${item.subcategory} > ${item.detail}`);
  }

  console.log();
  console.log('='.repeat(70));
  console.log('📊 결과 요약');
  console.log('='.repeat(70));
  console.log(`총 대상: ${itemsToDeactivate.length}개`);
  console.log(`✅ 비활성화 완료: ${deactivatedCount}개`);
  console.log(`⏭️ 이미 비활성화됨: ${alreadyInactive.length}개`);
  console.log(`❌ 미발견: ${notFound.length}개`);
  console.log();
  console.log(`BudgetDetail 비활성화: ${deactivatedCount}개`);
  console.log(`BudgetDetailYear (2026) 비활성화: ${deactivatedYearCount}개`);

  if (notFound.length > 0) {
    console.log();
    console.log('❌ DB에서 찾을 수 없는 세목:');
    for (const item of notFound) {
      console.log(`   - ${item.committee} > ${item.department} > ${item.subcategory} > ${item.detail}`);
    }
  }

  if (alreadyInactive.length > 0) {
    console.log();
    console.log('⏭️ 이미 비활성화된 세목:');
    for (const item of alreadyInactive) {
      console.log(`   - ${item.committee} > ${item.department} > ${item.subcategory} > ${item.detail}`);
    }
  }

  // 최종 비활성화 현황
  console.log();
  console.log('='.repeat(70));
  console.log('📋 최종 비활성화 세목 현황');
  console.log('='.repeat(70));

  const totalInactiveDetails = await prisma.budgetDetail.count({
    where: { isActive: false }
  });

  const totalInactiveYears = await prisma.budgetDetailYear.count({
    where: {
      isActive: false,
      year: 2026
    }
  });

  console.log(`비활성화된 BudgetDetail: ${totalInactiveDetails}개`);
  console.log(`비활성화된 BudgetDetailYear (2026): ${totalInactiveYears}개`);
}

main()
  .catch((e) => {
    console.error('❌ 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
