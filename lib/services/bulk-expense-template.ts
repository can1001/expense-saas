/**
 * 지출결의서 일괄 업로드 템플릿 (CLI/API 공유)
 *
 * 컬럼 명명은 기존 신규 작성 폼(`createExpenseSchema`)과 동일.
 * 위원회/사역팀은 입력 필수 — 시스템이 budgetDetail로 자동 도출한 값과
 * 교차 검증하여 불일치 시 행 에러로 처리.
 *
 * 청구인 정보(applicantName/applicantTitle/userId)는 엑셀에 포함되지 않으며
 * 업로드 수행자(로그인 사용자 또는 CLI의 --as 인자)가 자동으로 채워짐.
 * 은행 정보는 행마다 다른 수취인에게 송금되므로 엑셀 유지.
 */

import ExcelJS from 'exceljs';

const HEADERS = [
  'groupId',
  'committee',
  'department',
  'budgetCategory',
  'budgetSubcategory',
  'budgetDetail',
  'description',
  'unitPrice',
  'quantity',
  'requestDate',
  'expenseDate',
  'bankName',
  'accountNumber',
  'accountHolder',
] as const;

const HEADER_DESCRIPTIONS: Record<(typeof HEADERS)[number], string> = {
  groupId: '그룹ID — 같은 ID는 한 지출결의서로 묶임 (비우면 행마다 별건)',
  committee: '위원회 (예산 매핑과 교차 검증)',
  department: '사역팀(부) (예산 매핑과 교차 검증)',
  budgetCategory: '예산(항)',
  budgetSubcategory: '예산(목)',
  budgetDetail: '예산(세목)',
  description: '적요',
  unitPrice: '단가',
  quantity: '수량',
  requestDate: '청구일자 (YYYY-MM-DD)',
  expenseDate: '지급일자 (YYYY-MM-DD, 선택)',
  bankName: '은행명 (수취 계좌)',
  accountNumber: '계좌번호 (수취 계좌)',
  accountHolder: '예금주 (수취 계좌)',
};

const OPTIONAL_FIELDS = new Set(['groupId', 'expenseDate']);

const SAMPLE_ROWS = [
  {
    groupId: 1,
    committee: '교육위원회',
    department: '기획팀',
    budgetCategory: '사역지원비',
    budgetSubcategory: '기획비',
    budgetDetail: '아웃팅비',
    description: '기획팀 회의 후 식사',
    unitPrice: 10000,
    quantity: 5,
    requestDate: '2026-05-01',
    expenseDate: '2026-05-05',
    bankName: '우리은행',
    accountNumber: '1002-123-456789',
    accountHolder: '홍길동',
  },
  {
    groupId: 1,
    committee: '교육위원회',
    department: '기획팀',
    budgetCategory: '사역지원비',
    budgetSubcategory: '기획비',
    budgetDetail: '행사비(전교인행사)',
    description: '기획팀 회의 다과',
    unitPrice: 5000,
    quantity: 10,
    requestDate: '2026-05-01',
    expenseDate: '2026-05-05',
    bankName: '우리은행',
    accountNumber: '1002-123-456789',
    accountHolder: '홍길동',
  },
  {
    groupId: 2,
    committee: '예배위원회',
    department: '찬양팀',
    budgetCategory: '예배사역비',
    budgetSubcategory: '찬양팀운영비',
    budgetDetail: '소모품비',
    description: '마이크 커버 구매',
    unitPrice: 3000,
    quantity: 20,
    requestDate: '2026-05-02',
    expenseDate: '',
    bankName: '국민은행',
    accountNumber: '123-45-6789012',
    accountHolder: '김찬양',
  },
];

const COLUMN_WIDTHS: Record<(typeof HEADERS)[number], number> = {
  groupId: 10,
  committee: 14,
  department: 14,
  budgetCategory: 15,
  budgetSubcategory: 18,
  budgetDetail: 20,
  description: 30,
  unitPrice: 10,
  quantity: 8,
  requestDate: 12,
  expenseDate: 12,
  bankName: 12,
  accountNumber: 18,
  accountHolder: 12,
};

/**
 * 템플릿 워크북을 빌드해서 Buffer로 반환
 */
export async function buildExpenseTemplateWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // 데이터 시트
  const dataSheet = workbook.addWorksheet('업로드데이터');
  dataSheet.columns = HEADERS.map((h) => ({ header: h, key: h, width: COLUMN_WIDTHS[h] }));
  SAMPLE_ROWS.forEach((row) => dataSheet.addRow(row));

  // 컬럼 설명 시트
  const descSheet = workbook.addWorksheet('컬럼설명');
  descSheet.columns = [
    { header: '컬럼명', key: 'colName', width: 18 },
    { header: '설명', key: 'description', width: 45 },
    { header: '필수여부', key: 'required', width: 10 },
  ];
  HEADERS.forEach((h) => {
    descSheet.addRow({
      colName: h,
      description: HEADER_DESCRIPTIONS[h],
      required: OPTIONAL_FIELDS.has(h) ? '선택' : '필수',
    });
  });

  const ab = await workbook.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}
