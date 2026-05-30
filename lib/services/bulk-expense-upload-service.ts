/**
 * 지출결의서 일괄 업로드 서비스 (CLI/API 공유)
 *
 * 책임:
 *  - Excel 버퍼 파싱
 *  - 행 단위 검증
 *  - groupId 기준 지출결의서 그룹핑
 *  - 트랜잭션 일괄 생성 (전체 롤백)
 *
 * 비-책임:
 *  - 권한 체크 (API 라우트에서 수행)
 *  - 결재선 생성 (DRAFT만 생성)
 *  - 첨부파일 처리
 */

import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { lookupBudgetHierarchy } from './budget-lookup-service';

// ============================================================
// 타입
// ============================================================

export interface ExcelRow {
  category?: string;
  subcategory?: string;
  detail?: string;
  description?: string;
  unitPrice?: number;
  quantity?: number;
  requestDate?: string | Date | number;
  expenseDate?: string | Date | number;
  applicantName?: string;
  applicantTitle?: string;
  bankName?: string;
  accountNumber?: string | number;
  accountHolder?: string;
  groupId?: string | number;
}

export interface ValidationError {
  rowNumber: number;     // Excel 1-based 행 번호 (헤더 포함 → 데이터 첫 행은 2)
  groupId?: string;
  field?: string;
  message: string;
}

export interface PreviewItem {
  groupId: string;
  committee: string;
  department: string;
  applicantName: string;
  itemsCount: number;
  requestAmount: number;
}

export interface BulkUploadOptions {
  dryRun: boolean;
}

export interface BulkUploadResult {
  dryRun: boolean;
  totalRows: number;
  totalExpenses: number;
  errors: ValidationError[];
  preview?: PreviewItem[];
  createdIds?: string[];
}

// 행 수 상한 (스펙 Open Question 결정값)
export const MAX_ROWS = 500;

// ============================================================
// Excel 파싱
// ============================================================

export async function parseExpenseExcelBuffer(buffer: Buffer): Promise<ExcelRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('워크시트를 찾을 수 없습니다.');
  }

  // 헤더는 템플릿 생성기가 만든 camelCase 그대로 매칭 (ExcelRow 인터페이스와 일치)
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || '').trim();
  });

  const rows: ExcelRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowData: Record<string, unknown> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        rowData[header] = cell.value;
      }
    });

    if (Object.values(rowData).some((v) => v !== null && v !== undefined && v !== '')) {
      rows.push(rowData as ExcelRow);
    }
  });

  return rows;
}

// ============================================================
// 검증
// ============================================================

export function validateRows(rows: ExcelRow[]): ValidationError[] {
  const errors: ValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const groupId = row.groupId?.toString();

    const required: Array<[keyof ExcelRow, string]> = [
      ['category', '예산(항)'],
      ['subcategory', '예산(목)'],
      ['detail', '예산(세목)'],
      ['description', '적요'],
      ['requestDate', '청구일자'],
      ['applicantName', '청구인'],
      ['bankName', '은행명'],
      ['accountNumber', '계좌번호'],
      ['accountHolder', '예금주'],
    ];

    for (const [field, label] of required) {
      if (!row[field] && row[field] !== 0) {
        errors.push({ rowNumber, groupId, field: String(field), message: `${label} 누락` });
      }
    }

    if (row.unitPrice === undefined || row.unitPrice === null || Number(row.unitPrice) <= 0) {
      errors.push({ rowNumber, groupId, field: 'unitPrice', message: '단가가 유효하지 않습니다 (0 이하)' });
    }

    if (row.quantity === undefined || row.quantity === null || Number(row.quantity) <= 0) {
      errors.push({ rowNumber, groupId, field: 'quantity', message: '수량이 유효하지 않습니다 (0 이하)' });
    }

    if (row.requestDate && !parseDate(row.requestDate)) {
      errors.push({ rowNumber, groupId, field: 'requestDate', message: `청구일자 파싱 실패: ${String(row.requestDate)}` });
    }
    if (row.expenseDate && !parseDate(row.expenseDate)) {
      errors.push({ rowNumber, groupId, field: 'expenseDate', message: `지급일자 파싱 실패: ${String(row.expenseDate)}` });
    }
  });

  return errors;
}

// ============================================================
// 그룹핑
// ============================================================

