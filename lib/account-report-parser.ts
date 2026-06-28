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

import ExcelJS from 'exceljs';

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
 * 입출금 통장 항목
 */
export interface ParsedBankAccount {
  accountType: string;
  balance: number;
  accountNumber?: string;
  note?: string;
  sortOrder: number;
}

/**
 * 적립금 항목
 */
export interface ParsedReserve {
  itemName: string;
  previousBalance: number;
  increase: number;
  decrease: number;
  currentBalance: number;
  note?: string;
  sortOrder: number;
}

/**
 * 기타 자산 항목
 */
export interface ParsedAsset {
  assetType: string;
  amount: number;
  maturityDate?: string;
  owner?: string;
  note?: string;
  sortOrder: number;
}

/**
 * 기타 부채 항목
 */
export interface ParsedLiability {
  itemName: string;
  previousBalance: number;
  increase: number;
  decrease: number;
  currentBalance: number;
  maturityDate?: string;
  debtor?: string;
  loanStartDate?: string;
  interestRate?: number;
  note?: string;
  sortOrder: number;
}

/**
 * 위원회별 지출 항목
 */
export interface ParsedCommitteeExpense {
  committee: string;
  amount: number;
  sortOrder: number;
}

/**
 * 파싱 결과
 */
export interface ParsedAccountReport {
  summary: SummaryData;
  incomeItems: ParsedReportItem[];
  expenseItems: ParsedReportItem[];
  bankAccounts: ParsedBankAccount[];
  reserves: ParsedReserve[];
  assets: ParsedAsset[];
  liabilities: ParsedLiability[];
  committeeExpenses: ParsedCommitteeExpense[];
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
 * ExcelJS 워크시트를 HTML 테이블로 변환
 */
function worksheetToHtml(worksheet: ExcelJS.Worksheet): string {
  let html = '<table>';

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    html += '<tr>';
    row.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value ?? '';
      html += `<td>${escapeHtml(String(value))}</td>`;
    });
    html += '</tr>';
  });

  html += '</table>';
  return html;
}

/**
 * HTML 이스케이프 헬퍼
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
      // ExcelJS로 파싱 시도
      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(Buffer.from(new Uint8Array(buffer)) as any);

      // 모든 시트를 하나의 HTML로 결합
      let combinedHtml = '';
      workbook.worksheets.forEach((sheet) => {
        const sheetHtml = worksheetToHtml(sheet);
        combinedHtml += `<!-- 시트: ${sheet.name} -->\n${sheetHtml}\n`;
      });

      htmlContent = combinedHtml;
    }

    // 2. HTML에서 테이블 추출
    let tables = extractTables(htmlContent);

    // 테이블이 1개뿐인 경우 (xlsx가 단일 테이블로 변환된 경우)
    // 섹션 헤더를 기준으로 분리 시도
    if (tables.length === 1) {
      const splitTables = splitTableBySections(tables[0]);
      if (splitTables) {
        tables = splitTables;
      }
    }

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

    // 6. 추가 섹션 파싱 (입출금통장, 적립금, 기타자산, 기타부채, 위원회별 지출)
    // 전체 HTML에서 추가 데이터 파싱
    const bankAccounts = parseBankAccountSection(htmlContent);
    const reserves = parseReserveSection(htmlContent);
    const assets = parseAssetSection(htmlContent);
    const liabilities = parseLiabilitySection(htmlContent);
    const committeeExpenses = parseCommitteeExpenseSection(htmlContent, expenseItems);

    // 7. 파싱 결과 반환 (검증은 호출측에서 경고로 처리)
    const parsedReport = {
      summary,
      incomeItems,
      expenseItems,
      bankAccounts,
      reserves,
      assets,
      liabilities,
      committeeExpenses,
    };

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
 * 단일 테이블을 섹션 헤더로 분리하여 6개 테이블 형태로 반환
 * xlsx 파일이 HTML로 변환될 때 단일 테이블로 병합되는 경우 처리
 */
