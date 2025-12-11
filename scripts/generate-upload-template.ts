/**
 * 일괄 업로드용 Excel 템플릿 생성 스크립트
 *
 * 사용법:
 *   npm run generate-template
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

function generateTemplate() {
  // 헤더 정의
  const headers = [
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
  ];

  // 헤더 설명 (한글)
  const headerDescriptions = [
    '그룹ID (같은 ID는 하나의 지출결의서)',
    '예산(항)',
    '예산(목)',
    '예산(세목)',
    '적요',
    '단가',
    '수량',
    '청구일자 (YYYY-MM-DD)',
    '지출일자 (YYYY-MM-DD, 선택)',
    '청구인',
    '직책 (선택)',
    '은행명',
    '계좌번호',
    '예금주',
  ];

  // 샘플 데이터
  const sampleData = [
    {
      groupId: 1,
      category: '사역지원비',
      subcategory: '기획비',
      detail: '아웃팅비',
      description: '기획팀 회의 후 식사',
      unitPrice: 10000,
      quantity: 5,
      requestDate: '2024-12-01',
      expenseDate: '2024-12-01',
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
      requestDate: '2024-12-01',
      expenseDate: '2024-12-01',
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
      requestDate: '2024-12-02',
      expenseDate: '',
      applicantName: '김찬양',
      applicantTitle: '',
      bankName: '국민은행',
      accountNumber: '123-45-6789012',
      accountHolder: '김찬양',
    },
  ];

  // 워크북 생성
  const workbook = XLSX.utils.book_new();

  // 데이터 시트 생성
  const dataSheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });

  // 컬럼 너비 설정
  dataSheet['!cols'] = [
    { wch: 10 }, // groupId
    { wch: 15 }, // category
    { wch: 18 }, // subcategory
    { wch: 20 }, // detail
    { wch: 30 }, // description
    { wch: 10 }, // unitPrice
    { wch: 8 }, // quantity
    { wch: 12 }, // requestDate
    { wch: 12 }, // expenseDate
    { wch: 12 }, // applicantName
    { wch: 10 }, // applicantTitle
    { wch: 12 }, // bankName
    { wch: 18 }, // accountNumber
    { wch: 12 }, // accountHolder
  ];

  XLSX.utils.book_append_sheet(workbook, dataSheet, '업로드데이터');

  // 설명 시트 생성
  const descriptionData = headers.map((header, index) => ({
    컬럼명: header,
    설명: headerDescriptions[index],
    필수여부: ['groupId', 'expenseDate', 'applicantTitle'].includes(header) ? '선택' : '필수',
  }));

  const descSheet = XLSX.utils.json_to_sheet(descriptionData);
  descSheet['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, descSheet, '컬럼설명');

  // 파일 저장
  const outputDir = path.join(process.cwd(), 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'bulk-upload-template.xlsx');
  XLSX.writeFile(workbook, outputPath);

  console.log('='.repeat(60));
  console.log('일괄 업로드 템플릿 생성 완료');
  console.log('='.repeat(60));
  console.log(`파일 경로: ${outputPath}`);
  console.log('');
  console.log('사용법:');
  console.log('  1. 템플릿 파일을 열어 "업로드데이터" 시트에 데이터 입력');
  console.log('  2. groupId가 같은 행들은 하나의 지출결의서로 묶임');
  console.log('  3. npm run bulk-upload -- ./templates/bulk-upload-template.xlsx');
  console.log('');
  console.log('Dry Run (검증만):');
  console.log('  npm run bulk-upload -- ./templates/bulk-upload-template.xlsx --dry-run');
}

generateTemplate();
