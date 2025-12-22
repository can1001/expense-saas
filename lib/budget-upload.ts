/**
 * 예산 마스터 데이터 업로드 로직
 *
 * Excel 파일을 파싱하여 BudgetMaster 테이블에 업로드합니다.
 */

import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';

/**
 * 업로드 모드
 */
export type UploadMode = 'replace' | 'merge' | 'append';

/**
 * 예산 데이터 행
 */
export interface BudgetRow {
  committee: string;
  department: string;
  category: string;
  subcategory: string;
  detail: string;
  manager?: string | null;
  accountCode?: string | null;
  description?: string | null;
  isActive?: boolean;
}

/**
 * 검증 에러
 */
export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

/**
 * 업로드 결과 요약
 */
export interface UploadSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * 업로드 결과
 */
export interface UploadResult {
  success: boolean;
  summary: UploadSummary;
  validationErrors: ValidationError[];
}

/**
 * Excel 열 매핑 (1-based index)
 */
const COLUMN_MAPPING = {
  committee: 1,      // A열: 위원회
  department: 2,     // B열: 사역팀(부)
  category: 3,       // C열: 예산(항)
  subcategory: 4,    // D열: 예산(목)
  detail: 5,         // E열: 예산(세목)
  manager: 6,        // F열: 담당자 (선택)
  accountCode: 7,    // G열: 계정코드 (선택)
  description: 8,    // H열: 항목 내역 (선택)
  isActive: 9,       // I열: 활성화 여부 (선택, 기본값 true)
};

/**
 * 셀 값을 문자열로 변환
 */
function getCellValueAsString(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell || cell.value === null || cell.value === undefined) {
    return null;
  }

  const value = cell.value;

  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'object' && 'text' in value) {
    return (value as { text: string }).text?.trim() || null;
  }

  if (typeof value === 'object' && 'richText' in value) {
    const richText = value as { richText: Array<{ text: string }> };
    return richText.richText.map((t) => t.text).join('').trim() || null;
  }

  return String(value).trim() || null;
}

/**
 * 셀 값을 boolean으로 변환
 */
function getCellValueAsBoolean(cell: ExcelJS.Cell | undefined): boolean {
  if (!cell || cell.value === null || cell.value === undefined) {
    return true; // 기본값 true
  }

  const value = cell.value;

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower !== 'false' && lower !== '0' && lower !== 'no' && lower !== 'n';
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return true;
}

/**
 * 행 데이터 파싱
 */
function parseRow(row: ExcelJS.Row, rowNumber: number): { data: BudgetRow | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  const committee = getCellValueAsString(row.getCell(COLUMN_MAPPING.committee));
  const department = getCellValueAsString(row.getCell(COLUMN_MAPPING.department));
  const category = getCellValueAsString(row.getCell(COLUMN_MAPPING.category));
  const subcategory = getCellValueAsString(row.getCell(COLUMN_MAPPING.subcategory));
  const detail = getCellValueAsString(row.getCell(COLUMN_MAPPING.detail));

  // 필수 필드 검증
  if (!committee) {
    errors.push({ row: rowNumber, field: 'committee', message: '위원회는 필수입니다.' });
  }
  if (!department) {
    errors.push({ row: rowNumber, field: 'department', message: '사역팀(부)은 필수입니다.' });
  }
  if (!category) {
    errors.push({ row: rowNumber, field: 'category', message: '예산(항)은 필수입니다.' });
  }
  if (!subcategory) {
    errors.push({ row: rowNumber, field: 'subcategory', message: '예산(목)은 필수입니다.' });
  }
  if (!detail) {
    errors.push({ row: rowNumber, field: 'detail', message: '예산(세목)은 필수입니다.' });
  }

  if (errors.length > 0) {
    return { data: null, errors };
  }

  return {
    data: {
      committee: committee!,
      department: department!,
      category: category!,
      subcategory: subcategory!,
      detail: detail!,
      manager: getCellValueAsString(row.getCell(COLUMN_MAPPING.manager)),
      accountCode: getCellValueAsString(row.getCell(COLUMN_MAPPING.accountCode)),
      description: getCellValueAsString(row.getCell(COLUMN_MAPPING.description)),
      isActive: getCellValueAsBoolean(row.getCell(COLUMN_MAPPING.isActive)),
    },
    errors: [],
  };
}

/**
 * Excel 파일 파싱
 */
