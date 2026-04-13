/**
 * @jest-environment node
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  generateAccountReportWorkbook,
  generateAccountReportBuffer,
  generateAccountReportFilename,
  type ReportData,
  type ExportOptions,
} from '../account-report-excel-generator';
import type { SummaryData } from '../account-report-parser';

describe('account-report-excel-generator', () => {
  // ========================================
  // 테스트 데이터 생성
  // ========================================

  function createMockSummary(): SummaryData {
    return {
      current: {
        previousCarryover: 1000000,
        totalIncome: 5000000,
        totalExpense: 3000000,
        difference: 2000000,
        nextCarryover: 3000000,
      },
      cumulative: {
        previousCarryover: 500000,
        totalIncome: 10000000,
        totalExpense: 7000000,
        difference: 3000000,
        nextCarryover: 3500000,
      },
    };
  }

  function createMockReportData(year: number, quarter: number): ReportData {
    return {
      id: `report-${year}-${quarter}`,
      fileName: `재정보고서_${year}년_${quarter}분기.xls`,
      uploadedAt: new Date().toISOString(),
      summary: createMockSummary(),
      incomeItems: [
        {
          id: 'income-1',
          itemName: '헌금수입',
          level: 1,
          budgetAmount: 20000000,
          cumulativeAmount: 10000000,
          currentAmount: 5000000,
          executionRate: 50,
          sortOrder: 1,
        },
        {
          id: 'income-2',
          itemName: '십일조',
          parentItemName: '헌금수입',
          level: 2,
          budgetAmount: 15000000,
          cumulativeAmount: 8000000,
          currentAmount: 4000000,
          executionRate: 53.33,
          sortOrder: 2,
        },
        {
          id: 'income-3',
          itemName: '감사헌금',
          parentItemName: '헌금수입',
          level: 2,
          budgetAmount: 5000000,
          cumulativeAmount: 2000000,
          currentAmount: 1000000,
          executionRate: 40,
          sortOrder: 3,
        },
        {
          id: 'income-4',
          itemName: '기타수입',
          level: 1,
          budgetAmount: 2000000,
          cumulativeAmount: 2000000,
          currentAmount: 1000000,
          executionRate: 100,
          sortOrder: 4,
        },
      ],
      expenseItems: [
        {
          id: 'expense-1',
          itemName: '인건비',
          level: 1,
          budgetAmount: 10000000,
          cumulativeAmount: 7000000,
          currentAmount: 3000000,
          executionRate: 70,
          sortOrder: 1,
        },
        {
          id: 'expense-2',
          itemName: '급여',
          parentItemName: '인건비',
          level: 2,
          budgetAmount: 8000000,
          cumulativeAmount: 6000000,
          currentAmount: 2500000,
          executionRate: 75,
          sortOrder: 2,
        },
        {
          id: 'expense-3',
          itemName: '운영비',
          level: 1,
          budgetAmount: 5000000,
          cumulativeAmount: 2000000,
          currentAmount: 500000,
          executionRate: 40,
          sortOrder: 3,
        },
      ],
    };
  }

  function createPreviousYearReportData(): ReportData {
    return {
      id: 'report-2023-2',
      fileName: '재정보고서_2023년_2분기.xls',
      uploadedAt: new Date().toISOString(),
      summary: {
        current: {
          previousCarryover: 800000,
          totalIncome: 4000000,
          totalExpense: 2500000,
          difference: 1500000,
          nextCarryover: 2300000,
        },
        cumulative: {
          previousCarryover: 400000,
          totalIncome: 8000000,
          totalExpense: 6000000,
          difference: 2000000,
          nextCarryover: 2400000,
        },
      },
      incomeItems: [
        {
          id: 'prev-income-1',
          itemName: '헌금수입',
          level: 1,
          budgetAmount: 18000000,
          cumulativeAmount: 8000000,
          currentAmount: 4000000,
          executionRate: 44.44,
          sortOrder: 1,
        },
        {
          id: 'prev-income-2',
          itemName: '기타수입',
          level: 1,
          budgetAmount: 1500000,
          cumulativeAmount: 1500000,
          currentAmount: 800000,
          executionRate: 100,
          sortOrder: 2,
        },
      ],
      expenseItems: [
        {
          id: 'prev-expense-1',
          itemName: '인건비',
          level: 1,
          budgetAmount: 9000000,
          cumulativeAmount: 6000000,
          currentAmount: 2500000,
          executionRate: 66.67,
          sortOrder: 1,
        },
        {
          id: 'prev-expense-2',
          itemName: '운영비',
          level: 1,
          budgetAmount: 4000000,
          cumulativeAmount: 1500000,
          currentAmount: 400000,
          executionRate: 37.5,
          sortOrder: 2,
        },
      ],
    };
  }

  // ========================================
  // generateAccountReportWorkbook 테스트
  // ========================================

  describe('generateAccountReportWorkbook', () => {
    it('should generate workbook with 3 sheets', () => {
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear: createMockReportData(2024, 2),
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);

      expect(workbook.SheetNames).toHaveLength(3);
      expect(workbook.SheetNames).toEqual(['수지개황', '수입부', '지출부']);
    });

    it('should create summary sheet with correct data', () => {
      const currentYear = createMockReportData(2024, 2);
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수지개황'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      // 제목 확인
      expect(data[0][0]).toBe('2024년 2분기 수지개황');

      // 헤더 확인
      expect(data[3]).toEqual(['구 분', '전기이월', '수입총계', '지출총계', '차기이월']);

      // 당기누계 데이터 확인
      expect(data[4]).toEqual(['당기누계', 1000000, 5000000, 3000000, 3000000]);
    });

    it('should include previous year data when provided', () => {
      const currentYear = createMockReportData(2024, 2);
      const previousYear = createPreviousYearReportData();
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수지개황'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      // 전년(동분기)누계 행 확인
      expect(data[5][0]).toBe('전년(동분기)누계');
      expect(data[5][1]).toBe(400000); // previousYear.summary.cumulative.previousCarryover

      // 전년대비증감 행 확인
      expect(data[6][0]).toBe('전년대비증감');
      expect(data[6][1]).toBe(1000000 - 400000); // 전기이월 차이: 600000
      expect(data[6][2]).toBe(5000000 - 8000000); // 수입총계 증감: -3000000 (감소)
    });

    it('should create income detail sheet with hierarchy', () => {
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear: createMockReportData(2024, 2),
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수입부'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      // 제목
      expect(data[0][0]).toBe('수입부');

      // 헤더
      expect(data[3]).toEqual(['항목', '예산액', '당기', '누계', '진척률']);

      // 대분류 항목 (○ 접두사)
      expect(data[4][0]).toBe('○ 헌금수입');
      expect(data[4][1]).toBe(20000000); // 예산액
      expect(data[4][2]).toBe(5000000); // 당기
      expect(data[4][3]).toBe(10000000); // 누계
      expect(data[4][4]).toBe('50.0%'); // 진척률

      // 소분류 항목 (들여쓰기)
      expect(data[5][0]).toBe('    십일조');
      expect(data[5][1]).toBe(15000000);

      expect(data[6][0]).toBe('    감사헌금');
      expect(data[6][1]).toBe(5000000);

      // 두 번째 대분류
      expect(data[7][0]).toBe('○ 기타수입');
      expect(data[7][4]).toBe('100.0%');
    });

    it('should create expense detail sheet with hierarchy', () => {
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear: createMockReportData(2024, 2),
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['지출부'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      // 대분류
      expect(data[4][0]).toBe('○ 인건비');
      expect(data[4][1]).toBe(10000000);
      expect(data[4][4]).toBe('70.0%');

      // 소분류
      expect(data[5][0]).toBe('    급여');
      expect(data[5][1]).toBe(8000000);

      // 두 번째 대분류
      expect(data[6][0]).toBe('○ 운영비');
    });

    it('should include totals row in detail sheets', () => {
      const currentYear = createMockReportData(2024, 2);
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const incomeSheet = workbook.Sheets['수입부'];
      const incomeData = XLSX.utils.sheet_to_json<any>(incomeSheet, { header: 1 });

      // 합계 행 찾기 (마지막 행)
      const totalRow = incomeData[incomeData.length - 1];
      expect(totalRow[0]).toBe('합계');
      expect(totalRow[1]).toBe(22000000); // 20M + 2M (level 1 항목만)
      expect(totalRow[2]).toBe(5000000); // currentYear.summary.current.totalIncome
      expect(totalRow[3]).toBe(10000000); // currentYear.summary.cumulative.totalIncome
    });

    it('should add previous year columns when previous data exists', () => {
      const currentYear = createMockReportData(2024, 2);
      const previousYear = createPreviousYearReportData();
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수입부'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      // 헤더에 전년 컬럼 포함
      expect(data[3]).toEqual([
        '항목',
        '예산액',
        '당기',
        '누계',
        '진척률',
        '전년(동분기)누계',
        '전년대비 증감액',
      ]);

      // 헌금수입 행 - 전년 데이터 및 증감액
      expect(data[4][5]).toBe(8000000); // 전년 헌금수입 누계
      expect(data[4][6]).toBe(10000000 - 8000000); // 증감액

      // 기타수입 행
      expect(data[7][5]).toBe(1500000); // 전년 기타수입 누계
      expect(data[7][6]).toBe(2000000 - 1500000);
    });

    it('should handle missing previous year items gracefully', () => {
      const currentYear = createMockReportData(2024, 2);
      const previousYear = createPreviousYearReportData();
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수입부'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      // 십일조는 전년 데이터 없음
      const 십일조Row = data[5];
      expect(십일조Row[0]).toBe('    십일조');
      expect(십일조Row[5]).toBe(0); // 전년 누계 0
      expect(십일조Row[6]).toBe(8000000 - 0); // 증감액
    });

    it('should calculate progress rate correctly', () => {
      const currentYear = createMockReportData(2024, 2);
      currentYear.incomeItems[0].budgetAmount = 20000000;
      currentYear.incomeItems[0].cumulativeAmount = 15000000; // 75%

      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수입부'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      expect(data[4][4]).toBe('75.0%');
    });

    it('should handle zero budget gracefully', () => {
      const currentYear = createMockReportData(2024, 2);
      currentYear.incomeItems[0].budgetAmount = 0;
      currentYear.incomeItems[0].cumulativeAmount = 5000000;

      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수입부'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      // 0으로 나누지 않고 0.0% 반환
      expect(data[4][4]).toBe('0.0%');
    });

    it('should set column widths for all sheets', () => {
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear: createMockReportData(2024, 2),
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);

      // 수지개황 시트
      const summarySheet = workbook.Sheets['수지개황'];
      expect(summarySheet['!cols']).toBeDefined();
      expect(summarySheet['!cols']).toHaveLength(5);

      // 수입부 시트
      const incomeSheet = workbook.Sheets['수입부'];
      expect(incomeSheet['!cols']).toBeDefined();
      expect(incomeSheet['!cols']).toHaveLength(5);
    });

    it('should merge title cells', () => {
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear: createMockReportData(2024, 2),
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수지개황'];

      expect(sheet['!merges']).toBeDefined();
      expect(sheet['!merges']).toHaveLength(1);
      expect(sheet['!merges']![0]).toEqual({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
    });
  });

  // ========================================
  // generateAccountReportBuffer 테스트
  // ========================================

  describe('generateAccountReportBuffer', () => {
    it('should generate valid Excel buffer', () => {
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear: createMockReportData(2024, 2),
        previousYear: null,
      };

      const buffer = generateAccountReportBuffer(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Buffer를 다시 읽어서 검증
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toHaveLength(3);
    });

    it('should create readable Excel file', () => {
      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear: createMockReportData(2024, 2),
        previousYear: createPreviousYearReportData(),
      };

      const buffer = generateAccountReportBuffer(options);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets['수지개황'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      expect(data[0][0]).toBe('2024년 2분기 수지개황');
    });
  });

  // ========================================
  // generateAccountReportFilename 테스트
  // ========================================

  describe('generateAccountReportFilename', () => {
    it('should generate filename with year and quarter', () => {
      const filename = generateAccountReportFilename(2024, 2);

      expect(filename).toMatch(/^재정보고서_2024년_2분기_\d{8}\.xlsx$/);
    });

    it('should include current date in filename', () => {
      const filename = generateAccountReportFilename(2023, 4);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      expect(filename).toContain(dateStr);
    });

    it('should always use .xlsx extension', () => {
      const filename1 = generateAccountReportFilename(2024, 1);
      const filename2 = generateAccountReportFilename(2025, 3);

      expect(filename1).toMatch(/\.xlsx$/);
      expect(filename2).toMatch(/\.xlsx$/);
    });

    it('should handle different quarters', () => {
      const q1 = generateAccountReportFilename(2024, 1);
      const q2 = generateAccountReportFilename(2024, 2);
      const q3 = generateAccountReportFilename(2024, 3);
      const q4 = generateAccountReportFilename(2024, 4);

      expect(q1).toContain('1분기');
      expect(q2).toContain('2분기');
      expect(q3).toContain('3분기');
      expect(q4).toContain('4분기');
    });
  });

  // ========================================
  // 엣지 케이스 테스트
  // ========================================

  describe('edge cases', () => {
    it('should handle empty income items', () => {
      const currentYear = createMockReportData(2024, 2);
      currentYear.incomeItems = [];

      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수입부'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      // 헤더는 있어야 함
      expect(data[3]).toEqual(['항목', '예산액', '당기', '누계', '진척률']);

      // 합계 행은 0으로 표시
      const totalRow = data[data.length - 1];
      expect(totalRow[0]).toBe('합계');
      expect(totalRow[1]).toBe(0);
    });

    it('should handle empty expense items', () => {
      const currentYear = createMockReportData(2024, 2);
      currentYear.expenseItems = [];

      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['지출부'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      const totalRow = data[data.length - 1];
      expect(totalRow[0]).toBe('합계');
      expect(totalRow[1]).toBe(0);
    });

    it('should handle items with only level 2 (orphaned)', () => {
      const currentYear = createMockReportData(2024, 2);
      currentYear.incomeItems = [
        {
          id: 'income-orphan',
          itemName: '고아항목',
          parentItemName: '존재하지않는부모',
          level: 2,
          budgetAmount: 1000000,
          cumulativeAmount: 500000,
          currentAmount: 250000,
          executionRate: 50,
          sortOrder: 1,
        },
      ];

      const options: ExportOptions = {
        year: 2024,
        quarter: 2,
        currentYear,
        previousYear: null,
      };

      const workbook = generateAccountReportWorkbook(options);
      const sheet = workbook.Sheets['수입부'];
      const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

      // level 1 항목이 없으므로 합계는 0
      const totalRow = data[data.length - 1];
      expect(totalRow[1]).toBe(0);
    });
  });
});