export function groupRows(rows: ExcelRow[]): Map<string, ExcelRow[]> {
  const groups = new Map<string, ExcelRow[]>();
  rows.forEach((row, index) => {
    const groupKey = row.groupId?.toString() || `__single_${index}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(row);
  });
  return groups;
}

// ============================================================
// 일괄 생성 (트랜잭션)
// ============================================================

export async function executeBulkUpload(
  rows: ExcelRow[],
  options: BulkUploadOptions
): Promise<BulkUploadResult> {
  const validationErrors = validateRows(rows);
  const groups = groupRows(rows);

  // 그룹별 예산 조회 + 청구인 조회 (사전 일괄)
  const budgetErrors: ValidationError[] = [];
  const budgetCache = new Map<string, { committee: string; department: string }>();
  const applicantCache = new Map<string, { id: string; username: string }>();
  const preview: PreviewItem[] = [];

  // 미리 청구인 이름 모두 모아 일괄 조회 (N+1 회피)
  const applicantNames = Array.from(
    new Set(
      Array.from(groups.values())
        .map((g) => g[0].applicantName?.toString().trim())
        .filter((n): n is string => !!n)
    )
  );
  if (applicantNames.length > 0) {
    const users = await prisma.user.findMany({
      where: { username: { in: applicantNames }, isActive: true },
      select: { id: true, username: true },
    });
    users.forEach((u) => applicantCache.set(u.username, u));
  }

  for (const [groupKey, groupRowsList] of groups) {
    const first = groupRowsList[0];
    const rowNumber = rows.indexOf(first) + 2;

    const cat = first.category?.toString().trim();
    const sub = first.subcategory?.toString().trim();
    const det = first.detail?.toString().trim();
    const applicantName = first.applicantName?.toString().trim();

    // 예산 조회
    let budgetInfo: { committee: string; department: string } | undefined;
    if (cat && sub && det) {
      const cacheKey = `${cat}|${sub}|${det}`;
      if (budgetCache.has(cacheKey)) {
        budgetInfo = budgetCache.get(cacheKey)!;
      } else {
        const hier = await lookupBudgetHierarchy(cat, sub, det);
        if (hier) {
          budgetInfo = { committee: hier.committee, department: hier.department };
          budgetCache.set(cacheKey, budgetInfo);
        } else {
          budgetErrors.push({
            rowNumber,
            groupId: groupKey,
            message: `예산 정보를 찾을 수 없습니다: ${cat} / ${sub} / ${det}`,
          });
          continue;
        }
      }
    } else {
      // 필수 누락은 validationErrors가 이미 처리. preview 생성만 건너뜀.
      continue;
    }

    // 청구인 조회
    if (!applicantName || !applicantCache.has(applicantName)) {
      budgetErrors.push({
        rowNumber,
        groupId: groupKey,
        field: 'applicantName',
        message: `청구인을 찾을 수 없습니다: ${applicantName ?? '(미입력)'}`,
      });
      continue;
    }

    const requestAmount = groupRowsList.reduce((sum, r) => {
      const up = Number(r.unitPrice) || 0;
      const qty = Number(r.quantity) || 0;
      return sum + up * qty;
    }, 0);

    preview.push({
      groupId: groupKey,
      committee: budgetInfo.committee,
      department: budgetInfo.department,
      applicantName,
      itemsCount: groupRowsList.length,
      requestAmount,
    });
  }

  const allErrors = [...validationErrors, ...budgetErrors];

  // dry-run: 여기서 종료
  if (options.dryRun) {
    return {
      dryRun: true,
      totalRows: rows.length,
      totalExpenses: groups.size,
      errors: allErrors,
      preview,
    };
  }

  // commit: 에러 있으면 저장 거부
  if (allErrors.length > 0) {
    return {
      dryRun: false,
      totalRows: rows.length,
      totalExpenses: groups.size,
      errors: allErrors,
    };
  }

  // 트랜잭션 일괄 생성
  const createdIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const [groupKey, groupRowsList] of groups) {
      const first = groupRowsList[0];
      const cat = first.category!.toString().trim();
      const sub = first.subcategory!.toString().trim();
      const det = first.detail!.toString().trim();
      const applicantName = first.applicantName!.toString().trim();

      const budgetInfo = budgetCache.get(`${cat}|${sub}|${det}`)!;
      const user = applicantCache.get(applicantName)!;

      const items = groupRowsList.map((r, idx) => {
        const unitPrice = Math.floor(Number(r.unitPrice));
        const quantity = Math.floor(Number(r.quantity));
        return {
          budgetCategory: r.category!.toString().trim(),
          budgetSubcategory: r.subcategory!.toString().trim(),
          budgetDetail: r.detail!.toString().trim(),
          description: r.description!.toString().trim(),
          unitPrice,
          quantity,
          amount: unitPrice * quantity,
          order: idx + 1,
        };
      });

      const requestAmount = items.reduce((sum, i) => sum + i.amount, 0);
      const requestDate = parseDate(first.requestDate)!;
      const expenseDate = parseDate(first.expenseDate);

      const expense = await tx.expense.create({
        data: {
          userId: user.id,
          committee: budgetInfo.committee,
          department: budgetInfo.department,
          expenseDate,
          requestAmount,
          requestDate,
          requestTeam: '출납팀',
          applicantName,
          applicantTitle: first.applicantTitle?.toString().trim() || null,
          bankName: first.bankName!.toString().trim(),
          accountNumber: String(first.accountNumber).trim(),
          accountHolder: first.accountHolder!.toString().trim(),
          items: { create: items },
        },
      });

      ids.push(expense.id);
      void groupKey;
    }
    return ids;
  });

  return {
    dryRun: false,
    totalRows: rows.length,
    totalExpenses: groups.size,
    errors: [],
    createdIds,
  };
}

// ============================================================
// 날짜 파싱 (Excel 시리얼 + 문자열 모두 처리)
// ============================================================

export function parseDate(value: string | Date | number | undefined | null): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}
