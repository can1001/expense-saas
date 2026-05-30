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

/**
 * 엑셀 컬럼 ↔ 폼/스키마 필드 1:1 매핑.
 * 기존 신규 작성 폼(`createExpenseSchema`)과 동일 명명 규칙 사용.
 * groupId만 일괄 업로드 전용(같은 ID는 한 지출결의서로 묶임).
 */
export interface ExcelRow {
  groupId?: string | number;
  committee?: string;            // 위원회 (필수, 자동 도출 결과와 교차 검증)
  department?: string;           // 사역팀(부) (필수, 자동 도출 결과와 교차 검증)
  budgetCategory?: string;       // 예산(항)
  budgetSubcategory?: string;    // 예산(목)
  budgetDetail?: string;         // 예산(세목)
  description?: string;          // 적요
  unitPrice?: number;
  quantity?: number;
  requestDate?: string | Date | number;
  expenseDate?: string | Date | number; // 지급일자
  applicantName?: string;
  applicantTitle?: string;
  bankName?: string;
  accountNumber?: string | number;
  accountHolder?: string;
}

/** ExcelRow의 정식 헤더 (parseExpenseExcelBuffer가 이 키들만 받는다) */
export const EXCEL_ROW_HEADERS = [
  'groupId',
  'committee',
  'department',
  'budgetCategory',
  'budgetSubcategory',
  'budgetDetail',
  'description',
  'unitPrice',
  'quantity',
  'requestDate',
  'expenseDate',
  'applicantName',
  'applicantTitle',
  'bankName',
  'accountNumber',
  'accountHolder',
] as const satisfies ReadonlyArray<keyof ExcelRow>;

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

  // 헤더는 정식 ExcelRow 키만 화이트리스트 매칭 (프로토타입 오염·오타 방지)
  const allowedHeaders = new Set<string>(EXCEL_ROW_HEADERS);
  const headerRow = worksheet.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell((cell, colNumber) => {
    const h = String(cell.value || '').trim();
    headers[colNumber - 1] = allowedHeaders.has(h) ? h : null;
  });

  const rows: ExcelRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowData: Record<string, unknown> = Object.create(null);
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
      ['committee', '위원회'],
      ['department', '사역팀(부)'],
      ['budgetCategory', '예산(항)'],
      ['budgetSubcategory', '예산(목)'],
      ['budgetDetail', '예산(세목)'],
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

    const cat = first.budgetCategory?.toString().trim();
    const sub = first.budgetSubcategory?.toString().trim();
    const det = first.budgetDetail?.toString().trim();
    const inputCommittee = first.committee?.toString().trim();
    const inputDepartment = first.department?.toString().trim();
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

    // 입력된 위원회/사역팀과 자동 도출 결과 교차 검증
    if (inputCommittee && inputCommittee !== budgetInfo.committee) {
      budgetErrors.push({
        rowNumber,
        groupId: groupKey,
        field: 'committee',
        message: `위원회 불일치: 입력 "${inputCommittee}" ≠ 예산 매핑 "${budgetInfo.committee}"`,
      });
      continue;
    }
    if (inputDepartment && inputDepartment !== budgetInfo.department) {
      budgetErrors.push({
        rowNumber,
        groupId: groupKey,
        field: 'department',
        message: `사역팀(부) 불일치: 입력 "${inputDepartment}" ≠ 예산 매핑 "${budgetInfo.department}"`,
      });
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
  const createdIds = await prisma.$transaction(
    async (tx) => {
      const ids: string[] = [];
      for (const [, groupRowsList] of groups) {
        const first = groupRowsList[0];
        const cat = first.budgetCategory!.toString().trim();
        const sub = first.budgetSubcategory!.toString().trim();
        const det = first.budgetDetail!.toString().trim();
        const applicantName = first.applicantName!.toString().trim();

        // dry-run 패스에서 budgetCache/applicantCache가 모두 채워졌고
        // 에러가 0건이어야만 여기 도달한다는 사전 불변량.
        const budgetInfo = budgetCache.get(`${cat}|${sub}|${det}`);
        const user = applicantCache.get(applicantName);
        if (!budgetInfo || !user) {
          throw new Error('내부 오류: 검증 단계에서 채워졌어야 할 캐시가 비어있습니다.');
        }

        const items = groupRowsList.map((r, idx) => {
          const unitPrice = Math.floor(Number(r.unitPrice));
          const quantity = Math.floor(Number(r.quantity));
          return {
            budgetCategory: r.budgetCategory!.toString().trim(),
            budgetSubcategory: r.budgetSubcategory!.toString().trim(),
            budgetDetail: r.budgetDetail!.toString().trim(),
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
      }
      return ids;
    },
    {
      // 500행 × 항목당 INSERT가 Neon RTT에서 5s 기본을 쉽게 넘김 — 리뷰 C1
      timeout: 120_000,
      maxWait: 10_000,
    }
  );

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
