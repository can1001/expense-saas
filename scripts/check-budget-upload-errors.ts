import { prisma } from '../lib/prisma';

async function main() {
  // 1) "예산 정보를 찾을 수 없습니다" 케이스
  const missingDetails = [
    { cat: '사역지원비', sub: '교역자사례비', det: '담임목사생활비' },
    { cat: '사역지원비', sub: '교역자사례비', det: '준전임사역자생활비' },
    { cat: '사역지원비', sub: '교역자사례비', det: '파트사역자생활비' },
    { cat: '사역지원비', sub: '교역자사례비', det: '교역자식대' },
    { cat: '사역지원비', sub: '사무사역비', det: '사무간사급여' },
    { cat: '사역지원비', sub: '사무사역비', det: '사무간사식대' },
  ];

  console.log('=== 누락된 세목 진단 ===');
  for (const { cat, sub, det } of missingDetails) {
    const exact = await prisma.budgetDetail.findFirst({
      where: {
        name: det,
        subcategory: { name: sub, category: { name: cat } },
      },
      include: {
        departmentDetails: {
          where: { isActive: true },
          include: { department: { include: { committee: true } } },
        },
      },
    });

    const byNameOnly = await prisma.budgetDetail.findMany({
      where: { name: det },
      include: {
        subcategory: { include: { category: true } },
        departmentDetails: {
          where: { isActive: true },
          include: { department: { include: { committee: true } } },
        },
      },
    });

    console.log(`\n[${cat} / ${sub} / ${det}]`);
    if (exact) {
      console.log(`  정확 매칭 O — 활성 매핑 ${exact.departmentDetails.length}건`);
      exact.departmentDetails.forEach((dd) => {
        console.log(`    매핑: ${dd.department.committee.name} / ${dd.department.name}`);
      });
    } else {
      console.log(`  정확 매칭 X`);
      if (byNameOnly.length > 0) {
        console.log(`  같은 세목명이 다른 항/목에 존재:`);
        byNameOnly.forEach((b) => {
          console.log(`    - ${b.subcategory.category.name} / ${b.subcategory.name} / ${b.name} (활성매핑 ${b.departmentDetails.length}건)`);
        });
      }
    }
  }

  // 2) 매핑 누락 케이스
  console.log('\n\n=== 매핑 누락 진단 ===');
  const mappingCases = [
    { com: '행정위원회', dep: '재정팀', cat: '목회활동비', sub: '목회_통신비', det: '목회_통신비' },
    { com: '기획위원회', dep: '재정팀', cat: '교역자사례비', sub: '사택관리비', det: '전세자금대출이자' },
    { com: '행정위원회', dep: '행정비', cat: '건물및시설유지관리비', sub: '공간임차료', det: '공간임차료' },
  ];

  for (const { com, dep, cat, sub, det } of mappingCases) {
    console.log(`\n[${com} / ${dep} / ${cat} / ${sub} / ${det}]`);

    const detail = await prisma.budgetDetail.findFirst({
      where: {
        name: det,
        subcategory: { name: sub, category: { name: cat } },
      },
      include: {
        departmentDetails: {
          where: { isActive: true },
          include: { department: { include: { committee: true } } },
        },
      },
    });
    if (detail) {
      console.log(`  세목 존재 O — 활성 매핑된 (위원회/부서):`);
      detail.departmentDetails.forEach((dd) => {
        console.log(`    - ${dd.department.committee.name} / ${dd.department.name}`);
      });
    } else {
      console.log(`  세목 자체가 없음 (오타 가능)`);
      const similar = await prisma.budgetDetail.findMany({
        where: { name: { contains: det.slice(0, Math.min(3, det.length)) } },
        include: { subcategory: { include: { category: true } } },
        take: 5,
      });
      if (similar.length) {
        console.log(`  유사 후보:`);
        similar.forEach((s) =>
          console.log(`    - ${s.subcategory.category.name} / ${s.subcategory.name} / ${s.name}`)
        );
      }
    }

    const dept = await prisma.department.findFirst({
      where: { name: dep, committee: { name: com } },
    });
    console.log(`  ${com}/${dep} 자체 존재: ${dept ? 'O' : 'X'}`);
  }

  // 3) BudgetCategory / Subcategory 자체 진단 — "사역지원비"가 등록돼 있는지
  console.log('\n\n=== 항/목 존재 여부 ===');
  for (const name of ['사역지원비', '교역자사례비', '사무사역비', '목회_통신비', '사택관리비', '공간임차료']) {
    const asCat = await prisma.budgetCategory.findFirst({ where: { name } });
    const asSub = await prisma.budgetSubcategory.findFirst({ where: { name }, include: { category: true } });
    console.log(`"${name}": 항=${asCat ? 'O' : 'X'} / 목=${asSub ? `O (소속 항: ${asSub.category.name})` : 'X'}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
