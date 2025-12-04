import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface ExpenseItem {
  id: string;
  budgetDetail: string;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  order: number;
}

interface Expense {
  id: string;
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  expenseDate?: string;
  requestAmount: number;
  requestDate: string;
  requestTeam: string;
  applicantName: string;
  applicantTitle?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  items: ExpenseItem[];
  createdAt: string;
  updatedAt: string;
}

export function generateExpenseExcel(expense: Expense) {
  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 1. 지출결의서 기본 정보 시트
  const infoData = [
    ['지출결의서'],
    [],
    ['예산 정보'],
    ['위원회', expense.committee],
    ['사역팀(부)', expense.department],
    ['예산(항)', expense.budgetCategory],
    ['예산(목)', expense.budgetSubcategory],
    [],
    ['지출 정보'],
    ['지출일자', expense.expenseDate ? format(new Date(expense.expenseDate), 'yyyy-MM-dd') : '미정'],
    [],
    ['신청 정보'],
    ['청구일자', format(new Date(expense.requestDate), 'yyyy-MM-dd')],
    ['청구팀', expense.requestTeam],
    ['청구인', expense.applicantName],
    ['직책', expense.applicantTitle || ''],
    [],
    ['은행 정보'],
    ['은행명', expense.bankName],
    ['계좌번호', expense.accountNumber],
    ['예금주', expense.accountHolder],
    [],
    ['총 청구금액', expense.requestAmount.toLocaleString('ko-KR') + '원'],
  ];

  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);

  // 열 너비 설정
  wsInfo['!cols'] = [
    { wch: 15 }, // A열
    { wch: 30 }, // B열
  ];

  // 2. 세부 항목 시트
  const itemsData = [
    ['순서', '예산(세목)', '적요', '단가', '수량', '금액'],
    ...expense.items.map((item) => [
      item.order,
      item.budgetDetail,
      item.description,
      item.unitPrice,
      item.quantity,
      item.amount,
    ]),
    [],
    ['', '', '', '', '합계', expense.requestAmount],
  ];

  const wsItems = XLSX.utils.aoa_to_sheet(itemsData);

  // 열 너비 설정
  wsItems['!cols'] = [
    { wch: 8 },  // 순서
    { wch: 25 }, // 예산(세목)
    { wch: 40 }, // 적요
    { wch: 15 }, // 단가
    { wch: 8 },  // 수량
    { wch: 15 }, // 금액
  ];

  // 숫자 포맷 설정 (천 단위 콤마)
  expense.items.forEach((_, index) => {
    const rowNum = index + 2; // 헤더 다음 행부터
    ['D', 'F'].forEach((col) => {
      const cellRef = `${col}${rowNum}`;
      if (wsItems[cellRef]) {
        wsItems[cellRef].z = '#,##0';
      }
    });
  });

  // 합계 행 포맷
  const totalRowNum = expense.items.length + 3;
  if (wsItems[`F${totalRowNum}`]) {
    wsItems[`F${totalRowNum}`].z = '#,##0';
  }

  // 시트를 워크북에 추가
  XLSX.utils.book_append_sheet(wb, wsInfo, '지출결의서');
  XLSX.utils.book_append_sheet(wb, wsItems, '세부항목');

  // 파일명 생성
  const fileName = `지출결의서_${expense.applicantName}_${format(new Date(expense.requestDate), 'yyyyMMdd')}.xlsx`;

  // 엑셀 파일 생성 및 다운로드
  XLSX.writeFile(wb, fileName);
}
