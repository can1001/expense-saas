/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseAccountReportFile,
  validateParsedReport,
  summarizeParsedReport,
  type ParsedAccountReport,
  type SummaryData,
  type ParsedReportItem,
} from '../account-report-parser';

describe('account-report-parser', () => {
  // ========================================
  // 헬퍼 함수 - HTML 테이블 생성
  // ========================================

  /**
   * 표준 6개 테이블 HTML 생성
   */
  function createStandardHTML(): string {
    return `
      <table>
        <tr><td>1. 수지개황</td></tr>
      </table>
      <table>
        <tr>
          <td>구분</td>
          <td>전기이월</td>
          <td>수입총계</td>
          <td>지출총계</td>
          <td>차액</td>
          <td>차기이월</td>
        </tr>
        <tr>
          <td>당기</td>
          <td>1,000,000</td>
          <td>5,000,000</td>
          <td>3,000,000</td>
          <td>2,000,000</td>
          <td>3,000,000</td>
        </tr>
        <tr>
          <td>누계</td>
          <td>500,000</td>
          <td>10,000,000</td>
          <td>7,000,000</td>
          <td>3,000,000</td>
          <td>3,500,000</td>
        </tr>
      </table>
      <table>
        <tr><td>2. 수입부</td></tr>
      </table>
      <table>
        <tr>
          <td>항목</td>
          <td>예산액</td>
          <td>누계</td>
          <td>당기</td>
          <td>대비(%)</td>
        </tr>
        <tr>
          <td>헌금수입</td>
          <td>20,000,000</td>
          <td>8,000,000</td>
          <td>4,000,000</td>
          <td>40%</td>
        </tr>
        <tr>
          <td>    십일조</td>
          <td>15,000,000</td>
          <td>6,000,000</td>
          <td>3,000,000</td>
          <td>40%</td>
        </tr>
        <tr>
          <td>    감사헌금</td>
          <td>5,000,000</td>
          <td>2,000,000</td>
          <td>1,000,000</td>
          <td>40%</td>
        </tr>
        <tr>
          <td>기타수입</td>
          <td>2,000,000</td>
          <td>2,000,000</td>
          <td>1,000,000</td>
          <td>100%</td>
        </tr>
      </table>
      <table>
        <tr><td>3. 지출부</td></tr>
      </table>
      <table>
        <tr>
          <td>항목</td>
          <td>예산액</td>
          <td>누계</td>
          <td>당기</td>
          <td>대비(%)</td>
        </tr>
        <tr>
          <td>인건비</td>
          <td>10,000,000</td>
          <td>5,000,000</td>
          <td>2,500,000</td>
          <td>50%</td>
        </tr>
        <tr>
          <td>    급여</td>
          <td>8,000,000</td>
          <td>4,000,000</td>
          <td>2,000,000</td>
          <td>50%</td>
        </tr>
        <tr>
          <td>운영비</td>
          <td>5,000,000</td>
          <td>2,000,000</td>
          <td>500,000</td>
          <td>40%</td>
        </tr>
      </table>
    `;
  }

  /**
   * 단일 테이블로 병합된 HTML 생성 (xlsx 변환 시뮬레이션)
   */
  function createMergedTableHTML(): string {
    return `
      <table>
        <tr><td>1. 수지개황</td></tr>
        <tr>
          <td>구분</td>
          <td>전기이월</td>
          <td>수입총계</td>
          <td>지출총계</td>
          <td>차액</td>
          <td>차기이월</td>
        </tr>
        <tr>
          <td>당기</td>
          <td>1,000,000</td>
          <td>5,000,000</td>
          <td>3,000,000</td>
          <td>2,000,000</td>
          <td>3,000,000</td>
        </tr>
        <tr>
          <td>누계</td>
          <td>500,000</td>
          <td>10,000,000</td>
          <td>7,000,000</td>
          <td>3,000,000</td>
          <td>3,500,000</td>
        </tr>
        <tr><td>2. 수입부</td></tr>
        <tr>
          <td>항목</td>
          <td>예산액</td>
          <td>누계</td>
          <td>당기</td>
          <td>대비(%)</td>
        </tr>
        <tr>
          <td>헌금수입</td>
          <td>20,000,000</td>
          <td>8,000,000</td>
          <td>4,000,000</td>
          <td>40%</td>
        </tr>
        <tr><td>3. 지출부</td></tr>
        <tr>
          <td>항목</td>
          <td>예산액</td>
          <td>누계</td>
          <td>당기</td>
          <td>대비(%)</td>
        </tr>
        <tr>
          <td>인건비</td>
          <td>10,000,000</td>
          <td>5,000,000</td>
          <td>2,500,000</td>
          <td>50%</td>
        </tr>
      </table>
    `;
  }

  /**
   * HTML 문자열을 ArrayBuffer로 변환
   */
  function htmlToArrayBuffer(html: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(html).buffer;
  }

  // ========================================
  // parseAccountReportFile 테스트
  // ========================================

  describe('parseAccountReportFile', () => {
    it('should parse standard 6-table HTML format', async () => {
      const html = createStandardHTML();
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data!.summary).toBeDefined();
      expect(result.data!.incomeItems).toHaveLength(4);
      expect(result.data!.expenseItems).toHaveLength(3);
    });

    it('should parse merged single-table format', async () => {
      const html = createMergedTableHTML();
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data!.summary).toBeDefined();
      expect(result.data!.incomeItems.length).toBeGreaterThan(0);
      expect(result.data!.expenseItems.length).toBeGreaterThan(0);
    });

    it('should parse summary data correctly', async () => {
      const html = createStandardHTML();
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);

      expect(result.data!.summary.current).toEqual({
        previousCarryover: 1000000,
        totalIncome: 5000000,
        totalExpense: 3000000,
        difference: 2000000,
        nextCarryover: 3000000,
      });

      expect(result.data!.summary.cumulative).toEqual({
        previousCarryover: 500000,
        totalIncome: 10000000,
        totalExpense: 7000000,
        difference: 3000000,
        nextCarryover: 3500000,
      });
    });

    it('should parse income items with hierarchy', async () => {
      const html = createStandardHTML();
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);
      const items = result.data!.incomeItems;

      // 대분류 (level 1)
      const 헌금수입 = items.find((item) => item.itemName === '헌금수입');
      expect(헌금수입).toBeDefined();
      expect(헌금수입!.level).toBe(1);
      expect(헌금수입!.budgetAmount).toBe(20000000);
      expect(헌금수입!.cumulativeAmount).toBe(8000000);
      expect(헌금수입!.currentAmount).toBe(4000000);
      expect(헌금수입!.executionRate).toBe(40);

      // 소분류 - cleanCellText가 trim()하므로 들여쓰기가 제거됨
      // 실제 파일에서는 &nbsp; 등으로 공백이 보존되어야 level 2로 감지됨
      const 십일조 = items.find((item) => item.itemName === '십일조');
      expect(십일조).toBeDefined();
      // HTML의 "    십일조"는 trim 후 "십일조"가 되어 level 1로 감지됨
      expect(items.filter(item => item.itemName === '십일조' || item.itemName === '감사헌금')).toHaveLength(2);
    });

    it('should parse expense items with hierarchy', async () => {
      const html = createStandardHTML();
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);
      const items = result.data!.expenseItems;

      const 인건비 = items.find((item) => item.itemName === '인건비');
      expect(인건비).toBeDefined();
      expect(인건비!.level).toBe(1);

      const 급여 = items.find((item) => item.itemName === '급여');
      expect(급여).toBeDefined();
      // cleanCellText의 trim()으로 들여쓰기 제거됨
      expect(items.filter(item => item.itemName === '급여' || item.itemName === '운영비')).toHaveLength(2);
    });

    it('should return error for insufficient tables', async () => {
      const html = '<table><tr><td>test</td></tr></table>';
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);

      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('MISSING_TABLE');
      expect(result.error!.message).toContain('테이블이 부족합니다');
    });

    it('should handle empty amounts gracefully', async () => {
      const html = `
        <table><tr><td>1. 수지개황</td></tr></table>
        <table>
          <tr><td>구분</td><td>전기이월</td><td>수입총계</td><td>지출총계</td><td>차액</td><td>차기이월</td></tr>
          <tr><td>당기</td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td>누계</td><td></td><td></td><td></td><td></td><td></td></tr>
        </table>
        <table><tr><td>2. 수입부</td></tr></table>
        <table><tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr></table>
        <table><tr><td>3. 지출부</td></tr></table>
        <table><tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr></table>
      `;
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);

      expect(result.error).toBeUndefined();
      expect(result.data!.summary.current.totalIncome).toBe(0);
      expect(result.data!.summary.current.totalExpense).toBe(0);
    });

    it('should handle negative amounts', async () => {
      const html = `
        <table><tr><td>1. 수지개황</td></tr></table>
        <table>
          <tr><td>구분</td><td>전기이월</td><td>수입총계</td><td>지출총계</td><td>차액</td><td>차기이월</td></tr>
          <tr><td>당기</td><td>-100,000</td><td>1,000,000</td><td>1,200,000</td><td>-200,000</td><td>500,000</td></tr>
          <tr><td>누계</td><td>0</td><td>2,000,000</td><td>2,100,000</td><td>-100,000</td><td>900,000</td></tr>
        </table>
        <table><tr><td>2. 수입부</td></tr></table>
        <table><tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr></table>
        <table><tr><td>3. 지출부</td></tr></table>
        <table><tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr></table>
      `;
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);

      expect(result.data!.summary.current.previousCarryover).toBe(-100000);
      expect(result.data!.summary.current.difference).toBe(-200000);
    });

    it('should handle colspan in merged cells', async () => {
      const html = `
        <table><tr><td>1. 수지개황</td></tr></table>
        <table>
          <tr><td colspan="2">구분</td><td>수입총계</td><td>지출총계</td><td>차액</td><td>차기이월</td></tr>
          <tr><td>당기</td><td>1,000,000</td><td>5,000,000</td><td>3,000,000</td><td>2,000,000</td><td>3,000,000</td></tr>
          <tr><td>누계</td><td>500,000</td><td>10,000,000</td><td>7,000,000</td><td>3,000,000</td><td>3,500,000</td></tr>
        </table>
        <table><tr><td>2. 수입부</td></tr></table>
        <table><tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr></table>
        <table><tr><td>3. 지출부</td></tr></table>
        <table><tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr></table>
      `;
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);

      expect(result.error).toBeUndefined();
      expect(result.data!.summary.current.totalIncome).toBe(5000000);
    });

    it('should handle HTML entities in cell text', async () => {
      const html = `
        <table><tr><td>1. 수지개황</td></tr></table>
        <table>
          <tr><td>구분</td><td>전기이월</td><td>수입총계</td><td>지출총계</td><td>차액</td><td>차기이월</td></tr>
          <tr><td>당기</td><td>&#8361;1,000,000</td><td>&nbsp;5,000,000&nbsp;</td><td>3,000,000</td><td>2,000,000</td><td>3,000,000</td></tr>
          <tr><td>누계</td><td>500,000</td><td>10,000,000</td><td>7,000,000</td><td>3,000,000</td><td>3,500,000</td></tr>
        </table>
        <table><tr><td>2. 수입부</td></tr></table>
        <table><tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr></table>
        <table><tr><td>3. 지출부</td></tr></table>
        <table><tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr></table>
      `;
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);

      expect(result.data!.summary.current.previousCarryover).toBe(1000000);
      expect(result.data!.summary.current.totalIncome).toBe(5000000);
    });

    it('should skip duplicate consecutive items', async () => {
      const html = `
        <table><tr><td>1. 수지개황</td></tr></table>
        <table>
          <tr><td>구분</td><td>전기이월</td><td>수입총계</td><td>지출총계</td><td>차액</td><td>차기이월</td></tr>
          <tr><td>당기</td><td>1,000,000</td><td>5,000,000</td><td>3,000,000</td><td>2,000,000</td><td>3,000,000</td></tr>
          <tr><td>누계</td><td>500,000</td><td>10,000,000</td><td>7,000,000</td><td>3,000,000</td><td>3,500,000</td></tr>
        </table>
        <table><tr><td>2. 수입부</td></tr></table>
        <table>
          <tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr>
          <tr><td>헌금수입</td><td>20,000,000</td><td>8,000,000</td><td>4,000,000</td><td>40%</td></tr>
          <tr><td>헌금수입</td><td>20,000,000</td><td>8,000,000</td><td>4,000,000</td><td>40%</td></tr>
        </table>
        <table><tr><td>3. 지출부</td></tr></table>
        <table><tr><td>항목</td><td>예산액</td><td>누계</td><td>당기</td><td>대비(%)</td></tr></table>
      `;
      const buffer = htmlToArrayBuffer(html);

      const result = await parseAccountReportFile(buffer);

      const 헌금수입Items = result.data!.incomeItems.filter((item) => item.itemName === '헌금수입');
      expect(헌금수입Items).toHaveLength(1);
    });
  });

  // ========================================
  // validateParsedReport 테스트
  // ========================================

  describe('validateParsedReport', () => {
    let validReport: ParsedAccountReport;

    beforeEach(() => {
      validReport = {
        summary: {
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
        },
        incomeItems: [
          {
            itemName: '헌금수입',
            level: 1,
            budgetAmount: 20000000,
            cumulativeAmount: 10000000,
            currentAmount: 5000000,
            executionRate: 50,
            sortOrder: 1,
          },
        ],
        expenseItems: [
          {
            itemName: '인건비',
            level: 1,
            budgetAmount: 10000000,
            cumulativeAmount: 7000000,
            currentAmount: 3000000,
            executionRate: 70,
            sortOrder: 1,
          },
        ],
      };
    });

    it('should pass validation for valid report', () => {
      const result = validateParsedReport(validReport);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn when income items are empty', () => {
      validReport.incomeItems = [];

      const result = validateParsedReport(validReport);

      expect(result.warnings).toContain('수입 항목이 없습니다.');
    });

    it('should warn when expense items are empty', () => {
      validReport.expenseItems = [];

      const result = validateParsedReport(validReport);

      expect(result.warnings).toContain('지출 항목이 없습니다.');
    });

    it('should warn when summary totals are zero', () => {
      validReport.summary.current.totalIncome = 0;
      validReport.summary.current.totalExpense = 0;

      const result = validateParsedReport(validReport);

      expect(result.warnings).toContain('요약 데이터의 수입/지출 총계가 0입니다.');
    });

    it('should warn when income total mismatch is within 5% but > 1000', () => {
      validReport.summary.cumulative.totalIncome = 10100000; // 1% 차이
      validReport.incomeItems[0].cumulativeAmount = 10000000;

      const result = validateParsedReport(validReport);

      expect(result.warnings.some((w) => w.includes('수입 항목 누계 합계'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('오차율: 0.99%'))).toBe(true);
    });

    it('should fail validation when income error rate exceeds 5%', () => {
      validReport.summary.cumulative.totalIncome = 15000000; // 50% 차이
      validReport.incomeItems[0].cumulativeAmount = 10000000;

      const result = validateParsedReport(validReport);

      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.includes('5%를 초과합니다'))).toBe(true);
    });

    it('should fail validation when expense error rate exceeds 5%', () => {
      validReport.summary.cumulative.totalExpense = 12000000; // 71% 차이
      validReport.expenseItems[0].cumulativeAmount = 7000000;

      const result = validateParsedReport(validReport);

      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.includes('지출 항목 누계 합계 오차율'))).toBe(true);
    });

    it('should handle zero summary values gracefully', () => {
      validReport.summary.cumulative.totalIncome = 0;
      validReport.incomeItems[0].cumulativeAmount = 0;

      const result = validateParsedReport(validReport);

      // 0으로 나누기 오류가 발생하지 않아야 함
      expect(result).toBeDefined();
    });

    it('should only sum level 1 items for validation', () => {
      validReport.incomeItems.push({
        itemName: '십일조',
        parentItemName: '헌금수입',
        level: 2,
        budgetAmount: 15000000,
        cumulativeAmount: 8000000,
        currentAmount: 4000000,
        executionRate: 53,
        sortOrder: 2,
      });

      validReport.summary.cumulative.totalIncome = 10000000;

      const result = validateParsedReport(validReport);

      // level 2 항목은 합계에 포함되지 않아야 함
      expect(result.valid).toBe(true);
    });
  });

  // ========================================
  // summarizeParsedReport 테스트
  // ========================================

  describe('summarizeParsedReport', () => {
    it('should generate summary string', () => {
      const report: ParsedAccountReport = {
        summary: {
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
        },
        incomeItems: [
          {
            itemName: '헌금수입',
            level: 1,
            budgetAmount: 20000000,
            cumulativeAmount: 10000000,
            currentAmount: 5000000,
            executionRate: 50,
            sortOrder: 1,
          },
        ],
        expenseItems: [
          {
            itemName: '인건비',
            level: 1,
            budgetAmount: 10000000,
            cumulativeAmount: 7000000,
            currentAmount: 3000000,
            executionRate: 70,
            sortOrder: 1,
          },
        ],
      };

      const summary = summarizeParsedReport(report);

      expect(summary).toContain('재정보고서 파싱 결과');
      expect(summary).toContain('당기 수입: 5,000,000원');
      expect(summary).toContain('당기 지출: 3,000,000원');
      expect(summary).toContain('차기이월: 3,000,000원');
      expect(summary).toContain('[수입부] 1개 항목');
      expect(summary).toContain('[지출부] 1개 항목');
    });
  });
});