function splitTableBySections(tableHtml: string): string[] | null {
  const rows = extractTableRows(tableHtml);

  if (rows.length === 0) {
    return null;
  }

  // 섹션별 행 저장
  type SectionKey = 'summary' | 'income' | 'expense';
  let currentSection: SectionKey | 'unknown' = 'unknown';
  const sections: Record<SectionKey, string[][]> = {
    summary: [],
    income: [],
    expense: [],
  };

  // 섹션 헤더 감지 패턴
  const sectionPatterns = {
    summary: /수지개황/,
    income: /수입부/,
    expense: /지출부/,
  };

  for (const row of rows) {
    const firstCell = row[0]?.trim() || '';

    // 섹션 헤더 감지
    if (sectionPatterns.summary.test(firstCell)) {
      currentSection = 'summary';
      continue; // 헤더 행은 건너뜀
    }
    if (sectionPatterns.income.test(firstCell)) {
      currentSection = 'income';
      continue;
    }
    if (sectionPatterns.expense.test(firstCell)) {
      currentSection = 'expense';
      continue;
    }

    // 현재 섹션에 행 추가
    if (currentSection !== 'unknown') {
      sections[currentSection].push(row);
    }
  }

  // 섹션이 제대로 분리되었는지 확인
  if (sections.summary.length === 0 && sections.income.length === 0 && sections.expense.length === 0) {
    return null; // 섹션 헤더를 찾지 못함
  }

  // 행 배열을 HTML 테이블 문자열로 변환
  const rowsToTableHtml = (sectionRows: string[][]): string => {
    if (sectionRows.length === 0) return '<table></table>';

    const htmlRows = sectionRows
      .map((row) => {
        const cells = row.map((cell) => `<td>${cell}</td>`).join('');
        return `<tr>${cells}</tr>`;
      })
      .join('\n');

    return `<table>${htmlRows}</table>`;
  };

  // 6개 테이블 형식으로 반환:
  // [0] 수지개황 제목, [1] 요약 데이터, [2] 수입부 제목, [3] 수입 상세, [4] 지출부 제목, [5] 지출 상세
  return [
    '<table><tr><td>1. 수지개황</td></tr></table>', // 제목 (더미)
    rowsToTableHtml(sections.summary),
    '<table><tr><td>2. 수입부</td></tr></table>', // 제목 (더미)
    rowsToTableHtml(sections.income),
    '<table><tr><td>3. 지출부</td></tr></table>', // 제목 (더미)
    rowsToTableHtml(sections.expense),
  ];
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
// 추가 섹션 파싱 함수들
// ========================================

/**
 * 입출금 통장 섹션 파싱
 * 보통예금(주거래통장): 잔액, 계좌번호, 비고
 */
function parseBankAccountSection(htmlContent: string): ParsedBankAccount[] {
  const items: ParsedBankAccount[] = [];

  // 모든 테이블 추출
  const tables = extractTables(htmlContent);

  for (const table of tables) {
    const rows = extractTableRows(table);

    // "입출금" 또는 "보통예금" 키워드가 있는 행 찾기
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = row[0]?.trim() || '';

      // 헤더 행 감지 (예금종류, 예금잔액, 계좌번호 등)
      if (firstCell.includes('예금종류') || firstCell.includes('입출금')) {
        // 다음 행들이 데이터
        for (let j = i + 1; j < rows.length && j < i + 10; j++) {
          const dataRow = rows[j];
          const accountType = dataRow[0]?.trim();

          // 빈 행이거나 다른 섹션 헤더면 중단
          if (!accountType || accountType.includes('적립금') || accountType.includes('자산') || accountType.includes('부채')) {
            break;
          }

          // 숫자가 아닌 순수 텍스트 행 (제목 등)은 건너뜀
          const hasBalance = dataRow.some((cell, idx) => idx > 0 && parseAmount(cell) > 0);
          if (!hasBalance) continue;

          items.push({
            accountType,
            balance: parseAmount(dataRow[1]),
            accountNumber: dataRow[2]?.trim() || undefined,
            note: dataRow[3]?.trim() || undefined,
            sortOrder: items.length,
          });
        }
        break;
      }

      // 보통예금으로 시작하는 행 감지 (직접 데이터 행)
      if (firstCell.includes('보통예금') || firstCell.includes('정기예금') || firstCell.includes('정기적금')) {
        const hasBalance = row.some((cell, idx) => idx > 0 && parseAmount(cell) > 0);
        if (hasBalance) {
          items.push({
            accountType: firstCell,
            balance: parseAmount(row[1]),
            accountNumber: row[2]?.trim() || undefined,
            note: row[3]?.trim() || undefined,
            sortOrder: items.length,
          });
        }
      }
    }
  }

  return items;
}

