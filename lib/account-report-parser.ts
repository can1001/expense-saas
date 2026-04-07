/**
 * 재정보고서 파싱 로직
 *
 * HTML 형식으로 저장된 .xls 파일에서 재정 데이터를 추출합니다.
 * 파일 구조:
 * - 테이블 1: "1. 수지개황" (제목)
 * - 테이블 2: 요약 (구분, 전기이월, 수입총계, 지출총계, 차액, 차기이월)
 * - 테이블 3: "2. 수입부" (제목)
 * - 테이블 4: 수입 상세 (항목, 예산액, 누계, 당기, 대비%)
 * - 테이블 5: "3. 지출부" (제목)
 * - 테이블 6: 지출 상세 (항목, 예산액, 누계, 당기, 대비%)
 */

import * as XLSX from 'xlsx';

// ========================================
// 타입 정의
// ========================================

/**
 * 수지개황 요약 데이터
 */
export interface SummaryData {
  current: {
    previousCarryover: number; // 전기이월
    totalIncome: number; // 수입총계
    totalExpense: number; // 지출총계
    difference: number; // 차액
    nextCarryover: number; // 차기이월
  };
  cumulative: {
    previousCarryover: number;
    totalIncome: number;
    totalExpense: number;
    difference: number;
    nextCarryover: number;
  };
}

/**
 * 수입/지출 항목
 */
export interface ParsedReportItem {
  itemName: string;
  parentItemName?: string;
  level: number;
  budgetAmount: number;
  cumulativeAmount: number;
  currentAmount: number;
  executionRate: number;
  sortOrder: number;
}

/**
 * 파싱 결과
 */
export interface ParsedAccountReport {
  summary: SummaryData;
  incomeItems: ParsedReportItem[];
  expenseItems: ParsedReportItem[];
}

/**
 * 파싱 에러
 */
export interface ParseError {
  type: 'INVALID_FORMAT' | 'MISSING_TABLE' | 'PARSE_ERROR' | 'VALIDATION_FAILED';
  message: string;
  details?: string;
}

// ========================================
// 메인 파싱 함수
// ========================================

/**
 * 재정보고서 파일 파싱
 * @param buffer 파일 버퍼 (ArrayBuffer)
 * @returns 파싱된 재정보고서 데이터
 */