export async function parseExcelFile(
  buffer: ArrayBuffer,
  options?: {
    headerRow?: number; // 헤더 행 번호 (기본값: 1)
    dataStartRow?: number; // 데이터 시작 행 번호 (기본값: 2)
  }
): Promise<{ rows: BudgetRow[]; validationErrors: ValidationError[] }> {
  const { headerRow = 1, dataStartRow = 2 } = options ?? {};

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('Excel 파일에 시트가 없습니다.');
  }

  const rows: BudgetRow[] = [];
  const validationErrors: ValidationError[] = [];

  // 데이터 행 파싱
  for (let rowNum = dataStartRow; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);

    // 빈 행 건너뛰기
    const firstCell = getCellValueAsString(row.getCell(COLUMN_MAPPING.committee));
    if (!firstCell) {
      continue;
    }

    const { data, errors } = parseRow(row, rowNum);
    if (data) {
      rows.push(data);
    }
    validationErrors.push(...errors);
  }

  return { rows, validationErrors };
}

/**
 * 예산 데이터 업로드
 */
export async function uploadBudgetData(
  rows: BudgetRow[],
  mode: UploadMode,
  options?: {
    dryRun?: boolean; // true면 실제 DB 변경 없이 검증만 수행
  }
): Promise<UploadResult> {
  const { dryRun = false } = options ?? {};

  const summary: UploadSummary = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };
  const validationErrors: ValidationError[] = [];

  if (dryRun) {
    // Dry run: 중복 체크만 수행
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const existing = await prisma.budgetMaster.findUnique({
        where: {
          committee_department_category_subcategory_detail: {
            committee: row.committee,
            department: row.department,
            category: row.category,
            subcategory: row.subcategory,
            detail: row.detail,
          },
        },
      });

      if (existing) {
        if (mode === 'append') {
          summary.skipped++;
        } else {
          summary.updated++;
        }
      } else {
        summary.created++;
      }
    }

    return { success: true, summary, validationErrors };
  }

  // 실제 업로드
  try {
    await prisma.$transaction(async (tx) => {
      // replace 모드: 기존 데이터 모두 삭제
      if (mode === 'replace') {
        await tx.budgetMaster.deleteMany();
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        try {
          const existing = await tx.budgetMaster.findUnique({
            where: {
              committee_department_category_subcategory_detail: {
                committee: row.committee,
                department: row.department,
                category: row.category,
                subcategory: row.subcategory,
                detail: row.detail,
              },
            },
          });

          if (existing) {
            if (mode === 'append') {
              // append 모드: 기존 데이터 건너뛰기
              summary.skipped++;
            } else {
              // merge 모드: 기존 데이터 업데이트
              await tx.budgetMaster.update({
                where: { id: existing.id },
                data: {
                  manager: row.manager,
                  accountCode: row.accountCode,
                  description: row.description,
                  isActive: row.isActive ?? true,
                },
              });
              summary.updated++;
            }
          } else {
            // 새 데이터 생성
            await tx.budgetMaster.create({
              data: {
                committee: row.committee,
                department: row.department,
                category: row.category,
                subcategory: row.subcategory,
                detail: row.detail,
                manager: row.manager,
                accountCode: row.accountCode,
                description: row.description,
                isActive: row.isActive ?? true,
              },
            });
            summary.created++;
          }
        } catch (err) {
          summary.errors++;
          validationErrors.push({
            row: i + 2, // Excel 행 번호 (헤더 1행 + 0-based index)
            field: 'database',
            message: err instanceof Error ? err.message : '데이터베이스 오류',
          });
        }
      }
    });

    return {
      success: summary.errors === 0,
      summary,
      validationErrors,
    };
  } catch (err) {
    return {
      success: false,
      summary: { ...summary, errors: rows.length },
      validationErrors: [
        {
          row: 0,
          field: 'transaction',
          message: err instanceof Error ? err.message : '트랜잭션 오류',
        },
      ],
    };
  }
}

/**
 * 예산 데이터를 Excel 템플릿으로 내보내기
 */
export async function exportBudgetTemplate(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('예산 데이터');

  // 헤더 설정
  sheet.columns = [
    { header: '위원회', key: 'committee', width: 20 },
    { header: '사역팀(부)', key: 'department', width: 20 },
    { header: '예산(항)', key: 'category', width: 20 },
    { header: '예산(목)', key: 'subcategory', width: 20 },
    { header: '예산(세목)', key: 'detail', width: 25 },
    { header: '담당자', key: 'manager', width: 15 },
    { header: '계정코드', key: 'accountCode', width: 15 },
    { header: '항목 내역', key: 'description', width: 40 },
    { header: '활성화', key: 'isActive', width: 10 },
  ];

  // 헤더 스타일
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // 기존 데이터 조회 및 추가
  const existingData = await prisma.budgetMaster.findMany({
    orderBy: [
      { committee: 'asc' },
      { department: 'asc' },
      { category: 'asc' },
      { subcategory: 'asc' },
      { detail: 'asc' },
    ],
  });

  for (const item of existingData) {
    sheet.addRow({
      committee: item.committee,
      department: item.department,
      category: item.category,
      subcategory: item.subcategory,
      detail: item.detail,
      manager: item.manager || '',
      accountCode: item.accountCode || '',
      description: item.description || '',
      isActive: item.isActive ? 'true' : 'false',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