/**
 * 적립금 섹션 파싱
 * 항목명, 전기이월, 증가, 감소, 차기이월, 비고
 */
function parseReserveSection(htmlContent: string): ParsedReserve[] {
  const items: ParsedReserve[] = [];

  const tables = extractTables(htmlContent);

  for (const table of tables) {
    const rows = extractTableRows(table);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = row[0]?.trim() || '';

      // 적립금 헤더 감지
      if (firstCell.includes('적립금') && (row.some(cell => cell.includes('전기이월')) || row.some(cell => cell.includes('이월')))) {
        // 다음 행들이 데이터
        for (let j = i + 1; j < rows.length && j < i + 15; j++) {
          const dataRow = rows[j];
          const itemName = dataRow[0]?.trim();

          // 빈 행이거나 다른 섹션 헤더면 중단
          if (!itemName || itemName.includes('자산') || itemName.includes('부채') || itemName === '계' || itemName === '합계') {
            if (itemName === '계' || itemName === '합계') continue; // 합계 행은 건너뛰고 계속
            break;
          }

          // 적립금 관련 항목인지 확인
          if (itemName.includes('적립금') || itemName.includes('예비비')) {
            items.push({
              itemName,
              previousBalance: parseAmount(dataRow[1]),
              increase: parseAmount(dataRow[2]),
              decrease: parseAmount(dataRow[3]),
              currentBalance: parseAmount(dataRow[4]),
              note: dataRow[5]?.trim() || undefined,
              sortOrder: items.length,
            });
          }
        }
        break;
      }
    }
  }

  return items;
}

/**
 * 기타 자산 섹션 파싱
 * 자산종류, 금액, 만기일자, 소유자, 비고
 */
function parseAssetSection(htmlContent: string): ParsedAsset[] {
  const items: ParsedAsset[] = [];

  const tables = extractTables(htmlContent);

  for (const table of tables) {
    const rows = extractTableRows(table);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = row[0]?.trim() || '';

      // 기타 자산 헤더 감지
      if ((firstCell.includes('기타') && firstCell.includes('자산')) || firstCell.includes('자산종류')) {
        // 다음 행들이 데이터
        for (let j = i + 1; j < rows.length && j < i + 15; j++) {
          const dataRow = rows[j];
          const assetType = dataRow[0]?.trim();

          // 빈 행이거나 다른 섹션 헤더면 중단
          if (!assetType || assetType.includes('부채') || assetType === '계' || assetType === '합계') {
            if (assetType === '계' || assetType === '합계') continue;
            break;
          }

          // 금액이 있는 행만 추가
          const amount = parseAmount(dataRow[1]);
          if (amount > 0) {
            items.push({
              assetType,
              amount,
              maturityDate: parseDateString(dataRow[2]),
              owner: dataRow[3]?.trim() || undefined,
              note: dataRow[4]?.trim() || undefined,
              sortOrder: items.length,
            });
          }
        }
        break;
      }
    }
  }

  return items;
}

/**
 * 기타 부채 섹션 파싱
 * 항목명, 전기이월, 증가, 감소, 차기이월, 만기일자, 채무자, 대출실행일, 대출금리, 비고
 */
