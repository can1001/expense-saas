/**
 * 활성 세목 비교 스크립트
 *
 * 목적: 사용자가 제공한 129개 목록과 DB의 활성 세목을 비교
 *
 * 실행: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/scripts/compare-active-budgets.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 사용자가 제공한 129개 세목 목록
const userProvidedItems = [
  '행사비(전교인나들이)',
  '아웃팅비', // 홍보팀
  '행사비(청나잇)',
  '행사비(공간사역)',
  '인건비',
  '아웃팅비', // 공간사역팀
  '운영비(조사비)',
  '시설보수비',
  '아웃팅비', // 시설관리팀
  '후원(기관)',
  '사역비',
  '선교비',
  '예산외지출',
  '아웃팅비', // 이웃사랑팀
  '행사비', // 청세포팀
  '강사비', // 청세포팀
  '아웃팅비', // 청세포팀
  '관리운영비(악기보수)',
  '유지관리비', // 찬양팀
  '아웃팅비', // 찬양팀 (다시)
  '유지관리비', // 방송팀
  '아웃팅비', // 방송팀
  '성례비',
  '아웃팅비_예배지원팀',
  '아웃팅비_안내팀',
  '여성도모임',
  '심방 교제비', // 목양팀
  '아웃팅비', // 목양팀
  '구제비',
  '행사비(수련회)', // 청연유스
  '행사비(기타)', // 청연유스
  '아웃팅비', // 청연유스
  '교육비(결혼학교)',
  '교육비(목자교육)',
  '교육비(상담학교)',
  '교육비(신임집사교육)',
  '교육비(전도학교)',
  '행사비(고난만찬)',
  '행사비(고난만찬회비)',
  '행사비(교사세미나)',
  '행사비(교역자워크샵)',
  '행사비(리더세미나)',
  '행사비(부부세미나)',
  '행사비(부부세미나회비)',
  '행사비(스몰토크)', // 양육지원 - 교제비
  '행사비(암송대회)',
  '행사비(기타)', // 양육지원
  '행사비(일대일양육)',
  '교육교재비', // 영유아부
  '심방교제비', // 영유아부
  '행사비(성경학교)', // 영유아부
  '행사비(선물)', // 영유아부
  '행사비(기타)', // 영유아부
  '소모품비', // 영유아부
  '아웃팅비', // 영유아부
  '교육교재비', // 유치부
  '심방 교제비', // 유치부
  '행사비(성경학교)', // 유치부
  '행사비(선물)', // 유치부
  '행사비(기타)', // 유치부
  '아웃팅비', // 유치부
  '교육교재비', // 유년부
  '심방 교제비', // 유년부
  '행사비(성경학교)', // 유년부
  '행사비(선물)', // 유년부
  '행사비(기타)', // 유년부
  '아웃팅비', // 유년부
  '교육교재비', // 초등부
  '심방 교제비', // 초등부
  '행사비(성경학교)', // 초등부
  '행사비(선물)', // 초등부
  '행사비(기타)', // 초등부
  '아웃팅비', // 초등부
  '교육교재비', // 중고등부
  '심방 교제비', // 중고등부
  '행사비(수련회)', // 중고등부
  '행사비(선물)', // 중고등부
  '행사비(기타)', // 중고등부
  '아웃팅비', // 중고등부
  '교육교재비', // 새가족팀
  '행사비(선물)', // 새가족팀
  '행사비(환영회)',
  '아웃팅비', // 새가족팀
  '강사비', // 세바맘팀
  '다과간식비',
  '아웃팅비', // 세바맘팀
  '강사사례비',
  '경조비',
  '주일식사비',
  '주차비',
  '비품비', // 행정위
  '공간임차료',
  '장비임차료',
  '건물관리비',
  '목회_통신비',
  '목회 회의 및 접대비',
  '도서구입비', // 행정위
  '교육지원비',
  '차량관리비', // 행정위
  '사무_통신비',
  '소모품및사무용품비',
  '운영위원회 회의비',
  '재정팀 회의비',
  '인쇄비', // 행정위
  '여비교통비',
  '세무사사무실 수수료',
  '교회음악 저작권 연회비',
  '구독료(유튜브)',
  '소프트웨어',
  '잡지출', // 행정위
  '상회부담금',
  '서울남부노회 동부시찰회 회비',
  '예비비',
  '임차보증금(상환)적립금',
  '담임목사생활비',
  '준전임사역자생활비',
  '파트사역자생활비',
  '교역자_복리후생비',
  '자녀학비보조비',
  '학자금지원비',
  '교역자식대',
  '전세자금대출이자',
  '사무간사급여',
  '사무_복리후생비',
  '사무간사식대',
  '퇴직적립금',
  '퇴직연금 지급',
  '적립금_해지(재가입)',
  '적립금_사용(410호)',
];

// 유니크한 세목명 목록
const uniqueUserItems = [...new Set(userProvidedItems)];

async function main() {
  console.log('='.repeat(70));
  console.log('활성 세목 비교 스크립트');
  console.log('='.repeat(70));
  console.log();

  // 1. DB에서 활성화된 세목 조회
  const activeDetails = await prisma.budgetDetail.findMany({
    where: { isActive: true },
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
    },
    orderBy: { name: 'asc' }
  });

  console.log(`📋 DB 활성 세목 수: ${activeDetails.length}개`);
  console.log(`📋 사용자 제공 목록 (중복 제거): ${uniqueUserItems.length}개`);
  console.log();

  // 2. DB 활성 세목 중 사용자 목록에 없는 것 찾기
  const dbOnlyItems: typeof activeDetails = [];

  for (const detail of activeDetails) {
    // 세목명이 사용자 목록에 있는지 확인
    if (!userProvidedItems.includes(detail.name)) {
      dbOnlyItems.push(detail);
    }
  }

  console.log('='.repeat(70));
  console.log(`📋 DB에만 있는 활성 세목 (사용자 목록에 없음): ${dbOnlyItems.length}개`);
  console.log('='.repeat(70));

  if (dbOnlyItems.length > 0) {
    for (const detail of dbOnlyItems) {
      const deptInfo = detail.departmentDetails[0];
      const committeeName = deptInfo?.department.committee.name || '-';
      const deptName = deptInfo?.department.name || '-';
      console.log(`${committeeName}\t${deptName}\t${detail.subcategory.category.name}\t${detail.subcategory.name}\t${detail.name}`);
    }
  }

  // 3. 사용자 목록에는 있지만 DB에서 비활성화된 것 찾기
  console.log();
  console.log('='.repeat(70));
  console.log('📋 사용자 목록에 있지만 DB에서 비활성화된 세목');
  console.log('='.repeat(70));

  const inactiveInList: string[] = [];
  for (const itemName of uniqueUserItems) {
    const detail = await prisma.budgetDetail.findFirst({
      where: { name: itemName },
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

    if (detail && detail.isActive === false) {
      const deptInfo = detail.departmentDetails[0];
      const committeeName = deptInfo?.department.committee.name || '-';
      const deptName = deptInfo?.department.name || '-';
      inactiveInList.push(`${committeeName}\t${deptName}\t${detail.subcategory.name}\t${detail.name}`);
    }
  }

  if (inactiveInList.length > 0) {
    console.log(`비활성화된 세목: ${inactiveInList.length}개`);
    for (const item of inactiveInList) {
      console.log(item);
    }
  } else {
    console.log('없음');
  }

  // 4. 사용자 목록에 있지만 DB에 존재하지 않는 것
  console.log();
  console.log('='.repeat(70));
  console.log('📋 사용자 목록에 있지만 DB에 없는 세목');
  console.log('='.repeat(70));

  const notInDb: string[] = [];
  for (const itemName of uniqueUserItems) {
    const detail = await prisma.budgetDetail.findFirst({
      where: { name: itemName }
    });

    if (!detail) {
      notInDb.push(itemName);
    }
  }

  if (notInDb.length > 0) {
    console.log(`DB에 없는 세목: ${notInDb.length}개`);
    for (const item of notInDb) {
      console.log(`   - ${item}`);
    }
  } else {
    console.log('없음');
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
