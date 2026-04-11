/**
 * 재정보고서(표준) 엑셀 생성 유틸리티
 *
 * 업로드된 당해/전년 데이터를 바탕으로 재정보고서(표준) 형식의 xlsx 파일 생성
 */

import * as XLSX from 'xlsx';
import type { SummaryData, ParsedReportItem } from './account-report-parser';

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
export function generateAccountReportWorkbook(options: ExportOptions): XLSX.WorkBook {
  const { year, quarter, currentYear, previousYear } = options;

  const workbook = XLSX.utils.book_new();

  // 수지개황 시트 생성
  const summarySheet = createSummarySheet(currentYear, previousYear, year, quarter);
  XLSX.utils.book_append_sheet(workbook, summarySheet, '수지개황');

  // 수입부 시트 생성
  const incomeSheet = createDetailSheet(
    currentYear.incomeItems,
    previousYear?.incomeItems || null,
    '수입',
    currentYear.summary,
    previousYear?.summary || null
  );
  XLSX.utils.book_append_sheet(workbook, incomeSheet, '수입부');

  // 지출부 시트 생성
  const expenseSheet = createDetailSheet(
    currentYear.expenseItems,
    previousYear?.expenseItems || null,
    '지출',
    currentYear.summary,
    previousYear?.summary || null
  );
  XLSX.utils.book_append_sheet(workbook, expenseSheet, '지출부');

  return workbook;
}

/**
 * 수지개황 시트 생성
 */
function createSummarySheet(
  currentYear: ReportData,
  previousYear: ReportData | null,
  year: number,
  quarter: number
): XLSX.WorkSheet {
  const data: (string | number)[][] = [];

  // 제목
  data.push([`${year}년 ${quarter}분기 수지개황`]);
  data.push([]);
  data.push(['(단위: 원)']);

  // 헤더
  data.push(['구 분', '전기이월', '수입총계', '지출총계', '차기이월']);

  // 당기누계
  const current = currentYear.summary.current;
  data.push([
    '당기누계',
    current.previousCarryover,
    current.totalIncome,
    current.totalExpense,
    current.nextCarryover,
  ]);

  // 전년(동분기)누계
  if (previousYear) {
    const previous = previousYear.summary.cumulative;
    data.push([
      '전년(동분기)누계',
      previous.previousCarryover,
      previous.totalIncome,
      previous.totalExpense,
      previous.nextCarryover,
    ]);

    // 전년대비증감
    data.push([
      '전년대비증감',
      current.previousCarryover - previous.previousCarryover,
      current.totalIncome - previous.totalIncome,
      current.totalExpense - previous.totalExpense,
      current.nextCarryover - previous.nextCarryover,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 컬럼 너비 설정
  ws['!cols'] = [
    { wch: 20 }, // 구분
    { wch: 18 }, // 전기이월
    { wch: 18 }, // 수입총계
    { wch: 18 }, // 지출총계
    { wch: 18 }, // 차기이월
  ];

  // 셀 병합 (제목)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

  return ws;
}

/**
 * 수입부/지출부 상세 시트 생성
 */
function createDetailSheet(
  currentItems: ReportItem[],
  previousItems: ReportItem[] | null,
  type: '수입' | '지출',
  currentSummary: SummaryData,
  previousSummary: SummaryData | null
): XLSX.WorkSheet {
  const data: (string | number)[][] = [];
  const hasPrevious = previousItems && previousItems.length > 0;

  // 제목
  data.push([`${type}부`]);
  data.push([]);
  data.push(['(단위: 원)']);

  // 헤더
  const headers = ['항목', '예산액', '당기', '누계', '진척률'];
  if (hasPrevious) {
    headers.push('전년(동분기)누계', '전년대비 증감액');
  }
  data.push(headers);

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

    data.push(row);

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

      data.push(childRow);
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

  data.push([]);
  data.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 컬럼 너비 설정
  const cols = [
    { wch: 30 }, // 항목
    { wch: 15 }, // 예산액
    { wch: 15 }, // 당기
    { wch: 15 }, // 누계
    { wch: 10 }, // 진척률
  ];
  if (hasPrevious) {
    cols.push({ wch: 18 }, { wch: 18 }); // 전년누계, 증감액
  }
  ws['!cols'] = cols;

  // 셀 병합 (제목)
  const mergeColCount = hasPrevious ? 6 : 4;
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: mergeColCount } }];

  return ws;
}

/**
 * 엑셀 파일을 Buffer로 생성
 */
export function generateAccountReportBuffer(options: ExportOptions): Buffer {
  const workbook = generateAccountReportWorkbook(options);
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * 파일명 생성
 */
export function generateAccountReportFilename(year: number, quarter: number): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `재정보고서_${year}년_${quarter}분기_${dateStr}.xlsx`;
}
