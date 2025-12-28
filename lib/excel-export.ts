/**
 * 지출결의서 엑셀 내보내기 유틸리티
 *
 * 웹 교적 시스템 "지출재정" 탭 형식에 맞춰 엑셀 파일 생성
 */

import * as XLSX from 'xlsx';

// 엑셀 행 인터페이스
export interface ExcelRow {
  항: string;
  목: string;
  세목: string;
  세세목: string;
  지급방법: string;
  예금주: string;
  은행: string;
  계좌번호: string;
  금액: number;
  날짜: string;
  메모: string;
}

// 지출결의서 항목 인터페이스
export interface ExpenseItemForExcel {
  budgetDetail: string;
  description: string;
  amount: number;
}

// 지출결의서 인터페이스
export interface ExpenseForExcel {
  budgetCategory: string;
  budgetSubcategory: string;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  expenseDate: Date | null;
  requestDate: Date;
  items: ExpenseItemForExcel[];
}

/**
 * 날짜를 엑셀 형식으로 변환 (YYYY-MM-DD)
 */
export function formatDateForExcel(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 지출결의서 데이터를 엑셀 행으로 변환
 * @param expense 지출결의서 데이터
 * @param overrideDate 사용자 지정 날짜 (있으면 모든 항목에 적용)
 */
export function expenseToExcelRows(
  expense: ExpenseForExcel,
  overrideDate?: Date
): ExcelRow[] {
  const rows: ExcelRow[] = [];
  // 오버라이드 날짜가 있으면 사용, 없으면 기존 로직
  const date = overrideDate || expense.expenseDate || expense.requestDate;

  for (const item of expense.items) {
    rows.push({
      항: expense.budgetCategory,
      목: expense.budgetSubcategory,
      세목: item.budgetDetail,
      세세목: '',
      지급방법: '이체',
      예금주: expense.accountHolder,
      은행: expense.bankName,
      계좌번호: expense.accountNumber,
      금액: item.amount,
      날짜: formatDateForExcel(date),
      메모: item.description,
    });
  }

  return rows;
}

/**
 * 여러 지출결의서를 엑셀 행 배열로 변환
 * @param expenses 지출결의서 목록
 * @param overrideDate 사용자 지정 날짜 (있으면 모든 항목에 적용)
 */
export function expensesToExcelRows(
  expenses: ExpenseForExcel[],
  overrideDate?: Date
): ExcelRow[] {
  const rows: ExcelRow[] = [];

  for (const expense of expenses) {
    rows.push(...expenseToExcelRows(expense, overrideDate));
  }

  return rows;
}

/**
 * 엑셀 워크북 생성
 * @param expenses 지출결의서 목록
 * @param overrideDate 사용자 지정 날짜 (있으면 모든 항목에 적용)
 */
export function generateExcelWorkbook(
  expenses: ExpenseForExcel[],
  overrideDate?: Date
): XLSX.WorkBook {
  const rows = expensesToExcelRows(expenses, overrideDate);

  // 워크북 생성
  const workbook = XLSX.utils.book_new();

  // 데이터를 워크시트로 변환
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { wch: 20 },  // 항
    { wch: 20 },  // 목
    { wch: 20 },  // 세목
    { wch: 10 },  // 세세목
    { wch: 10 },  // 지급방법
    { wch: 12 },  // 예금주
    { wch: 12 },  // 은행
    { wch: 18 },  // 계좌번호
    { wch: 15 },  // 금액
    { wch: 12 },  // 날짜
    { wch: 40 },  // 메모
  ];

  // "지출재정" 시트로 추가
  XLSX.utils.book_append_sheet(workbook, worksheet, '지출재정');

  return workbook;
}

/**
 * 엑셀 파일을 Buffer로 생성
 * @param expenses 지출결의서 목록
 * @param overrideDate 사용자 지정 날짜 (있으면 모든 항목에 적용)
 */
export function generateExcelBuffer(
  expenses: ExpenseForExcel[],
  overrideDate?: Date
): Buffer {
  const workbook = generateExcelWorkbook(expenses, overrideDate);
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * 파일명 생성
 */
export function generateExcelFilename(
  expenses: ExpenseForExcel[],
  startDate?: Date,
  endDate?: Date
): string {
  const now = new Date();
  const dateStr = formatDateForExcel(now);

  if (expenses.length === 1) {
    // 단건인 경우
    const expense = expenses[0];
    const expenseDate = expense.expenseDate || expense.requestDate;
    const expenseDateStr = formatDateForExcel(expenseDate);
    return `지출재정_${expense.accountHolder}_${expenseDateStr}.xlsx`;
  }

  if (startDate && endDate) {
    // 기간 지정된 경우
    const start = formatDateForExcel(startDate);
    const end = formatDateForExcel(endDate);
    return `지출재정_${start}_${end}.xlsx`;
  }

  // 기본값
  return `지출재정_${dateStr}.xlsx`;
}
