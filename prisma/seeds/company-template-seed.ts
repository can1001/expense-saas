/**
 * COMPANY 템플릿 시드 스크립트 (ARC-001 §7-1)
 *
 * 기존 청연컨설팅 시드(chungyeon-consulting-seed.ts)의 계정과목을
 * AccountCategoryTemplate(orgType: COMPANY) 전역 청사진으로 승격한다.
 * 결재선 템플릿 1종(팀장 → 본부장 → 대표, 기본값) 포함.
 *
 * upsert 기반 — 재실행 안전 (delete 없음).
 *
 * 실행:
 * npx ts-node --project tsconfig.scripts.json prisma/seeds/company-template-seed.ts
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

// 계정과목 그룹 (청연컨설팅 시드의 항 → group, 세목 → code/name 보존)
// 전부 지출 항목이므로 kind: EXPENSE
const companyAccountGroups: { group: string; items: { code: string; name: string }[] }[] = [
  {
    group: '인건비',
    items: [
      { code: '801', name: '임원급여' },
      { code: '802', name: '직원급여' },
      { code: '803', name: '상여금' },
      { code: '804', name: '제수당' },
      { code: '805', name: '잡급' },
      { code: '806', name: '퇴직급여충당금전입' },
      { code: '808', name: '퇴직급여' },
      { code: '849', name: '명예퇴직금' },
    ],
  },
  {
    group: '노무비',
    items: [
      { code: '503', name: '급여' },
      { code: '504', name: '임금' },
      { code: '505', name: '상여금' },
      { code: '506', name: '제수당' },
      { code: '507', name: '잡급' },
      { code: '508', name: '퇴직급여충당금전입' },
      { code: '510', name: '퇴직급여' },
    ],
  },
  {
    group: '복리후생비',
    items: [
      { code: '511', name: '복리후생비' },
      { code: '811', name: '복리후생비(판관비)' },
    ],
  },
  {
    group: '여비교통비',
    items: [
      { code: '512', name: '여비교통비' },
      { code: '812', name: '여비교통비(판관비)' },
    ],
  },
  {
    group: '접대비',
    items: [
      { code: '513', name: '접대비(기업업무추진비)' },
      { code: '813', name: '접대비(판관비)' },
    ],
  },
  {
    group: '통신비',
    items: [
      { code: '514', name: '통신비' },
      { code: '814', name: '통신비(판관비)' },
    ],
  },
  {
    group: '수도광열비',
    items: [
      { code: '515', name: '가스수도료' },
      { code: '516', name: '전력비' },
      { code: '815', name: '수도광열비(판관비)' },
    ],
  },
  {
    group: '세금과공과금',
    items: [
      { code: '517', name: '세금과공과금' },
      { code: '817', name: '세금과공과금(판관비)' },
    ],
  },
  {
    group: '감가상각비',
    items: [
      { code: '518', name: '감가상각비' },
      { code: '818', name: '감가상각비(판관비)' },
      { code: '840', name: '무형고정자산상각' },
    ],
  },
  {
    group: '지급임차료',
    items: [
      { code: '519', name: '지급임차료' },
      { code: '819', name: '지급임차료(판관비)' },
    ],
  },
  {
    group: '수선비',
    items: [
      { code: '520', name: '수선비' },
      { code: '820', name: '수선비(판관비)' },
    ],
  },
  {
    group: '보험료',
    items: [
      { code: '521', name: '보험료' },
      { code: '821', name: '보험료(판관비)' },
    ],
  },
  {
    group: '차량유지비',
    items: [
      { code: '522', name: '차량유지비' },
      { code: '822', name: '차량유지비(판관비)' },
    ],
  },
  {
    group: '연구개발비',
    items: [
      { code: '523', name: '경상연구개발비' },
      { code: '823', name: '연구개발비(판관비)' },
    ],
  },
  {
    group: '운반비',
    items: [
      { code: '524', name: '운반비' },
      { code: '824', name: '운반비(판관비)' },
    ],
  },
  {
    group: '교육훈련비',
    items: [
      { code: '525', name: '교육훈련비' },
      { code: '825', name: '교육훈련비(판관비)' },
    ],
  },
  {
    group: '도서인쇄비',
    items: [
      { code: '526', name: '도서인쇄비' },
      { code: '826', name: '도서인쇄비(판관비)' },
    ],
  },
  {
    group: '회의비',
    items: [
      { code: '527', name: '회의비' },
      { code: '827', name: '회의비(판관비)' },
    ],
  },
  {
    group: '사무용품비',
    items: [
      { code: '529', name: '사무용품비' },
      { code: '829', name: '사무용품비(판관비)' },
    ],
  },
  {
    group: '소모품비',
    items: [
      { code: '530', name: '소모품비' },
      { code: '830', name: '소모품비(판관비)' },
    ],
  },
  {
    group: '지급수수료',
    items: [
      { code: '531', name: '지급수수료' },
      { code: '831', name: '지급수수료(판관비)' },
    ],
  },
  {
    group: '외주비',
    items: [
      { code: '533', name: '외주가공비' },
      { code: '836', name: '외주비' },
      { code: '638', name: '외주공사비' },
    ],
  },
  {
    group: '시험비',
    items: [{ code: '534', name: '시험비' }],
  },
  {
    group: '광고선전비',
    items: [
      { code: '636', name: '광고선전비' },
      { code: '833', name: '광고선전비(판관비)' },
    ],
  },
  {
    group: '판매촉진비',
    items: [
      { code: '834', name: '판매촉진비' },
      { code: '633', name: '판매수수료' },
    ],
  },
  {
    group: '협회비',
    items: [
      { code: '639', name: '협회비' },
      { code: '845', name: '협회비(판관비)' },
    ],
  },
  {
    group: '잡비',
    items: [
      { code: '536', name: '잡비' },
      { code: '848', name: '잡비(판관비)' },
      { code: '535', name: '기밀비' },
    ],
  },
  {
    group: '원재료비',
    items: [
      { code: '501', name: '원재료비' },
      { code: '502', name: '부재료비' },
      { code: '841', name: '원재료비(판관비)' },
    ],
  },
  {
    group: '설계용역비',
    items: [
      { code: '635', name: '설계용역비' },
      { code: '735', name: '설계용역비(분양)' },
    ],
  },
  {
    group: '장비사용료',
    items: [
      { code: '634', name: '장비사용료' },
      { code: '736', name: '가설재손료' },
    ],
  },
  {
    group: '폐기물처리비',
    items: [
      { code: '632', name: '폐기물처리비' },
      { code: '832', name: '폐기물처리비(판관비)' },
    ],
  },
  {
    group: '하자보수비',
    items: [
      { code: '627', name: '하자보수비' },
      { code: '847', name: '하자보수충당금전입' },
    ],
  },
  {
    group: '대손상각비',
    items: [
      { code: '835', name: '대손상각비' },
      { code: '934', name: '기타의대손상각비' },
    ],
  },
  {
    group: '기부금',
    items: [{ code: '933', name: '기부금' }],
  },
];

// 결재선 템플릿 (기업 기본: 팀장 → 본부장 → 대표)
const approvalLineTemplates = [
  {
    name: '일반 지출 결재선',
    description: '기업 기본 결재선 (팀장 → 본부장 → 대표)',
    isDefault: true,
    sortOrder: 1,
    steps: [
      { stepOrder: 1, roleLabel: '팀장' },
      { stepOrder: 2, roleLabel: '본부장' },
      { stepOrder: 3, roleLabel: '대표' },
    ],
  },
];

async function main() {
  console.log('COMPANY 템플릿 시드 시작...\n');

  // 1. 계정과목 템플릿 upsert (orgType+code 기준, 재실행 안전)
  console.log('  - 계정과목 템플릿 upsert 중...');
  let sortOrder = 0;
  let categoryCount = 0;

  for (const { group, items } of companyAccountGroups) {
    for (const item of items) {
      sortOrder++;
      await prisma.accountCategoryTemplate.upsert({
        where: {
          orgType_code: { orgType: OrgType.COMPANY, code: item.code },
        },
        update: {
          name: item.name,
          group,
          kind: CategoryKind.EXPENSE,
          sortOrder,
          isActive: true,
        },
        create: {
          orgType: OrgType.COMPANY,
          code: item.code,
          name: item.name,
          group,
          kind: CategoryKind.EXPENSE,
          sortOrder,
          isActive: true,
        },
      });
      categoryCount++;
    }
  }
  console.log(`    계정과목 템플릿 ${categoryCount}건 upsert 완료 (그룹 ${companyAccountGroups.length}개)`);

  // 2. 결재선 템플릿 upsert (orgType+name에 unique가 없으므로 findFirst 후 update/create)
  console.log('  - 결재선 템플릿 upsert 중...');

  for (const templateData of approvalLineTemplates) {
    const existing = await prisma.approvalLineTemplate.findFirst({
      where: { orgType: OrgType.COMPANY, name: templateData.name },
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
          orgType: OrgType.COMPANY,
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

  console.log('\nCOMPANY 템플릿 시드 완료!');
}

main()
  .catch((e) => {
    console.error('COMPANY 템플릿 시드 오류:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
