/**
 * CHURCH 템플릿 시드 스크립트 (ARC-001 §5)
 *
 * 한국 교회 표준 회계 구조 기반 계정과목 46건을
 * AccountCategoryTemplate(orgType: CHURCH) 전역 청사진으로 등록한다.
 * 코드 체계는 §5.1 표 기준 — 10xx/19xx 수입(INCOME), 5xxx 지출(EXPENSE).
 * 결재선 템플릿 2종(§5.2): 일반 지출 결재선(기본값) + 고액 지출 결재선.
 *
 * upsert 기반 — 재실행 안전 (delete 없음).
 *
 * 실행:
 * npx ts-node --project tsconfig.scripts.json prisma/seeds/church-template-seed.ts
 *
 * 환경변수 (필수):
 * - DATABASE_URL: 데이터베이스 연결 문자열 (필수)
 */

import { PrismaClient, OrgType, CategoryKind } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

config();

// 필수 환경변수 검증
if (!process.env.DATABASE_URL) {
  console.error('❌ 오류: DATABASE_URL 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// 계정과목 46건 — §5.1 코드 체계 (10xx/19xx: INCOME, 5xxx: EXPENSE)
// 수입 계정 포함 이유: 지출결의서 자체에는 쓰이지 않지만,
// 추후 "예산 대비 집행률" 기능에서 헌금 수입 예산이 기준이 된다.
const churchAccountGroups: {
  group: string;
  kind: CategoryKind;
  items: { code: string; name: string }[];
}[] = [
  {
    group: '헌금수입',
    kind: CategoryKind.INCOME,
    items: [
      { code: '1001', name: '십일조헌금' },
      { code: '1002', name: '주일헌금' },
      { code: '1003', name: '감사헌금' },
      { code: '1004', name: '절기헌금' },
      { code: '1005', name: '선교헌금' },
      { code: '1006', name: '건축헌금' },
    ],
  },
  {
    group: '기타수입',
    kind: CategoryKind.INCOME,
    items: [
      { code: '1901', name: '이자수입' },
      { code: '1902', name: '기타수입' },
    ],
  },
  {
    group: '예배비',
    kind: CategoryKind.EXPENSE,
    items: [
      { code: '5101', name: '예배용품비' },
      { code: '5102', name: '성찬비' },
      { code: '5103', name: '강사비' },
      { code: '5104', name: '찬양대운영비' },
    ],
  },
  {
    group: '인건비',
    kind: CategoryKind.EXPENSE,
    items: [
      { code: '5201', name: '교역자사례비' },
      { code: '5202', name: '직원급여' },
      { code: '5203', name: '사택비' },
      { code: '5204', name: '4대보험료' },
      { code: '5205', name: '퇴직적립금' },
    ],
  },
  {
    group: '목회활동비',
    kind: CategoryKind.EXPENSE,
    items: [
      { code: '5301', name: '목회활동비' },
      { code: '5302', name: '심방비' },
      { code: '5303', name: '도서연구비' },
    ],
  },
  {
    group: '선교비',
    kind: CategoryKind.EXPENSE,
    items: [
      { code: '5401', name: '국내선교비' },
      { code: '5402', name: '해외선교비' },
      { code: '5403', name: '개척지원비' },
      { code: '5404', name: '선교사후원비' },
    ],
  },
  {
    group: '교육비',
    kind: CategoryKind.EXPENSE,
    items: [
      { code: '5501', name: '교회학교운영비' },
      { code: '5502', name: '교재비' },
      { code: '5503', name: '수련회비' },
      { code: '5504', name: '제자훈련비' },
    ],
  },
  {
    group: '봉사구제비',
    kind: CategoryKind.EXPENSE,
    items: [
      { code: '5601', name: '구제비' },
      { code: '5602', name: '경조비' },
      { code: '5603', name: '장학금' },
      { code: '5604', name: '지역섬김비' },
    ],
  },
  {
    group: '관리비',
    kind: CategoryKind.EXPENSE,
    items: [
      { code: '5701', name: '전기수도가스비' },
      { code: '5702', name: '통신비' },
      { code: '5703', name: '차량유지비' },
      { code: '5704', name: '건물관리비' },
      { code: '5705', name: '수선비' },
      { code: '5706', name: '보험료' },
    ],
  },
  {
    group: '행정비',
    kind: CategoryKind.EXPENSE,
    items: [
      { code: '5801', name: '사무용품비' },
      { code: '5802', name: '인쇄홍보비' },
      { code: '5803', name: '회의비' },
      { code: '5804', name: '식대' },
    ],
  },
  {
    group: '상회비·적립·예비',
    kind: CategoryKind.EXPENSE,
    items: [
      { code: '5901', name: '노회상회비' },
      { code: '5902', name: '총회상회비' },
      { code: '5903', name: '건축적립금' },
      { code: '5904', name: '예비비' },
    ],
  },
];

// 결재선 템플릿 2종 (§5.2)
const approvalLineTemplates = [
  {
    name: '일반 지출 결재선',
    description: '교회 기본 결재선 (부서장 → 재정부장 → 담임목사)',
    isDefault: true,
    sortOrder: 1,
    steps: [
      { stepOrder: 1, roleLabel: '부서장' },
      { stepOrder: 2, roleLabel: '재정부장' },
      { stepOrder: 3, roleLabel: '담임목사' },
    ],
  },
  {
    name: '고액 지출 결재선',
    description: '고액 지출용 결재선 (부서장 → 재정부장 → 담임목사 → 당회서기, 예: 100만원 이상)',
    isDefault: false,
    sortOrder: 2,
    steps: [
      { stepOrder: 1, roleLabel: '부서장' },
      { stepOrder: 2, roleLabel: '재정부장' },
      { stepOrder: 3, roleLabel: '담임목사' },
      { stepOrder: 4, roleLabel: '당회서기' },
    ],
  },
];

async function main() {
  console.log('CHURCH 템플릿 시드 시작...\n');

  // 1. 계정과목 템플릿 upsert (orgType+code 기준, 재실행 안전)
  console.log('  - 계정과목 템플릿 upsert 중...');
  let sortOrder = 0;
  let categoryCount = 0;

  for (const { group, kind, items } of churchAccountGroups) {
    for (const item of items) {
      sortOrder++;
      await prisma.accountCategoryTemplate.upsert({
        where: {
          orgType_code: { orgType: OrgType.CHURCH, code: item.code },
        },
        update: {
          name: item.name,
          group,
          kind,
          sortOrder,
          isActive: true,
        },
        create: {
          orgType: OrgType.CHURCH,
          code: item.code,
          name: item.name,
          group,
          kind,
          sortOrder,
          isActive: true,
        },
      });
      categoryCount++;
    }
  }
  console.log(`    계정과목 템플릿 ${categoryCount}건 upsert 완료 (그룹 ${churchAccountGroups.length}개)`);

  // 2. 결재선 템플릿 upsert (orgType+name에 unique가 없으므로 findFirst 후 update/create)
  console.log('  - 결재선 템플릿 upsert 중...');

  for (const templateData of approvalLineTemplates) {
    const existing = await prisma.approvalLineTemplate.findFirst({
      where: { orgType: OrgType.CHURCH, name: templateData.name },
    });

    let templateId: string;

    if (existing) {
      const updated = await prisma.approvalLineTemplate.update({
        where: { id: existing.id },
        data: {
          description: templateData.description,
          isDefault: templateData.isDefault,
          sortOrder: templateData.sortOrder,
        },
      });
      templateId = updated.id;
    } else {
      const created = await prisma.approvalLineTemplate.create({
        data: {
          orgType: OrgType.CHURCH,
          name: templateData.name,
          description: templateData.description,
          isDefault: templateData.isDefault,
          sortOrder: templateData.sortOrder,
        },
      });
      templateId = created.id;
    }

    // 단계도 (templateId, stepOrder) 기준으로 update/create — delete 없음
    for (const step of templateData.steps) {
      const existingStep = await prisma.approvalStepTemplate.findFirst({
        where: { templateId, stepOrder: step.stepOrder },
      });

      if (existingStep) {
        await prisma.approvalStepTemplate.update({
          where: { id: existingStep.id },
          data: { roleLabel: step.roleLabel },
        });
      } else {
        await prisma.approvalStepTemplate.create({
          data: {
            templateId,
            stepOrder: step.stepOrder,
            roleLabel: step.roleLabel,
          },
        });
      }
    }

    console.log(
      `    결재선 템플릿 '${templateData.name}' upsert 완료 (${templateData.steps.map((s) => s.roleLabel).join(' → ')})`
    );
  }

  console.log('\nCHURCH 템플릿 시드 완료!');
}

main()
  .catch((e) => {
    console.error('CHURCH 템플릿 시드 오류:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
