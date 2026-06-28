/**
 * 일괄 업로드 진단 결과 Excel 출력
 *
 * 사용자가 업로드 미리보기에서 받은 14건 오류를 3개 시트로 정리한다:
 *  1. 진단 리포트 — 사람이 읽는 요약
 *  2. 자동 교정 시트 — 원본 엑셀의 해당 셀을 그대로 덮어쓸 값
 *  3. 수동 처리 필요 — DB 매핑 추가가 필요한 행
 *
 * 데이터는 진단 스크립트(scripts/check-budget-upload-errors.ts) 결과 +
 * 사용자가 보고한 미리보기 결과를 코드 내 상수로 들고 있음 — 일회성 산출물.
 *
 * 실행: npx tsx scripts/export-bulk-upload-diagnostic.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import ExcelJS from 'exceljs';

type Shift = {
  row: number;
  groupId: string;
  inputCategory: string;
  inputSubcategory: string;
  inputDetail: string;
};

type Rename = {
  row: number;
  groupId: string;
  inputCommittee: string;
  inputDepartment: string;
  inputCategory: string;
  inputSubcategory: string;
  inputDetail: string;
  newCommittee: string;
  newDepartment: string;
  note: string;
};

// 행 2, 4–13: 예산 계층 시프트 (사역지원비 → 한 칸 위로)
const shifts: Shift[] = [
  { row: 2,  groupId: '1',            inputCategory: '사역지원비', inputSubcategory: '교역자사례비', inputDetail: '담임목사생활비' },
  { row: 4,  groupId: '2',            inputCategory: '사역지원비', inputSubcategory: '교역자사례비', inputDetail: '준전임사역자생활비' },
  { row: 5,  groupId: '__single_3',   inputCategory: '사역지원비', inputSubcategory: '교역자사례비', inputDetail: '준전임사역자생활비' },
  { row: 6,  groupId: '__single_4',   inputCategory: '사역지원비', inputSubcategory: '교역자사례비', inputDetail: '파트사역자생활비' },
  { row: 7,  groupId: '__single_5',   inputCategory: '사역지원비', inputSubcategory: '사무사역비',   inputDetail: '사무간사급여' },
  { row: 8,  groupId: '__single_6',   inputCategory: '사역지원비', inputSubcategory: '교역자사례비', inputDetail: '교역자식대' },
  { row: 9,  groupId: '__single_7',   inputCategory: '사역지원비', inputSubcategory: '교역자사례비', inputDetail: '교역자식대' },
  { row: 10, groupId: '__single_8',   inputCategory: '사역지원비', inputSubcategory: '교역자사례비', inputDetail: '교역자식대' },
  { row: 11, groupId: '__single_9',   inputCategory: '사역지원비', inputSubcategory: '교역자사례비', inputDetail: '교역자식대' },
  { row: 12, groupId: '__single_10',  inputCategory: '사역지원비', inputSubcategory: '교역자사례비', inputDetail: '교역자식대' },
  { row: 13, groupId: '__single_11',  inputCategory: '사역지원비', inputSubcategory: '사무사역비',   inputDetail: '사무간사식대' },
];

// 행 14, 17: 위원회 명칭 불일치
const renames: Rename[] = [
  {
    row: 14, groupId: '__single_12',
    inputCommittee: '행정위원회', inputDepartment: '재정팀',
    inputCategory: '목회활동비', inputSubcategory: '목회_통신비', inputDetail: '목회_통신비',
    newCommittee: '(가칭)행정위', newDepartment: '행정비',
    note: 'committee+department 둘 다 변경 (재정팀에는 이 세목 매핑 없음)',
  },
  {
    row: 17, groupId: '__single_15',
    inputCommittee: '행정위원회', inputDepartment: '행정비',
    inputCategory: '건물및시설유지관리비', inputSubcategory: '공간임차료', inputDetail: '공간임차료',
    newCommittee: '(가칭)행정위', newDepartment: '행정비',
    note: 'committee 명칭만 변경',
  },
];

// 행 16: 수동 처리 필요
const manualRow = {
  row: 16,
  groupId: '__single_14',
  inputCommittee: '기획위원회',
  inputDepartment: '재정팀',
  inputCategory: '교역자사례비',
  inputSubcategory: '사택관리비',
  inputDetail: '전세자금대출이자',
  problem: '해당 세목이 (가칭)인사위 / 인사위 에만 활성 매핑됨. 기획위원회/재정팀에는 매핑 없음.',
  optionA: '엑셀에서 committee=(가칭)인사위, department=인사위 로 변경 후 재업로드',
  optionB: '관리자가 DB에서 기획위원회/재정팀에 해당 세목 매핑 추가 (DepartmentBudgetDetail)',
};

function buildShiftedTriplet(s: Shift): { newCategory: string; newSubcategory: string; newDetail: string } {
  // 사역지원비 삭제, 한 칸씩 왼쪽: 항=구목, 목=구세목, 세목=구세목
  return {
    newCategory: s.inputSubcategory,
    newSubcategory: s.inputDetail,
    newDetail: s.inputDetail,
  };
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  row.alignment = { vertical: 'middle' };
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'expense-system diagnostic';
  workbook.created = new Date();

  // ============================================================
  // 시트 1: 진단 리포트
  // ============================================================
  const reportSheet = workbook.addWorksheet('진단 리포트');
  reportSheet.columns = [
    { header: '행번호', key: 'row', width: 8 },
    { header: '그룹ID', key: 'groupId', width: 16 },
    { header: '오류 유형', key: 'kind', width: 18 },
    { header: '입력값', key: 'input', width: 55 },
    { header: '수정안', key: 'fix', width: 55 },
    { header: '비고', key: 'note', width: 40 },
  ];
  styleHeader(reportSheet.getRow(1));

  for (const s of shifts) {
    const { newCategory, newSubcategory, newDetail } = buildShiftedTriplet(s);
    reportSheet.addRow({
      row: s.row,
      groupId: s.groupId,
      kind: '예산 계층 시프트',
      input: `${s.inputCategory} / ${s.inputSubcategory} / ${s.inputDetail}`,
      fix: `${newCategory} / ${newSubcategory} / ${newDetail}`,
      note: '항을 한 단계 위로 (사역지원비 삭제)',
    });
  }
  for (const r of renames) {
    reportSheet.addRow({
      row: r.row,
      groupId: r.groupId,
      kind: '위원회 명칭',
      input: `${r.inputCommittee} / ${r.inputDepartment}`,
      fix: `${r.newCommittee} / ${r.newDepartment}`,
      note: r.note,
    });
  }
  reportSheet.addRow({
    row: manualRow.row,
    groupId: manualRow.groupId,
    kind: '매핑 누락',
    input: `${manualRow.inputCommittee} / ${manualRow.inputDepartment} / ${manualRow.inputDetail}`,
    fix: '(시트 3 참조)',
    note: manualRow.problem,
  });
  reportSheet.eachRow((row, n) => {
    if (n === 1) return;
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  // ============================================================
  // 시트 2: 자동 교정 시트 — 원본 엑셀에 셀 단위로 덮어쓸 값
  // ============================================================
  const fixSheet = workbook.addWorksheet('자동 교정 시트');
  fixSheet.columns = [
    { header: '행번호', key: 'row', width: 8 },
    { header: 'committee', key: 'committee', width: 18 },
    { header: 'department', key: 'department', width: 16 },
    { header: 'budgetCategory', key: 'budgetCategory', width: 22 },
    { header: 'budgetSubcategory', key: 'budgetSubcategory', width: 22 },
    { header: 'budgetDetail', key: 'budgetDetail', width: 22 },
  ];
  styleHeader(fixSheet.getRow(1));

  for (const s of shifts) {
    const { newCategory, newSubcategory, newDetail } = buildShiftedTriplet(s);
    fixSheet.addRow({
      row: s.row,
      committee: '',
      department: '',
      budgetCategory: newCategory,
      budgetSubcategory: newSubcategory,
      budgetDetail: newDetail,
    });
  }
  for (const r of renames) {
    fixSheet.addRow({
      row: r.row,
      committee: r.newCommittee,
      department: r.inputDepartment === r.newDepartment ? '' : r.newDepartment,
      budgetCategory: '',
      budgetSubcategory: '',
      budgetDetail: '',
    });
  }
  fixSheet.getRow(1).commit();
  fixSheet.addRow([]);
  const legend = fixSheet.addRow(['* 빈 셀은 원본 그대로 둘 것 / 행 16은 자동 교정 불가 — 시트 3 참조']);
  legend.font = { italic: true, color: { argb: 'FF666666' } };

  // ============================================================
  // 시트 3: 수동 처리 필요
  // ============================================================
  const manualSheet = workbook.addWorksheet('수동 처리 필요');
  manualSheet.columns = [
    { header: '행번호', key: 'row', width: 8 },
    { header: '입력값 (위원회/부서/항/목/세목)', key: 'input', width: 55 },
    { header: '문제', key: 'problem', width: 50 },
    { header: '권장 조치', key: 'action', width: 80 },
  ];
  styleHeader(manualSheet.getRow(1));

  manualSheet.addRow({
    row: manualRow.row,
    input: `${manualRow.inputCommittee} / ${manualRow.inputDepartment} / ${manualRow.inputCategory} / ${manualRow.inputSubcategory} / ${manualRow.inputDetail}`,
    problem: manualRow.problem,
    action: `(A) ${manualRow.optionA}\n(B) ${manualRow.optionB}`,
  });
  manualSheet.eachRow((row, n) => {
    if (n === 1) return;
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = 60;
  });

  // ============================================================
  // 저장
  // ============================================================
  const outputDir = path.join(process.cwd(), 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, 'bulk-upload-diagnostic.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log('='.repeat(60));
  console.log('일괄 업로드 진단 리포트 생성 완료');
  console.log('='.repeat(60));
  console.log(`파일 경로: ${outputPath}`);
  console.log('');
  console.log('시트 구성:');
  console.log(`  1. 진단 리포트       — 14행 (오류 전체 요약)`);
  console.log(`  2. 자동 교정 시트   — 13행 (행 16 제외, 원본 엑셀 셀 덮어쓰기용)`);
  console.log(`  3. 수동 처리 필요   — 행 16 (DB 매핑 추가 검토 필요)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
