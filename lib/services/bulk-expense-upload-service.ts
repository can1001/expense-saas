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
import { lookupBudgetHierarchy, verifyBudgetMapping } from './budget-lookup-service';

// ============================================================
// 타입
// ============================================================

/**
 * 엑셀 컬럼 ↔ 폼/스키마 필드 매핑.
 * 청구인(applicantName/applicantTitle/userId)은 엑셀에서 받지 않고 업로드를
 * 수행하는 로그인 사용자(`applicant` 인자)에서 자동 채움 — 동명이인 문제 회피 +
 * 데이터 입력자의 실제 책임 추적.
 *
 * 은행 정보(수취 계좌)는 그대로 엑셀에서 받음 — 행마다 다른 지출자에게 송금되므로.
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
  'bankName',
  'accountNumber',
  'accountHolder',
] as const satisfies ReadonlyArray<keyof ExcelRow>;

/** 업로드 수행자 정보 — 모든 생성된 지출결의서의 청구인이 됨. */
export interface BulkUploadApplicant {
  userId: string;
  username: string;
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
      ['bankName', '은행명'],
      ['accountNumber', '계좌번호'],
      ['accountHolder', '예금주'],
    ];

    for (const [field, label] of required) {
      if (!row[field] && row[field] !== 0) {
        errors.push({ rowNumber, groupId, field: String(field), message: `${label} 누락` });
      }
    }

    // 비수치(문자) 입력은 Number()→NaN, `NaN <= 0`은 false라 우회됨 — Number.isFinite로 명시 검증
    const up = row.unitPrice === undefined || row.unitPrice === null ? NaN : Number(row.unitPrice);
    if (!Number.isFinite(up) || up <= 0) {
      errors.push({ rowNumber, groupId, field: 'unitPrice', message: '단가가 유효하지 않습니다 (양수만 허용)' });
    }

    const qty = row.quantity === undefined || row.quantity === null ? NaN : Number(row.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push({ rowNumber, groupId, field: 'quantity', message: '수량이 유효하지 않습니다 (양수만 허용)' });
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
  options: BulkUploadOptions,
  applicant: BulkUploadApplicant
): Promise<BulkUploadResult> {
  const validationErrors = validateRows(rows);
  const groups = groupRows(rows);

  // 그룹별 예산 조회 (사전 일괄)
  const budgetErrors: ValidationError[] = [];
  // 세목 조회 결과 캐시(자동 도출). 1:N인 경우 임의의 한 부서.
  const budgetCache = new Map<string, { committee: string; department: string }>();
  // 그룹별로 cross-validation 통과 후 확정된 (위원회, 사역팀) — commit 패스에서 사용.
  const resolvedByGroup = new Map<string, { committee: string; department: string }>();
  const preview: PreviewItem[] = [];

  for (const [groupKey, groupRowsList] of groups) {
    const first = groupRowsList[0];
    const rowNumber = rows.indexOf(first) + 2;

    const cat = first.budgetCategory?.toString().trim();
    const sub = first.budgetSubcategory?.toString().trim();
    const det = first.budgetDetail?.toString().trim();
    const inputCommittee = first.committee?.toString().trim();
    const inputDepartment = first.department?.toString().trim();

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

    // 입력된 (위원회, 사역팀, 세목) 조합이 실제 활성 매핑인지 검증.
    // 한 세목이 여러 부서에 매핑된 1:N 경우에도 정답 부서를 모두 인정.
    if (inputCommittee && inputDepartment) {
      const valid = await verifyBudgetMapping(
        inputCommittee,
        inputDepartment,
        cat,
        sub,
        det
      );
      if (!valid) {
        budgetErrors.push({
          rowNumber,
          groupId: groupKey,
          field: 'department',
          message: `위원회/사역팀이 해당 세목에 매핑되어 있지 않습니다: ${inputCommittee} / ${inputDepartment} / ${cat} / ${sub} / ${det}`,
        });
        continue;
      }
      // 검증 통과: 입력값을 신뢰값으로 사용 (자동 도출이 다른 부서를 반환했을 수 있음)
      budgetInfo = { committee: inputCommittee, department: inputDepartment };
    }

    // 그룹별 확정값을 별도로 저장 — commit 패스가 동일 키로 다시 조회하면
    // budgetCache의 자동 도출값(잘못된 부서일 수 있음)을 가져갈 위험이 있으므로 분리.
    resolvedByGroup.set(groupKey, budgetInfo);

    const requestAmount = groupRowsList.reduce((sum, r) => {
      const up = Number(r.unitPrice) || 0;
      const qty = Number(r.quantity) || 0;
      return sum + up * qty;
    }, 0);

    preview.push({
      groupId: groupKey,
      committee: budgetInfo.committee,
      department: budgetInfo.department,
      applicantName: applicant.username, // 모든 행 동일 — 업로드 수행자
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
      for (const [groupKey, groupRowsList] of groups) {
        const first = groupRowsList[0];

        // dry-run 패스에서 resolvedByGroup가 채워졌고 에러 0건이어야만 여기 도달.
        const budgetInfo = resolvedByGroup.get(groupKey);
        if (!budgetInfo) {
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
            userId: applicant.userId,
            committee: budgetInfo.committee,
            department: budgetInfo.department,
            expenseDate,
            requestAmount,
            requestDate,
            requestTeam: '출납팀',
            applicantName: applicant.username,
            applicantTitle: null,
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
