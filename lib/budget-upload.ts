/**
 * 예산 데이터 업로드 로직 (정규화 테이블 기반)
 *
 * Excel 파일을 파싱하여 정규화된 예산 테이블에 업로드합니다.
 * - Committee, Department, BudgetCategory, BudgetSubcategory, BudgetDetail
 * - DepartmentBudgetDetail (부서-세목 연결)
 */

import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
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
  year?: number | null;          // 연도
  budgetAmount?: number | null;  // 예산금액
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
  year: 10,          // J열: 연도 (선택)
  budgetAmount: 11,  // K열: 예산금액 (선택)
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

  // 수식 셀 처리 (formula 또는 sharedFormula가 있는 경우)
  if (typeof value === 'object' && 'result' in value) {
    const formulaValue = value as { result: unknown };
    if (typeof formulaValue.result === 'string') {
      return formulaValue.result.trim() || null;
    }
    if (typeof formulaValue.result === 'number') {
      return String(formulaValue.result);
    }
    return formulaValue.result ? String(formulaValue.result).trim() : null;
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
 * 셀 값을 숫자로 변환
 */
function getCellValueAsNumber(cell: ExcelJS.Cell | undefined): number | null {
  if (!cell || cell.value === null || cell.value === undefined) {
    return null;
  }

  const value = cell.value;

  // 숫자 타입
  if (typeof value === 'number') {
    return Math.floor(value);
  }

  // 문자열 타입 (숫자 문자열)
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, ''); // 콤마 제거
    if (trimmed === '') {
      return null;
    }
    const parsed = parseInt(trimmed, 10);
    return isNaN(parsed) ? null : parsed;
  }

  // 수식 결과 객체
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as { result: unknown }).result;
    if (typeof result === 'number') {
      return Math.floor(result);
    }
    // 수식 결과가 문자열인 경우도 처리
    if (typeof result === 'string') {
      const trimmed = result.trim().replace(/,/g, '');
      if (trimmed === '') {
        return null;
      }
      const parsed = parseInt(trimmed, 10);
      return isNaN(parsed) ? null : parsed;
    }
  }

  return null;
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
      year: getCellValueAsNumber(row.getCell(COLUMN_MAPPING.year)),
      budgetAmount: getCellValueAsNumber(row.getCell(COLUMN_MAPPING.budgetAmount)),
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
  const { dataStartRow = 2 } = options ?? {};

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
 * 예산 데이터 업로드 (정규화 테이블)
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

      // BudgetDetail 존재 여부 확인
      const existing = await prisma.budgetDetail.findFirst({
        where: {
          name: row.detail,
          subcategory: {
            name: row.subcategory,
            category: {
              name: row.category,
            },
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
      // replace 모드: 관계 테이블 초기화
      if (mode === 'replace') {
        await tx.budgetDetailYear.deleteMany();  // 연도별 설정 먼저 삭제
        await tx.departmentBudgetDetail.deleteMany();
        await tx.budgetDetail.deleteMany();
        await tx.budgetSubcategory.deleteMany();
        await tx.budgetCategory.deleteMany();
        // Committee, Department는 유지 (다른 곳에서 참조될 수 있음)
      }

      // 캐시 맵 (성능 최적화)
      const committeeCache = new Map<string, string>();
      const departmentCache = new Map<string, string>();
      const categoryCache = new Map<string, string>();
      const subcategoryCache = new Map<string, string>();
      const userCache = new Map<string, string>(); // username -> userId

      // 기본 비밀번호 해시 (새 사용자 생성 시 사용)
      const defaultPasswordHash = await bcrypt.hash('chc2026', 10);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        try {
          // 1. Committee find or create
          let committeeId = committeeCache.get(row.committee);
          if (!committeeId) {
            let committee = await tx.committee.findFirst({
              where: { name: row.committee },
            });
            if (!committee) {
              committee = await tx.committee.create({
                data: { name: row.committee, isActive: true },
              });
            }
            committeeId = committee.id;
            committeeCache.set(row.committee, committeeId);
          }

          // 2. Department upsert
          const deptKey = `${row.committee}|${row.department}`;
          let departmentId = departmentCache.get(deptKey);
          if (!departmentId) {
            const department = await tx.department.upsert({
              where: {
                committeeId_name: {
                  committeeId,
                  name: row.department,
                },
              },
              update: {},
              create: {
                committeeId,
                name: row.department,
                isActive: true,
              },
            });
            departmentId = department.id;
            departmentCache.set(deptKey, departmentId);
          }

          // 3. BudgetCategory find or create
          let categoryId = categoryCache.get(row.category);
          if (!categoryId) {
            let category = await tx.budgetCategory.findFirst({
              where: { name: row.category },
            });
            if (!category) {
              category = await tx.budgetCategory.create({
                data: { name: row.category, isActive: true },
              });
            }
            categoryId = category.id;
            categoryCache.set(row.category, categoryId);
          }

          // 4. BudgetSubcategory upsert
          const subcatKey = `${row.category}|${row.subcategory}`;
          let subcategoryId = subcategoryCache.get(subcatKey);
          if (!subcategoryId) {
            const subcategory = await tx.budgetSubcategory.upsert({
              where: {
                categoryId_name: {
                  categoryId,
                  name: row.subcategory,
                },
              },
              update: {},
              create: {
                categoryId,
                name: row.subcategory,
                isActive: true,
              },
            });
            subcategoryId = subcategory.id;
            subcategoryCache.set(subcatKey, subcategoryId);
          }

          // 5. BudgetDetail upsert
          const existingDetail = await tx.budgetDetail.findFirst({
            where: {
              subcategoryId,
              name: row.detail,
            },
          });

          let budgetDetailId: string;

          if (existingDetail) {
            if (mode === 'append') {
              summary.skipped++;
              continue;
            }
            // merge: 업데이트
            await tx.budgetDetail.update({
              where: { id: existingDetail.id },
              data: {
                accountCode: row.accountCode,
                description: row.description,
                isActive: row.isActive ?? true,
              },
            });
            budgetDetailId = existingDetail.id;
            summary.updated++;
          } else {
            // 새로 생성
            const newDetail = await tx.budgetDetail.create({
              data: {
                subcategoryId,
                name: row.detail,
                accountCode: row.accountCode,
                description: row.description,
                isActive: row.isActive ?? true,
              },
            });
            budgetDetailId = newDetail.id;
            summary.created++;
          }

          // 6. DepartmentBudgetDetail 연결 (upsert)
          await tx.departmentBudgetDetail.upsert({
            where: {
              departmentId_budgetDetailId: {
                departmentId,
                budgetDetailId,
              },
            },
            update: { isActive: true },
            create: {
              departmentId,
              budgetDetailId,
              isActive: true,
            },
          });

          // 7. 담당자(User) 조회 또는 생성
          let managerId: string | null = null;
          if (row.manager) {
            // 캐시에서 먼저 확인
            managerId = userCache.get(row.manager) || null;

            if (!managerId) {
              // DB에서 username으로 조회
              const existingUser = await tx.user.findFirst({
                where: { username: row.manager },
              });

              if (existingUser) {
                managerId = existingUser.id;
              } else {
                // 새 User 생성
                // userid: "청연" + username (예: "청연홍길동")
                const userid = `청연${row.manager}`;

                // userid 중복 확인
                const existingByUserid = await tx.user.findFirst({
                  where: { userid },
                });

                if (existingByUserid) {
                  // userid가 이미 있으면 해당 사용자 사용
                  managerId = existingByUserid.id;
                } else {
                  // 새 사용자 생성
                  const newUser = await tx.user.create({
                    data: {
                      userid,
                      username: row.manager,
                      password: defaultPasswordHash,
                      role: 'user',
                      isActive: true,
                    },
                  });
                  managerId = newUser.id;
                }
              }

              // 캐시에 저장
              userCache.set(row.manager, managerId);
            }
          }

          // 8. BudgetDetailYear upsert (연도별 예산금액 + 담당자)
          if (row.year) {
            await tx.budgetDetailYear.upsert({
              where: {
                budgetDetailId_year: {
                  budgetDetailId,
                  year: row.year,
                },
              },
              update: {
                budgetAmount: row.budgetAmount ?? 0,
                managerId: managerId,
                isActive: true,
              },
              create: {
                budgetDetailId,
                year: row.year,
                budgetAmount: row.budgetAmount ?? 0,
                managerId: managerId,
                isActive: true,
              },
            });
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
    }, {
      timeout: 300000, // 5분 타임아웃 (대용량 업로드 대비)
      maxWait: 10000,  // 최대 대기 시간 10초
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
 * 예산 데이터를 Excel 템플릿으로 내보내기 (정규화 테이블)
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
    { header: '연도', key: 'year', width: 10 },
    { header: '예산금액', key: 'budgetAmount', width: 15 },
  ];

  // 헤더 스타일
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // 정규화된 테이블에서 데이터 조회
  const budgetDetails = await prisma.budgetDetail.findMany({
    include: {
      subcategory: {
        include: {
          category: true,
        },
      },
      departmentDetails: {
        include: {
          department: {
            include: {
              committee: true,
            },
          },
        },
      },
      yearSettings: {
        orderBy: {
          year: 'desc',
        },
      },
    },
    orderBy: [
      { subcategory: { category: { name: 'asc' } } },
      { subcategory: { name: 'asc' } },
      { name: 'asc' },
    ],
  });

  // 데이터 행 추가
  for (const detail of budgetDetails) {
    // 연도별 예산 설정 (없으면 빈 배열로 처리)
    const yearSettings = detail.yearSettings.length > 0 ? detail.yearSettings : [null];

    // 각 부서 연결별로 행 추가
    if (detail.departmentDetails.length > 0) {
      for (const dd of detail.departmentDetails) {
        for (const ys of yearSettings) {
          sheet.addRow({
            committee: dd.department.committee.name,
            department: dd.department.name,
            category: detail.subcategory.category.name,
            subcategory: detail.subcategory.name,
            detail: detail.name,
            manager: '',
            accountCode: detail.accountCode || '',
            description: detail.description || '',
            isActive: detail.isActive ? 'true' : 'false',
            year: ys?.year || '',
            budgetAmount: ys?.budgetAmount || '',
          });
        }
      }
    } else {
      // 부서 연결이 없는 경우
      for (const ys of yearSettings) {
        sheet.addRow({
          committee: '',
          department: '',
          category: detail.subcategory.category.name,
          subcategory: detail.subcategory.name,
          detail: detail.name,
          manager: '',
          accountCode: detail.accountCode || '',
          description: detail.description || '',
          isActive: detail.isActive ? 'true' : 'false',
          year: ys?.year || '',
          budgetAmount: ys?.budgetAmount || '',
        });
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
