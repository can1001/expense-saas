/**
 * 재정보고서(표준) 엑셀 생성 유틸리티
 *
 * 업로드된 당해/전년 데이터를 바탕으로 재정보고서(표준) 형식의 xlsx 파일 생성
 */

import ExcelJS from 'exceljs';
import type { SummaryData } from './account-report-parser';

// ========================================
// 타입 정의
// ========================================

export interface ReportItem {
  id: string;
  itemName: string;
  parentItemName?: string;
  level: number;
  budgetAmount: number;
  cumulativeAmount: number;
  currentAmount: number;
  executionRate: number;
  sortOrder: number;
}

export interface ReportData {
  id: string;
  fileName: string;
  uploadedAt: string;
  summary: SummaryData;
  incomeItems: ReportItem[];
  expenseItems: ReportItem[];
}

export interface ExportOptions {
  year: number;
  quarter: number;
  currentYear: ReportData;
  previousYear: ReportData | null;
}

// ========================================
// 엑셀 생성 함수
// ========================================

/**
 * 재정보고서(표준) 엑셀 워크북 생성
 */
export function generateAccountReportWorkbook(options: ExportOptions): ExcelJS.Workbook {
  const { year, quarter, currentYear, previousYear } = options;

  const workbook = new ExcelJS.Workbook();

  // 수지개황 시트 생성
  createSummarySheet(workbook, currentYear, previousYear, year, quarter);

  // 수입부 시트 생성
  createDetailSheet(
    workbook,
    '수입부',
    currentYear.incomeItems,
    previousYear?.incomeItems || null,
    '수입',
    currentYear.summary,
    previousYear?.summary || null
  );

  // 지출부 시트 생성
  createDetailSheet(
    workbook,
    '지출부',
    currentYear.expenseItems,
    previousYear?.expenseItems || null,
    '지출',
    currentYear.summary,
    previousYear?.summary || null
  );

  return workbook;
}

/**
 * 수지개황 시트 생성
 */
function createSummarySheet(
  workbook: ExcelJS.Workbook,
  currentYear: ReportData,
  previousYear: ReportData | null,
  year: number,
  quarter: number
): void {
  const worksheet = workbook.addWorksheet('수지개황');

  // 컬럼 너비 설정
  worksheet.columns = [
    { width: 20 }, // 구분
    { width: 18 }, // 전기이월
    { width: 18 }, // 수입총계
    { width: 18 }, // 지출총계
    { width: 18 }, // 차기이월
  ];

  // 제목
  worksheet.addRow([`${year}년 ${quarter}분기 수지개황`]);
  worksheet.mergeCells(1, 1, 1, 5);
  worksheet.addRow([]);
  worksheet.addRow(['(단위: 원)']);

  // 헤더
  worksheet.addRow(['구 분', '전기이월', '수입총계', '지출총계', '차기이월']);

  // 당기누계
  const current = currentYear.summary.current;
  worksheet.addRow([
    '당기누계',
    current.previousCarryover,
    current.totalIncome,
    current.totalExpense,
    current.nextCarryover,
  ]);

  // 전년(동분기)누계
  if (previousYear) {
    const previous = previousYear.summary.cumulative;
    worksheet.addRow([
      '전년(동분기)누계',
      previous.previousCarryover,
      previous.totalIncome,
      previous.totalExpense,
      previous.nextCarryover,
    ]);

    // 전년대비증감
    worksheet.addRow([
      '전년대비증감',
      current.previousCarryover - previous.previousCarryover,
      current.totalIncome - previous.totalIncome,
      current.totalExpense - previous.totalExpense,
      current.nextCarryover - previous.nextCarryover,
    ]);
  }
}

/**
 * 수입부/지출부 상세 시트 생성
 */
function createDetailSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  currentItems: ReportItem[],
  previousItems: ReportItem[] | null,
  type: '수입' | '지출',
  currentSummary: SummaryData,
  previousSummary: SummaryData | null
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  const hasPrevious = previousItems && previousItems.length > 0;

  // 컬럼 너비 설정
  const cols = [
    { width: 30 }, // 항목
    { width: 15 }, // 예산액
    { width: 15 }, // 당기
    { width: 15 }, // 누계
    { width: 10 }, // 진척률
  ];
  if (hasPrevious) {
    cols.push({ width: 18 }, { width: 18 }); // 전년누계, 증감액
  }
  worksheet.columns = cols;

  // 제목
  worksheet.addRow([`${type}부`]);
  const mergeColCount = hasPrevious ? 7 : 5;
  worksheet.mergeCells(1, 1, 1, mergeColCount);
  worksheet.addRow([]);
  worksheet.addRow(['(단위: 원)']);

  // 헤더
  const headers = ['항목', '예산액', '당기', '누계', '진척률'];
  if (hasPrevious) {
    headers.push('전년(동분기)누계', '전년대비 증감액');
  }
  worksheet.addRow(headers);

  // 전년도 항목 맵 생성
  const previousMap = new Map<string, ReportItem>();
  if (previousItems) {
    previousItems.forEach((item) => previousMap.set(item.itemName, item));
  }

  // 대분류 항목 (level === 1)
  const level1Items = currentItems.filter((item) => item.level === 1);

  for (const item of level1Items) {
    const prevItem = previousMap.get(item.itemName);
    const progressRate = item.budgetAmount > 0 ? ((item.cumulativeAmount / item.budgetAmount) * 100).toFixed(1) : '0.0';

    const row: (string | number)[] = [
      `○ ${item.itemName}`,
      item.budgetAmount,
      item.currentAmount,
      item.cumulativeAmount,
      `${progressRate}%`,
    ];

    if (hasPrevious) {
      const prevCumulative = prevItem?.cumulativeAmount || 0;
      const diff = item.cumulativeAmount - prevCumulative;
      row.push(prevCumulative, diff);
    }

    worksheet.addRow(row);

    // 소분류 항목 (level === 2)
    const childItems = currentItems.filter(
      (child) => child.level === 2 && child.parentItemName === item.itemName
    );

    for (const child of childItems) {
      const prevChild = previousMap.get(child.itemName);
      const childProgressRate =
        child.budgetAmount > 0 ? ((child.cumulativeAmount / child.budgetAmount) * 100).toFixed(1) : '0.0';

      const childRow: (string | number)[] = [
        `    ${child.itemName}`,
        child.budgetAmount,
        child.currentAmount,
        child.cumulativeAmount,
        `${childProgressRate}%`,
      ];

      if (hasPrevious) {
        const prevChildCumulative = prevChild?.cumulativeAmount || 0;
        const childDiff = child.cumulativeAmount - prevChildCumulative;
        childRow.push(prevChildCumulative, childDiff);
      }

      worksheet.addRow(childRow);
    }
  }

  // 합계 행
  const totalBudget = level1Items.reduce((sum, item) => sum + item.budgetAmount, 0);
  const totalCurrent =
    type === '수입' ? currentSummary.current.totalIncome : currentSummary.current.totalExpense;
  const totalCumulative =
    type === '수입' ? currentSummary.cumulative.totalIncome : currentSummary.cumulative.totalExpense;
  const totalProgressRate = totalBudget > 0 ? ((totalCumulative / totalBudget) * 100).toFixed(1) : '0.0';

  const totalRow: (string | number)[] = ['합계', totalBudget, totalCurrent, totalCumulative, `${totalProgressRate}%`];

  if (hasPrevious && previousSummary) {
    const prevTotal =
      type === '수입' ? previousSummary.cumulative.totalIncome : previousSummary.cumulative.totalExpense;
    const totalDiff = totalCumulative - prevTotal;
    totalRow.push(prevTotal, totalDiff);
  }

  worksheet.addRow([]);
  worksheet.addRow(totalRow);
}

/**
 * 엑셀 파일을 Buffer로 생성
 */
export async function generateAccountReportBuffer(options: ExportOptions): Promise<Buffer> {
  const workbook = generateAccountReportWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * 파일명 생성
 */
export function generateAccountReportFilename(year: number, quarter: number): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `재정보고서_${year}년_${quarter}분기_${dateStr}.xlsx`;
}