export async function parseAccountReportFile(
  buffer: ArrayBuffer
): Promise<{ data?: ParsedAccountReport; error?: ParseError }> {
  try {
    // 1. 파일을 문자열로 읽기 (HTML 형식 .xls)
    const uint8Array = new Uint8Array(buffer);
    let htmlContent: string;

    // UTF-8로 시도
    const decoder = new TextDecoder('utf-8');
    htmlContent = decoder.decode(uint8Array);

    // HTML 태그가 없으면 xlsx로 시도 (다중 시트 지원)
    if (!htmlContent.includes('<table')) {
      // xlsx 라이브러리로 파싱 시도
      const workbook = XLSX.read(buffer, { type: 'array' });

      // 모든 시트를 하나의 HTML로 결합
      let combinedHtml = '';
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        // 병합 셀 정보 포함하여 HTML 변환
        const sheetHtml = XLSX.utils.sheet_to_html(sheet, { header: '', footer: '' });
        combinedHtml += `<!-- 시트: ${sheetName} -->\n${sheetHtml}\n`;
      });

      htmlContent = combinedHtml;
    }

    // 2. HTML에서 테이블 추출
    const tables = extractTables(htmlContent);

    if (tables.length < 6) {
      return {
        error: {
          type: 'MISSING_TABLE',
          message: `테이블이 부족합니다. 예상: 6개, 실제: ${tables.length}개`,
          details: '재정보고서 파일 형식을 확인해주세요.',
        },
      };
    }

    // 3. 요약 테이블 파싱 (테이블 2)
    const summary = parseSummaryTable(tables[1]);

    // 4. 수입 테이블 파싱 (테이블 4)
    const incomeItems = parseDetailTable(tables[3]);

    // 5. 지출 테이블 파싱 (테이블 6)
    const expenseItems = parseDetailTable(tables[5]);

    // 6. 파싱 결과 검증
    const parsedReport = {
      summary,
      incomeItems,
      expenseItems,
    };

    const validation = validateParsedReport(parsedReport);

    // 5% 초과 오류가 있으면 저장 거부
    if (!validation.valid) {
      const highErrorWarnings = validation.warnings.filter(w => w.includes('5%를 초과합니다'));
      if (highErrorWarnings.length > 0) {
        return {
          error: {
            type: 'VALIDATION_FAILED',
            message: '합계 검증 오차가 5%를 초과하여 저장할 수 없습니다.',
            details: highErrorWarnings.join('\n'),
          },
        };
      }
    }

    return {
      data: parsedReport,
    };
  } catch (error) {
    console.error('Account report parsing error:', error);
    return {
      error: {
        type: 'PARSE_ERROR',
        message: '파일 파싱 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// ========================================
// HTML 파싱 헬퍼 함수
// ========================================

/**
 * HTML에서 모든 테이블 추출
 */
function extractTables(html: string): string[] {
  const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
  return html.match(tableRegex) || [];
}

/**
 * 테이블에서 모든 행 추출
 */
function extractTableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells = extractCells(rowMatch[1]);
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

/**
 * 행에서 셀 추출 (병합 셀 처리 포함)
 */
function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi;

  let cellMatch;
  while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
    const cellAttributes = cellMatch[1];
    const cellText = cleanCellText(cellMatch[2]);

    // colspan 속성 확인
    const colspanMatch = cellAttributes.match(/colspan\s*=\s*["\']?(\d+)["\']?/i);
    const colspan = colspanMatch ? parseInt(colspanMatch[1], 10) : 1;

    // 첫 번째 셀에 내용 추가
    cells.push(cellText);

    // 병합된 셀만큼 빈 셀 추가
    for (let i = 1; i < colspan; i++) {
      cells.push(''); // 병합된 셀은 빈 문자열로 채움
    }
  }

  return cells;
}

/**
 * 셀 텍스트 정리 (HTML 태그 제거, 엔티티 디코딩)
 */
function cleanCellText(html: string): string {
  return (
    html
      // HTML 태그 제거
      .replace(/<[^>]*>/g, '')
      // HTML 엔티티 디코딩
      .replace(/&#8361;/g, '') // 원화 기호 제거
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      // 공백 정리
      .trim()
  );
}

/**
 * 금액 문자열을 숫자로 변환
 */
function parseAmount(value: string | undefined): number {
  if (!value) return 0;

  // 콤마, 공백, 원화 기호 등 제거
  const cleaned = value.replace(/[,\s₩\\원]/g, '');

  // 숫자 부분만 추출
  const match = cleaned.match(/-?\d+/);
  if (!match) return 0;

  const num = parseInt(match[0], 10);
  return isNaN(num) ? 0 : num;
}

/**
 * 퍼센트 문자열을 숫자로 변환
 */
function parsePercentage(value: string | undefined): number {
  if (!value) return 0;

  // % 기호, 공백 제거
  const cleaned = value.replace(/[%\s]/g, '');

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ========================================
// 테이블별 파싱 함수
// ========================================

/**
 * 요약 테이블 파싱 (테이블 2)
 * 헤더: 구분, 전기이월, 수입총계, 지출총계, 차액, 차기이월
 * 행1: 당기
 * 행2: 누계
 */
function parseSummaryTable(tableHtml: string): SummaryData {
  const rows = extractTableRows(tableHtml);

  // 기본값
  const emptySummary = {
    previousCarryover: 0,
    totalIncome: 0,
    totalExpense: 0,
    difference: 0,
    nextCarryover: 0,
  };

  if (rows.length < 3) {
    return {
      current: { ...emptySummary },
      cumulative: { ...emptySummary },
    };
  }

  // 행 1: 당기 (rows[1])
  // 행 2: 누계 (rows[2])
  const parseRow = (row: string[]) => ({
    previousCarryover: parseAmount(row[1]),
    totalIncome: parseAmount(row[2]),
    totalExpense: parseAmount(row[3]),
    difference: parseAmount(row[4]),
    nextCarryover: parseAmount(row[5]),
  });

  return {
    current: parseRow(rows[1] || []),
    cumulative: parseRow(rows[2] || []),
  };
}

/**
 * 상세 테이블 파싱 (수입/지출)
 * 헤더: 항목, 예산액, 누계, 당기, 대비(%)
 */
function parseDetailTable(tableHtml: string): ParsedReportItem[] {
  const rows = extractTableRows(tableHtml);
  const items: ParsedReportItem[] = [];

  if (rows.length < 2) {
    return items;
  }

  let currentParent: string | null = null;
  let sortOrder = 0;

  // 첫 행은 헤더이므로 건너뜀
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const itemName = row[0]?.trim();

    if (!itemName) continue;

    // 계층 레벨 감지 (들여쓰기로 판단)
    const level = detectLevel(row[0] || '');

    // 대분류인 경우 부모로 설정
    if (level === 1) {
      currentParent = itemName;
    }

    // 중복 항목 건너뛰기 (같은 이름이 연속으로 나오는 경우)
    const prevItem = items[items.length - 1];
    if (prevItem && prevItem.itemName === itemName && prevItem.level === level) {
      // 이미 추가된 항목이면 건너뜀
      continue;
    }

    sortOrder++;

    items.push({
      itemName,
      parentItemName: level > 1 ? currentParent || undefined : undefined,
      level,
      budgetAmount: parseAmount(row[1]),
      cumulativeAmount: parseAmount(row[2]),
      currentAmount: parseAmount(row[3]),
      executionRate: parsePercentage(row[4]),
      sortOrder,
    });
  }

  return items;
}

/**
 * 계층 레벨 감지
 * 들여쓰기가 있으면 하위 레벨로 판단
 */
function detectLevel(rawText: string): number {
  // 원본 텍스트에서 앞쪽 공백 개수 확인
  const leadingSpaces = rawText.match(/^[\s\u00A0　]*/)?.[0]?.length || 0;

  // 4칸 이상 들여쓰기 = 레벨 2 (하위 항목)
  if (leadingSpaces >= 4) {
    return 2;
  }

  // 그 외는 레벨 1 (대분류)
  return 1;
}

// ========================================
// 유틸리티 함수
// ========================================

/**
 * 파싱 결과 검증
 */
export function validateParsedReport(report: ParsedAccountReport): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // 수입 항목 검증
  if (report.incomeItems.length === 0) {
    warnings.push('수입 항목이 없습니다.');
  }

  // 지출 항목 검증
  if (report.expenseItems.length === 0) {
    warnings.push('지출 항목이 없습니다.');
  }

  // 요약 데이터 검증
  const { summary } = report;
  if (summary.current.totalIncome === 0 && summary.current.totalExpense === 0) {
    warnings.push('요약 데이터의 수입/지출 총계가 0입니다.');
  }

  // 수입 누계 합계와 요약의 누계 수입총계 비교 (5% 초과 시 오류)
  const incomeCumulativeTotal = report.incomeItems
    .filter((item) => item.level === 1)
    .reduce((sum, item) => sum + item.cumulativeAmount, 0);

  const summaryIncomeCumulative = summary.cumulative.totalIncome;
  if (incomeCumulativeTotal > 0 && summaryIncomeCumulative > 0) {
    const incomeDifference = Math.abs(incomeCumulativeTotal - summaryIncomeCumulative);
    const incomeErrorRate = (incomeDifference / summaryIncomeCumulative) * 100;

    if (incomeErrorRate > 5) {
      warnings.push(
        `수입 항목 누계 합계 오차율이 ${incomeErrorRate.toFixed(2)}%로 5%를 초과합니다. (항목합계: ${incomeCumulativeTotal.toLocaleString()}, 요약누계: ${summaryIncomeCumulative.toLocaleString()})`
      );
    } else if (incomeDifference > 1000) {
      warnings.push(
        `수입 항목 누계 합계(${incomeCumulativeTotal.toLocaleString()})와 요약의 누계 수입총계(${summaryIncomeCumulative.toLocaleString()})가 다릅니다. (오차율: ${incomeErrorRate.toFixed(2)}%)`
      );
    }
  }

  // 지출 누계 합계와 요약의 누계 지출총계 비교 (5% 초과 시 오류)
  const expenseCumulativeTotal = report.expenseItems
    .filter((item) => item.level === 1)
    .reduce((sum, item) => sum + item.cumulativeAmount, 0);

  const summaryExpenseCumulative = summary.cumulative.totalExpense;
  if (expenseCumulativeTotal > 0 && summaryExpenseCumulative > 0) {
    const expenseDifference = Math.abs(expenseCumulativeTotal - summaryExpenseCumulative);
    const expenseErrorRate = (expenseDifference / summaryExpenseCumulative) * 100;

    if (expenseErrorRate > 5) {
      warnings.push(
        `지출 항목 누계 합계 오차율이 ${expenseErrorRate.toFixed(2)}%로 5%를 초과합니다. (항목합계: ${expenseCumulativeTotal.toLocaleString()}, 요약누계: ${summaryExpenseCumulative.toLocaleString()})`
      );
    } else if (expenseDifference > 1000) {
      warnings.push(
        `지출 항목 누계 합계(${expenseCumulativeTotal.toLocaleString()})와 요약의 누계 지출총계(${summaryExpenseCumulative.toLocaleString()})가 다릅니다. (오차율: ${expenseErrorRate.toFixed(2)}%)`
      );
    }
  }

  // 5% 초과 오류가 있는지 확인
  const hasHighErrorRate = warnings.some(warning =>
    warning.includes('5%를 초과합니다')
  );

  return {
    valid: warnings.length === 0 || !hasHighErrorRate,
    warnings,
  };
}

/**
 * 파싱 결과 요약 출력 (디버깅용)
 */
export function summarizeParsedReport(report: ParsedAccountReport): string {
  const lines: string[] = [];

  lines.push('=== 재정보고서 파싱 결과 ===');
  lines.push('');
  lines.push('[수지개황]');
  lines.push(`  당기 수입: ${report.summary.current.totalIncome.toLocaleString()}원`);
  lines.push(`  당기 지출: ${report.summary.current.totalExpense.toLocaleString()}원`);
  lines.push(`  차기이월: ${report.summary.current.nextCarryover.toLocaleString()}원`);
  lines.push('');
  lines.push(`[수입부] ${report.incomeItems.length}개 항목`);
  lines.push(`[지출부] ${report.expenseItems.length}개 항목`);

  return lines.join('\n');
}
