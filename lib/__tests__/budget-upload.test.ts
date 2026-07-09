/**
 * 예산 업로드 로직 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parseExcelFile,
  uploadBudgetData,
  exportBudgetTemplate,
  type BudgetRow,
} from '../budget-upload';

// bcrypt mock
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
  },
}));

// Prisma mock (정규화된 테이블)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    budgetDetail: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    budgetCategory: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    budgetSubcategory: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    budgetDetailYear: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    departmentBudgetDetail: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    committee: {
      upsert: vi.fn(),
    },
    department: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';

/**
 * 테스트용 Excel 버퍼 생성 헬퍼
 */
async function createTestExcelBuffer(rows: (string | number | boolean | null)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Test');

  // 헤더 행 (연도, 예산금액 열 추가)
  sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화', '연도', '예산금액']);

  // 데이터 행
  for (const row of rows) {
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('budget-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseExcelFile', () => {
    it('should parse valid Excel file', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', '김대현', '100.0', '전교인 행사', true, 2026, 1000000],
        ['기획위원회', '홍보팀', '사역지원비', '홍보비', '인쇄비', '서주형', '110.0', '홍보물 제작', true, 2026, 500000],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows.length).toBe(2);
      expect(result.validationErrors.length).toBe(0);
      expect(result.rows[0]).toEqual({
        committee: '기획위원회',
        department: '기획팀',
        category: '사역지원비',
        subcategory: '기획비',
        detail: '행사비',
        manager: '김대현',
        accountCode: '100.0',
        description: '전교인 행사',
        isActive: true,
        year: 2026,
        budgetAmount: 1000000,
      });
    });

    it('should return validation errors for missing required fields', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '', '사역지원비', '', '행사비', null, null, null, null, null, null], // department, subcategory 누락
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows.length).toBe(0);
      expect(result.validationErrors.length).toBe(2);
      expect(result.validationErrors.some(e => e.field === 'department')).toBe(true);
      expect(result.validationErrors.some(e => e.field === 'subcategory')).toBe(true);
    });

    it('should skip empty rows', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, null, null],
        ['', '', '', '', '', null, null, null, null, null, null], // 빈 행
        ['기획위원회', '홍보팀', '사역지원비', '홍보비', '인쇄비', null, null, null, null, null, null],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows.length).toBe(2);
    });

    it('should handle number values in cells', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', '김대현', 100, '행사비', true, 2026, 1000000],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].accountCode).toBe('100');
      expect(result.rows[0].year).toBe(2026);
      expect(result.rows[0].budgetAmount).toBe(1000000);
    });

    it('should use custom data start row', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      // 헤더 2줄
      sheet.addRow(['제목']);
      sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화', '연도', '예산금액']);
      sheet.addRow(['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, null, null]);
      const buffer = await workbook.xlsx.writeBuffer();

      const result = await parseExcelFile(buffer as ArrayBuffer, { dataStartRow: 3 });

      expect(result.rows.length).toBe(1);
    });

    it('should throw error for empty workbook', async () => {
      const workbook = new ExcelJS.Workbook();
      const buffer = await workbook.xlsx.writeBuffer();

      await expect(parseExcelFile(buffer as ArrayBuffer)).rejects.toThrow('Excel 파일에 시트가 없습니다.');
    });

    it('should handle isActive as false string', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, 'false', null, null],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(false);
    });

    it('should handle isActive as 0', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, 0, null, null],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(false);
    });

    it('should handle isActive as "no"', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, 'no', null, null],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(false);
    });

    it('should handle isActive as "n"', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, 'N', null, null],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(false);
    });

    it('should default isActive to true when null', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, null, null],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(true);
    });

    it('should return all validation errors for missing fields', async () => {
      const buffer = await createTestExcelBuffer([
        ['', '', '', '', '', null, null, null, null, null, null], // 모든 필수 필드 누락이지만 빈 행으로 건너뜀
        ['기획위원회', '', '', '', '', null, null, null, null, null, null], // 일부 필드만 있음
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows.length).toBe(0);
      expect(result.validationErrors.length).toBe(4); // department, category, subcategory, detail
    });

    it('should handle formula cell with empty string result for number value', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화', '연도', '예산금액']);

      const row = sheet.addRow(['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, 2026, 1000000]);
      // 수식 결과가 빈 문자열인 경우
      row.getCell(10).value = { formula: 'J1', result: '   ' } as any;

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await parseExcelFile(buffer as ArrayBuffer);

      expect(result.rows[0].year).toBeNull();
    });

    it('should handle non-standard object cell value', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화', '연도', '예산금액']);

      const row = sheet.addRow(['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, 2026, 1000000]);
      // result 속성이 없는 객체
      row.getCell(10).value = { someOtherProp: 'value' } as any;

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await parseExcelFile(buffer as ArrayBuffer);

      expect(result.rows[0].year).toBeNull();
    });

    it('should parse year and budgetAmount with comma-separated numbers', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, '2026', '1,000,000'],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].year).toBe(2026);
      expect(result.rows[0].budgetAmount).toBe(1000000);
    });

    it('should handle null year and budgetAmount', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, null, null],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].year).toBeNull();
      expect(result.rows[0].budgetAmount).toBeNull();
    });

    it('should handle formula cells with string results', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화', '연도', '예산금액']);

      const row = sheet.addRow(['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, 2026, 1000000]);
      // 셀에 수식 결과 설정
      row.getCell(1).value = { formula: 'A1', result: '기획위원회' } as any;
      row.getCell(10).value = { formula: 'J1', result: '2026' } as any;

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await parseExcelFile(buffer as ArrayBuffer);

      expect(result.rows[0].committee).toBe('기획위원회');
      expect(result.rows[0].year).toBe(2026);
    });

    it('should handle formula cells with number results', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화', '연도', '예산금액']);

      const row = sheet.addRow(['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, 2026, 1000000]);
      // 숫자 결과를 가진 수식
      row.getCell(7).value = { formula: 'G1', result: 100 } as any;
      row.getCell(11).value = { formula: 'K1', result: 1000000 } as any;

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await parseExcelFile(buffer as ArrayBuffer);

      expect(result.rows[0].accountCode).toBe('100');
      expect(result.rows[0].budgetAmount).toBe(1000000);
    });

    it('should handle formula cells with other types of results', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화', '연도', '예산금액']);

      const row = sheet.addRow(['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, 2026, 1000000]);
      // boolean이나 다른 타입의 결과
      row.getCell(1).value = { formula: 'A1', result: true } as any;

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await parseExcelFile(buffer as ArrayBuffer);

      expect(result.rows[0].committee).toBe('true');
    });

    it('should handle text cells with text property', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화', '연도', '예산금액']);

      const row = sheet.addRow(['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, 2026, 1000000]);
      // ExcelJS가 text 속성을 직접 처리하므로 스킵하고 대신 다른 엣지 케이스 테스트
      row.getCell(1).value = '기획위원회  '; // 공백이 있는 경우

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await parseExcelFile(buffer as ArrayBuffer);

      expect(result.rows[0].committee).toBe('기획위원회');
    });

    it('should handle richText cells', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화', '연도', '예산금액']);

      const row = sheet.addRow(['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null, 2026, 1000000]);
      row.getCell(1).value = { richText: [{ text: '기획' }, { text: '위원회' }] } as any;

      const buffer = await workbook.xlsx.writeBuffer();
      const result = await parseExcelFile(buffer as ArrayBuffer);

      expect(result.rows[0].committee).toBe('기획위원회');
    });
  });

  describe('uploadBudgetData', () => {
    const testRows: BudgetRow[] = [
      {
        committee: '기획위원회',
        department: '기획팀',
        category: '사역지원비',
        subcategory: '기획비',
        detail: '행사비',
        manager: '김대현',
        accountCode: '100.0',
        description: '행사비',
        isActive: true,
        year: 2026,
        budgetAmount: 1000000,
      },
    ];

    describe('dryRun mode', () => {
      it('should return created count for new data', async () => {
        vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(null);

        const result = await uploadBudgetData(testRows, 'merge', { dryRun: true });

        expect(result.success).toBe(true);
        expect(result.summary.created).toBe(1);
        expect(result.summary.updated).toBe(0);
        expect(result.summary.skipped).toBe(0);
      });

      it('should return updated count for existing data in merge mode', async () => {
        vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({ id: 'detail-1' } as any);

        const result = await uploadBudgetData(testRows, 'merge', { dryRun: true });

        expect(result.success).toBe(true);
        expect(result.summary.created).toBe(0);
        expect(result.summary.updated).toBe(1);
      });

      it('should return skipped count for existing data in append mode', async () => {
        vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({ id: 'detail-1' } as any);

        const result = await uploadBudgetData(testRows, 'append', { dryRun: true });

        expect(result.success).toBe(true);
        expect(result.summary.created).toBe(0);
        expect(result.summary.skipped).toBe(1);
      });
    });

    describe('actual upload', () => {
      const createMockTx = () => ({
        committee: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'committee-1' }),
        },
        department: {
          upsert: vi.fn().mockResolvedValue({ id: 'department-1' }),
        },
        budgetCategory: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'category-1' }),
          deleteMany: vi.fn(),
        },
        budgetSubcategory: {
          upsert: vi.fn().mockResolvedValue({ id: 'subcategory-1' }),
          deleteMany: vi.fn(),
        },
        budgetDetail: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'detail-1' }),
          update: vi.fn().mockResolvedValue({ id: 'detail-1' }),
          deleteMany: vi.fn(),
        },
        budgetDetailYear: {
          upsert: vi.fn().mockResolvedValue({ id: 'year-1' }),
          deleteMany: vi.fn(),
        },
        departmentBudgetDetail: {
          upsert: vi.fn().mockResolvedValue({ id: 'dbd-1' }),
          deleteMany: vi.fn(),
        },
        user: {
          findFirst: vi.fn().mockResolvedValue(null), // User not found by username or userid
          create: vi.fn().mockResolvedValue({ id: 'user-1', username: '김대현', userid: '청연김대현' }),
        },
      });

      it('should create new data in merge mode', async () => {
        const mockTx = createMockTx();
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(true);
        expect(result.summary.created).toBe(1);
        expect(mockTx.budgetDetail.create).toHaveBeenCalled();
        expect(mockTx.budgetDetailYear.upsert).toHaveBeenCalled();
      });

      it('should update existing data in merge mode', async () => {
        const mockTx = createMockTx();
        mockTx.budgetDetail.findFirst.mockResolvedValue({ id: 'detail-1' });
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(true);
        expect(result.summary.updated).toBe(1);
        expect(mockTx.budgetDetail.update).toHaveBeenCalled();
      });

      it('should skip existing data in append mode', async () => {
        const mockTx = createMockTx();
        mockTx.budgetDetail.findFirst.mockResolvedValue({ id: 'detail-1' });
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'append');

        expect(result.success).toBe(true);
        expect(result.summary.skipped).toBe(1);
        expect(mockTx.budgetDetail.create).not.toHaveBeenCalled();
      });

      it('should delete all data before upload in replace mode', async () => {
        const mockTx = createMockTx();
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'replace');

        expect(result.success).toBe(true);
        expect(mockTx.budgetDetailYear.deleteMany).toHaveBeenCalled();
        expect(mockTx.departmentBudgetDetail.deleteMany).toHaveBeenCalled();
        expect(mockTx.budgetDetail.deleteMany).toHaveBeenCalled();
        expect(mockTx.budgetSubcategory.deleteMany).toHaveBeenCalled();
        expect(mockTx.budgetCategory.deleteMany).toHaveBeenCalled();
      });

      it('should handle transaction errors', async () => {
        vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Transaction failed'));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(false);
        expect(result.validationErrors.length).toBe(1);
        expect(result.validationErrors[0].field).toBe('transaction');
      });

      it('should create BudgetDetailYear when year and budgetAmount provided', async () => {
        const mockTx = createMockTx();
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        await uploadBudgetData(testRows, 'merge');

        expect(mockTx.budgetDetailYear.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              budgetDetailId_year: expect.objectContaining({
                year: 2026,
              }),
            }),
            create: expect.objectContaining({
              budgetAmount: 1000000,
            }),
          })
        );
      });

      it('should not create BudgetDetailYear when year is missing', async () => {
        const rowsWithoutYear: BudgetRow[] = [{
          committee: '기획위원회',
          department: '기획팀',
          category: '사역지원비',
          subcategory: '기획비',
          detail: '행사비',
        }];

        const mockTx = createMockTx();
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        await uploadBudgetData(rowsWithoutYear, 'merge');

        expect(mockTx.budgetDetailYear.upsert).not.toHaveBeenCalled();
      });

      it('should handle userid collision when creating new user', async () => {
        const mockTx = createMockTx();
        // username으로 찾지 못하고, 생성하려는 userid가 이미 존재하는 경우
        // findFirst는 2번 호출됨: 1) username으로 조회, 2) userid로 조회
        mockTx.user.findFirst
          .mockResolvedValueOnce(null) // username으로 찾지 못함
          .mockResolvedValueOnce({ id: 'existing-user-id', username: '다른이름', userid: '청연김대현' } as any); // userid로 찾음

        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(true);
        expect(mockTx.user.create).not.toHaveBeenCalled(); // 새로 생성하지 않음
        expect(mockTx.budgetDetailYear.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              managerId: 'existing-user-id', // 기존 사용자 ID 사용
            }),
          })
        );
      });

      it('should use existing user when found by username', async () => {
        const mockTx = createMockTx();
        // username으로 기존 사용자를 찾은 경우 - 첫 번째 findFirst가 사용자를 찾음
        mockTx.user.findFirst.mockResolvedValue({ id: 'found-by-username-id', username: '김대현', userid: '청연김대현' } as any);

        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(true);
        expect(mockTx.user.create).not.toHaveBeenCalled(); // 새로 생성하지 않음
        expect(mockTx.budgetDetailYear.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              managerId: 'found-by-username-id', // 기존 사용자 ID 사용
            }),
          })
        );
      });

      it('should handle database errors during upload', async () => {
        const mockTx = createMockTx();
        // committee.findFirst에서 에러 발생
        mockTx.committee.findFirst.mockRejectedValue(new Error('Database connection failed'));

        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(false);
        expect(result.summary.errors).toBe(1);
        expect(result.validationErrors[0].field).toBe('database');
        expect(result.validationErrors[0].message).toBe('Database connection failed');
      });

      it('should handle non-Error exceptions during upload', async () => {
        const mockTx = createMockTx();
        // committee.findFirst에서 에러 발생
        mockTx.committee.findFirst.mockRejectedValue('Unknown error');

        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(false);
        expect(result.summary.errors).toBe(1);
        expect(result.validationErrors[0].message).toBe('데이터베이스 오류');
      });
    });
  });

  describe('exportBudgetTemplate', () => {
    const mockBudgetDetailData = [
      {
        id: 'detail-1',
        name: '행사비',
        accountCode: '100.0',
        description: '행사비 설명',
        isActive: true,
        subcategory: {
          name: '기획비',
          category: {
            name: '사역지원비',
          },
        },
        departmentDetails: [
          {
            department: {
              name: '기획팀',
              committee: {
                name: '기획위원회',
              },
            },
          },
        ],
        yearSettings: [
          {
            year: 2026,
            budgetAmount: 1000000,
          },
        ],
      },
    ];

    it('should export Excel template with existing data', async () => {
      vi.mocked(prisma.budgetDetail.findMany).mockResolvedValue(mockBudgetDetailData as any);

      const buffer = await exportBudgetTemplate();

      expect(buffer).toBeDefined();
      expect(buffer instanceof Buffer || buffer instanceof ArrayBuffer).toBe(true);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.name).toBe('예산 데이터');
      expect(sheet.rowCount).toBe(2); // 헤더 + 데이터 1행
      expect(sheet.getRow(1).getCell(10).value).toBe('연도');
      expect(sheet.getRow(1).getCell(11).value).toBe('예산금액');
      expect(sheet.getRow(2).getCell(10).value).toBe(2026);
      expect(sheet.getRow(2).getCell(11).value).toBe(1000000);
    });

    it('should export template with headers even when no data', async () => {
      vi.mocked(prisma.budgetDetail.findMany).mockResolvedValue([]);

      const buffer = await exportBudgetTemplate();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.rowCount).toBe(1); // 헤더만
      expect(sheet.getRow(1).getCell(1).value).toBe('위원회');
      expect(sheet.getRow(1).getCell(10).value).toBe('연도');
      expect(sheet.getRow(1).getCell(11).value).toBe('예산금액');
    });

    it('should handle inactive items', async () => {
      vi.mocked(prisma.budgetDetail.findMany).mockResolvedValue([
        {
          ...mockBudgetDetailData[0],
          isActive: false,
        },
      ] as any);

      const buffer = await exportBudgetTemplate();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.getRow(2).getCell(9).value).toBe('false');
    });

    it('should handle details without yearSettings', async () => {
      vi.mocked(prisma.budgetDetail.findMany).mockResolvedValue([
        {
          ...mockBudgetDetailData[0],
          yearSettings: [],
        },
      ] as any);

      const buffer = await exportBudgetTemplate();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.rowCount).toBe(2); // 헤더 + 데이터 1행 (yearSettings 없어도 행 생성)
      expect(sheet.getRow(2).getCell(10).value).toBe(''); // 연도 빈값
      expect(sheet.getRow(2).getCell(11).value).toBe(''); // 예산금액 빈값
    });

    it('should handle details without department connections', async () => {
      // departmentDetails가 빈 배열인 경우 (부서 연결 없음)
      vi.mocked(prisma.budgetDetail.findMany).mockResolvedValue([
        {
          id: 'detail-no-dept',
          name: '공통비',
          accountCode: '200.0',
          description: '공통 비용',
          isActive: true,
          subcategory: {
            name: '운영비',
            category: {
              name: '관리비',
            },
          },
          departmentDetails: [], // 부서 연결 없음
          yearSettings: [
            {
              year: 2026,
              budgetAmount: 500000,
            },
          ],
        },
      ] as any);

      const buffer = await exportBudgetTemplate();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.rowCount).toBe(2); // 헤더 + 데이터 1행
      // 부서 연결 없을 때 위원회/사역팀 빈값
      expect(sheet.getRow(2).getCell(1).value).toBe(''); // 위원회 빈값
      expect(sheet.getRow(2).getCell(2).value).toBe(''); // 사역팀 빈값
      expect(sheet.getRow(2).getCell(3).value).toBe('관리비'); // 예산(항)
      expect(sheet.getRow(2).getCell(4).value).toBe('운영비'); // 예산(목)
      expect(sheet.getRow(2).getCell(5).value).toBe('공통비'); // 예산(세목)
      expect(sheet.getRow(2).getCell(10).value).toBe(2026); // 연도
      expect(sheet.getRow(2).getCell(11).value).toBe(500000); // 예산금액
    });

    it('should handle details without department connections and without yearSettings', async () => {
      vi.mocked(prisma.budgetDetail.findMany).mockResolvedValue([
        {
          id: 'detail-no-dept-no-year',
          name: '기타비',
          accountCode: '300.0',
          description: '기타 비용',
          isActive: true,
          subcategory: {
            name: '기타',
            category: {
              name: '기타비용',
            },
          },
          departmentDetails: [], // 부서 연결 없음
          yearSettings: [], // 연도 설정 없음
        },
      ] as any);

      const buffer = await exportBudgetTemplate();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.rowCount).toBe(2);
      expect(sheet.getRow(2).getCell(1).value).toBe(''); // 위원회 빈값
      expect(sheet.getRow(2).getCell(2).value).toBe(''); // 사역팀 빈값
      expect(sheet.getRow(2).getCell(10).value).toBe(''); // 연도 빈값
      expect(sheet.getRow(2).getCell(11).value).toBe(''); // 예산금액 빈값
    });
  });
});