function parseLiabilitySection(htmlContent: string): ParsedLiability[] {
  const items: ParsedLiability[] = [];

  const tables = extractTables(htmlContent);

  for (const table of tables) {
    const rows = extractTableRows(table);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = row[0]?.trim() || '';

      // 기타 부채 헤더 감지
      if ((firstCell.includes('기타') && firstCell.includes('부채')) ||
          (firstCell.includes('부채') && row.some(cell => cell.includes('전기이월')))) {
        // 다음 행들이 데이터
        for (let j = i + 1; j < rows.length && j < i + 15; j++) {
          const dataRow = rows[j];
          const itemName = dataRow[0]?.trim();

          // 빈 행이거나 합계 행이면 건너뜀
          if (!itemName || itemName === '계' || itemName === '합계') {
            if (itemName === '계' || itemName === '합계') continue;
            break;
          }

          // 대출, 차입금 관련 항목인지 확인
          if (itemName.includes('대출') || itemName.includes('차입') || itemName.includes('부채')) {
            items.push({
              itemName,
              previousBalance: parseAmount(dataRow[1]),
              increase: parseAmount(dataRow[2]),
              decrease: parseAmount(dataRow[3]),
              currentBalance: parseAmount(dataRow[4]),
              maturityDate: parseDateString(dataRow[5]),
              debtor: dataRow[6]?.trim() || undefined,
              loanStartDate: parseDateString(dataRow[7]),
              interestRate: parsePercentage(dataRow[8]) || undefined,
              note: dataRow[9]?.trim() || undefined,
              sortOrder: items.length,
            });
          }
        }
        break;
      }
    }
  }

  return items;
}

/**
 * 위원회별 지출 섹션 파싱
 * 지출 항목에서 위원회별 합계 추출
 */
function parseCommitteeExpenseSection(
  htmlContent: string,
  expenseItems: ParsedReportItem[]
): ParsedCommitteeExpense[] {
  const items: ParsedCommitteeExpense[] = [];

  // 위원회 키워드 목록
  const committeeKeywords = ['교육위원회', '기획위원회', '목양위원회', '예배위원회', '선교위원회', '봉사위원회'];
  const otherKeywords = ['행정비', '인건', '복리', '사역비'];

  // 지출 항목에서 위원회별 합계 찾기
  for (const item of expenseItems) {
    if (item.level === 1) {
      // 위원회 관련 항목인지 확인
      const isCommittee = committeeKeywords.some(kw => item.itemName.includes(kw));
      const isOther = otherKeywords.some(kw => item.itemName.includes(kw));

      if (isCommittee || isOther) {
        items.push({
          committee: item.itemName,
          amount: item.cumulativeAmount,
          sortOrder: items.length,
        });
      }
    }
  }

  // HTML에서 직접 위원회별 지출 데이터 찾기 (테이블 형태)
  if (items.length === 0) {
    const tables = extractTables(htmlContent);

    for (const table of tables) {
      const rows = extractTableRows(table);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const firstCell = row[0]?.trim() || '';

        // 위원회 키워드가 있는 행
        if (committeeKeywords.some(kw => firstCell.includes(kw))) {
          // 해당 행에서 금액 추출
          const amount = row.find((_, idx) => idx > 0 && parseAmount(row[idx]) > 0);
          if (amount) {
            items.push({
              committee: firstCell,
              amount: parseAmount(amount),
              sortOrder: items.length,
            });
          }
        }
      }
    }
  }

  return items;
}

/**
 * 날짜 문자열 파싱
 */
function parseDateString(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const cleaned = value.trim();
  if (!cleaned) return undefined;

  // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD 형식 처리
  const dateMatch = cleaned.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
  }

  return undefined;
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
  lines.push(`[입출금 통장] ${report.bankAccounts.length}개 항목`);
  lines.push(`[적립금] ${report.reserves.length}개 항목`);
  lines.push(`[기타 자산] ${report.assets.length}개 항목`);
  lines.push(`[기타 부채] ${report.liabilities.length}개 항목`);
  lines.push(`[위원회별 지출] ${report.committeeExpenses.length}개 항목`);

  return lines.join('\n');
}
