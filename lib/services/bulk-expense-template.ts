/**
 * 지출결의서 일괄 업로드 템플릿 (CLI/API 공유)
 *
 * 워크북을 빌드해서 Buffer로 반환. 파일 저장은 호출자 책임.
 */

import ExcelJS from 'exceljs';

const HEADERS = [
  'groupId',
  'category',
  'subcategory',
  'detail',
  'description',
  'unitPrice',
  'quantity',
  'requestDate',
  'expenseDate',
  'applicantName',
  'applicantTitle',
  'bankName',
  'accountNumber',
  'accountHolder',
] as const;

const HEADER_DESCRIPTIONS: Record<(typeof HEADERS)[number], string> = {
  groupId: '그룹ID (같은 ID는 하나의 지출결의서)',
  category: '예산(항)',
  subcategory: '예산(목)',
  detail: '예산(세목)',
  description: '적요',
  unitPrice: '단가',
  quantity: '수량',
  requestDate: '청구일자 (YYYY-MM-DD)',
  expenseDate: '지급일자 (YYYY-MM-DD, 선택)',
  applicantName: '청구인 (정확한 username 일치 필요)',
  applicantTitle: '직책 (선택)',
  bankName: '은행명',
  accountNumber: '계좌번호',
  accountHolder: '예금주',
};

const OPTIONAL_FIELDS = new Set(['groupId', 'expenseDate', 'applicantTitle']);

const SAMPLE_ROWS = [
  {
    groupId: 1,
    category: '사역지원비',
    subcategory: '기획비',
    detail: '아웃팅비',
    description: '기획팀 회의 후 식사',
    unitPrice: 10000,
    quantity: 5,
    requestDate: '2026-05-01',
    expenseDate: '2026-05-05',
    applicantName: '홍길동',
    applicantTitle: '팀장',
    bankName: '우리은행',
    accountNumber: '1002-123-456789',
    accountHolder: '홍길동',
  },
  {
    groupId: 1,
    category: '사역지원비',
    subcategory: '기획비',
    detail: '행사비(전교인행사)',
    description: '기획팀 회의 다과',
    unitPrice: 5000,
    quantity: 10,
    requestDate: '2026-05-01',
    expenseDate: '2026-05-05',
    applicantName: '홍길동',
    applicantTitle: '팀장',
    bankName: '우리은행',
    accountNumber: '1002-123-456789',
    accountHolder: '홍길동',
  },
  {
    groupId: 2,
    category: '예배사역비',
    subcategory: '찬양팀운영비',
    detail: '소모품비',
    description: '마이크 커버 구매',
    unitPrice: 3000,
    quantity: 20,
    requestDate: '2026-05-02',
    expenseDate: '',
    applicantName: '김찬양',
    applicantTitle: '',
    bankName: '국민은행',
    accountNumber: '123-45-6789012',
    accountHolder: '김찬양',
  },
];

const COLUMN_WIDTHS: Record<(typeof HEADERS)[number], number> = {
  groupId: 10,
  category: 15,
  subcategory: 18,
  detail: 20,
  description: 30,
  unitPrice: 10,
  quantity: 8,
  requestDate: 12,
  expenseDate: 12,
  applicantName: 12,
  applicantTitle: 10,
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
