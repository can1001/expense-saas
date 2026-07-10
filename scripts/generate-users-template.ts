/**
 * 테넌트 사용자 일괄 등록용 엑셀 템플릿 생성 스크립트
 *
 * `/api/users/upload` (관리자 엑셀 업로드) 형식에 맞춘 템플릿을 생성한다.
 * 테넌트의 실제 부서/역할을 DB에서 읽어 미리 채우고, 역할·부서·활성화 드롭다운을 넣는다.
 *
 * 사용법:
 *   npx ts-node --project tsconfig.scripts.json scripts/generate-users-template.ts <subdomain>
 *   (subdomain 생략 시 chungyeon-consulting)
 *
 * 출력: templates/<subdomain>-users-template.xlsx
 */

import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// `/api/users/upload`의 ROLE_MAP이 인식하는 한글 역할명만 사용 (role.code -> 한글 라벨)
const ROLE_LABEL_BY_CODE: Record<string, string> = {
  admin: '관리자',
  finance_head: '재정팀장',
  accountant: '회계',
  team_leader: '팀장',
  admin_assistant: '행정간사',
  user: '사용자',
};

async function main() {
  const subdomain = process.argv[2] || 'chungyeon-consulting';

  const tenant = await prisma.tenant.findUnique({
    where: { subdomain },
    select: {
      id: true,
      name: true,
      roles: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { code: true } },
      committees: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          name: true,
          departments: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { name: true } },
        },
      },
    },
  });

  if (!tenant) {
    console.error(`❌ 테넌트를 찾을 수 없습니다: ${subdomain}`);
    process.exit(1);
  }

  // 업로드 엔드포인트가 인식하고 이 테넌트에 실제 존재하는 역할 라벨만 (admin 제외 — 관리자는 이미 존재)
  const roleLabels = tenant.roles
    .map((r) => ROLE_LABEL_BY_CODE[r.code])
    .filter((label): label is string => Boolean(label) && label !== '관리자');

  const departments = tenant.committees.flatMap((c) => c.departments.map((d) => ({ committee: c.name, name: d.name })));

  const workbook = new ExcelJS.Workbook();

  // ── 시트 1: 사용자목록 (실제 업로드 대상) ──
  const ws = workbook.addWorksheet('사용자목록');
  ws.columns = [
    { header: 'userid (아이디)', key: 'userid', width: 22 },
    { header: 'username (이름)', key: 'username', width: 16 },
    { header: 'role (역할)', key: 'role', width: 14 },
    { header: 'department (부서)', key: 'department', width: 18 },
    { header: 'isActive (활성화)', key: 'isActive', width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };

  // 재무팀 기준 회사 레벨 결재자 슬롯 먼저 배치 (재정팀장/회계)
  const financeDept = departments.find((d) => d.name === '재무팀')?.name || departments[0]?.name || '';
  const leadRows: Array<{ role: string; department: string }> = [];
  if (roleLabels.includes('재정팀장')) leadRows.push({ role: '재정팀장', department: financeDept });
  if (roleLabels.includes('회계')) leadRows.push({ role: '회계', department: financeDept });

  for (const r of leadRows) {
    ws.addRow({ userid: '', username: '', role: r.role, department: r.department, isActive: 'Y' });
  }

  // 각 부서: 팀장 1행 + 사용자 2행 미리 채움 (이름/아이디만 채우면 됨)
  for (const d of departments) {
    if (roleLabels.includes('팀장')) {
      ws.addRow({ userid: '', username: '', role: '팀장', department: d.name, isActive: 'Y' });
    }
    for (let i = 0; i < 2; i++) {
      ws.addRow({ userid: '', username: '', role: '사용자', department: d.name, isActive: 'Y' });
    }
  }

  const lastRow = ws.rowCount;

  // ── 부서 목록을 담을 숨김 시트 (부서 드롭다운 참조용) ──
  const wsList = workbook.addWorksheet('_lists');
  departments.forEach((d, i) => {
    wsList.getCell(`A${i + 1}`).value = d.name;
  });
  wsList.state = 'veryHidden';

  // ── 데이터 유효성 검사(드롭다운) 적용: 데이터 행(2 ~ lastRow) ──
  const roleListFormula = `"${roleLabels.join(',')}"`;
  for (let r = 2; r <= lastRow; r++) {
    // role
    ws.getCell(`C${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [roleListFormula],
      showErrorMessage: true, errorTitle: '역할 오류', error: `허용 역할: ${roleLabels.join(', ')}`,
    };
    // department
    ws.getCell(`D${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`_lists!$A$1:$A$${departments.length}`],
    };
    // isActive
    ws.getCell(`E${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: ['"Y,N"'],
    };
  }

  // ── 시트 2: 작성안내 ──
  const guide = workbook.addWorksheet('작성안내');
  guide.columns = [
    { header: '항목', key: 'item', width: 22 },
    { header: '설명', key: 'desc', width: 60 },
  ];
  guide.getRow(1).font = { bold: true };
  const rows: Array<[string, string]> = [
    [`대상 조직`, `${tenant.name} (${subdomain})`],
    ['업로드 방법', '관리자 로그인 → 사용자 관리 화면에서 이 엑셀을 업로드 (POST /api/users/upload)'],
    ['', ''],
    ['userid (아이디)', '로그인 아이디. 필수, 조직 내 중복 불가. 예: cy.kildong 또는 청연홍길동'],
    ['username (이름)', '표시 이름. 필수. 예: 홍길동'],
    ['role (역할)', `역할. 허용값: ${roleLabels.join(' / ')}  (미입력 시 "사용자")`],
    ['department (부서)', '소속 부서. 선택. 아래 부서 목록 중 선택(드롭다운)'],
    ['isActive (활성화)', 'Y 또는 N. 기본 Y'],
    ['', ''],
    ['기본 비밀번호', '신규 사용자는 기본 비밀번호 "chc2026" 으로 생성됩니다. 첫 로그인 후 변경 안내 필요'],
    ['업로드 모드', 'merge(기본): 기존 아이디는 정보 업데이트 / append: 기존 아이디는 건너뜀'],
    ['관리자 계정', 'chungyeon-admin(관리자)은 이미 생성되어 있으므로 이 파일에 넣지 마세요'],
    ['빈 행', '이름/아이디를 채우지 않은 미리 채워진 행은 업로드 시 무시됩니다(빈 행 스킵)'],
    ['', ''],
    ['[부서 목록]', departments.map((d) => `${d.committee} > ${d.name}`).join('  |  ')],
  ];
  rows.forEach((r) => guide.addRow({ item: r[0], desc: r[1] }));

  // ── 저장 ──
  const outPath = path.resolve(process.cwd(), 'templates', `${subdomain}-users-template.xlsx`);
  await workbook.xlsx.writeFile(outPath);

  console.log('✅ 템플릿 생성 완료');
  console.log(`   파일: templates/${subdomain}-users-template.xlsx`);
  console.log(`   역할 옵션: ${roleLabels.join(', ')}`);
  console.log(`   부서: ${departments.length}개, 미리 채운 데이터 행: ${lastRow - 1}개`);
}

main()
  .catch((e) => { console.error('오류:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
