/**
 * 지출결의서 엑셀 내보내기 유틸리티
 *
 * 웹 교적 시스템 "지출재정" 탭 형식에 맞춰 엑셀 파일 생성
 */

import ExcelJS from 'exceljs';

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

// 지출결의서 항목 인터페이스 (항/목/세목 포함)
export interface ExpenseItemForExcel {
  budgetCategory: string;    // 예산(항)
  budgetSubcategory: string; // 예산(목)
  budgetDetail: string;      // 예산(세목)
  description: string;
  amount: number;
}

// 지출결의서 인터페이스
export interface ExpenseForExcel {
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
      항: item.budgetCategory || '',
      목: item.budgetSubcategory || '',
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
): ExcelJS.Workbook {
  const rows = expensesToExcelRows(expenses, overrideDate);

  // 워크북 생성
  const workbook = new ExcelJS.Workbook();

  // "지출재정" 시트 추가
  const worksheet = workbook.addWorksheet('지출재정');

  // 컬럼 정의
  worksheet.columns = [
    { header: '항', key: '항', width: 20 },
    { header: '목', key: '목', width: 20 },
    { header: '세목', key: '세목', width: 20 },
    { header: '세세목', key: '세세목', width: 10 },
    { header: '지급방법', key: '지급방법', width: 10 },
    { header: '예금주', key: '예금주', width: 12 },
    { header: '은행', key: '은행', width: 12 },
    { header: '계좌번호', key: '계좌번호', width: 18 },
    { header: '금액', key: '금액', width: 15 },
    { header: '날짜', key: '날짜', width: 12 },
    { header: '메모', key: '메모', width: 40 },
  ];

  // 데이터 행 추가
  for (const row of rows) {
    worksheet.addRow(row);
  }

  return workbook;
}

/**
 * 엑셀 파일을 Buffer로 생성
 * @param expenses 지출결의서 목록
 * @param overrideDate 사용자 지정 날짜 (있으면 모든 항목에 적용)
 */
export async function generateExcelBuffer(
  expenses: ExpenseForExcel[],
  overrideDate?: Date
): Promise<Buffer> {
  const workbook = generateExcelWorkbook(expenses, overrideDate);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
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

// ============================================
// 우리은행 대량이체 양식
// ============================================

// 우리은행 대량이체 인터페이스 (지출결의서 단위)
export interface WooriBankTransferRow {
  입금은행: string;
  입금계좌번호: string;
  이체금액: number;
  받는분통장표시: string;
  보내는분통장표시: string;
  CMS번호: string;
}

// 지출결의서 전체 금액 인터페이스
export interface ExpenseForWooriBank {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  requestAmount: number;
}

/**
 * 지출결의서를 우리은행 대량이체 행으로 변환
 */
export function expenseToWooriBankRow(expense: ExpenseForWooriBank): WooriBankTransferRow {
  return {
    입금은행: expense.bankName,
    입금계좌번호: expense.accountNumber.replace(/-/g, ''), // 하이픈 제거
    이체금액: expense.requestAmount,
    받는분통장표시: expense.accountHolder,
    보내는분통장표시: '청연교회',
    CMS번호: '',
  };
}

/**
 * 여러 지출결의서를 우리은행 대량이체 행 배열로 변환
 */
export function expensesToWooriBankRows(expenses: ExpenseForWooriBank[]): WooriBankTransferRow[] {
  return expenses.map(expenseToWooriBankRow);
}

/**
 * 우리은행 대량이체 엑셀 워크북 생성
 */
export function generateWooriBankWorkbook(expenses: ExpenseForWooriBank[]): ExcelJS.Workbook {
  const rows = expensesToWooriBankRows(expenses);

  // 워크북 생성
  const workbook = new ExcelJS.Workbook();

  // 시트 추가 (헤더 없이)
  const worksheet = workbook.addWorksheet('Sheet1');

  // 컬럼 너비 설정 (헤더 없이)
  worksheet.columns = [
    { key: 'col1', width: 12 },  // 입금은행
    { key: 'col2', width: 18 },  // 입금계좌번호
    { key: 'col3', width: 12 },  // 이체금액
    { key: 'col4', width: 12 },  // 받는분통장표시
    { key: 'col5', width: 12 },  // 보내는분통장표시
    { key: 'col6', width: 12 },  // CMS번호
  ];

  // 데이터 행 추가 (헤더 없이)
  for (const row of rows) {
    worksheet.addRow([
      row.입금은행,
      row.입금계좌번호,
      row.이체금액,
      row.받는분통장표시,
      row.보내는분통장표시,
      row.CMS번호,
    ]);
  }

  return workbook;
}

/**
 * 우리은행 대량이체 엑셀 파일을 Buffer로 생성
 */
export async function generateWooriBankBuffer(expenses: ExpenseForWooriBank[]): Promise<Buffer> {
  const workbook = generateWooriBankWorkbook(expenses);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * 우리은행 대량이체 파일명 생성
 */
export function generateWooriBankFilename(): string {
  const now = new Date();
  const dateStr = formatDateForExcel(now);
  return `우리은행_대량이체_${dateStr}.xlsx`;
}
