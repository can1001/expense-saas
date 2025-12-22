/**
 * 예산 업로드 로직 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parseExcelFile,
  uploadBudgetData,
  exportBudgetTemplate,
  type BudgetRow,
  type UploadMode,
} from '../budget-upload';

// Prisma mock
vi.mock('@/lib/prisma', () => ({
  prisma: {
    budgetMaster: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
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

  // 헤더 행
  sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화']);

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
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', '김대현', '100.0', '전교인 행사', true],
        ['기획위원회', '홍보팀', '사역지원비', '홍보비', '인쇄비', '서주형', '110.0', '홍보물 제작', true],
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
      });
    });

    it('should return validation errors for missing required fields', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '', '사역지원비', '', '행사비', null, null, null, null], // department, subcategory 누락
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows.length).toBe(0);
      expect(result.validationErrors.length).toBe(2);
      expect(result.validationErrors.some(e => e.field === 'department')).toBe(true);
      expect(result.validationErrors.some(e => e.field === 'subcategory')).toBe(true);
    });

    it('should skip empty rows', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null],
        ['', '', '', '', '', null, null, null, null], // 빈 행
        ['기획위원회', '홍보팀', '사역지원비', '홍보비', '인쇄비', null, null, null, null],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows.length).toBe(2);
    });

    it('should handle number values in cells', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', '김대현', 100, '행사비', true],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].accountCode).toBe('100');
    });

    it('should use custom data start row', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      // 헤더 2줄
      sheet.addRow(['제목']);
      sheet.addRow(['위원회', '사역팀(부)', '예산(항)', '예산(목)', '예산(세목)', '담당자', '계정코드', '항목 내역', '활성화']);
      sheet.addRow(['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null]);
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
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, 'false'],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(false);
    });

    it('should handle isActive as 0', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, 0],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(false);
    });

    it('should handle isActive as "no"', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, 'no'],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(false);
    });

    it('should handle isActive as "n"', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, 'N'],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(false);
    });

    it('should default isActive to true when null', async () => {
      const buffer = await createTestExcelBuffer([
        ['기획위원회', '기획팀', '사역지원비', '기획비', '행사비', null, null, null, null],
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows[0].isActive).toBe(true);
    });

    it('should return all validation errors for missing fields', async () => {
      const buffer = await createTestExcelBuffer([
        ['', '', '', '', '', null, null, null, null], // 모든 필수 필드 누락이지만 빈 행으로 건너뜀
        ['기획위원회', '', '', '', '', null, null, null, null], // 일부 필드만 있음
      ]);

      const result = await parseExcelFile(buffer);

      expect(result.rows.length).toBe(0);
      expect(result.validationErrors.length).toBe(4); // department, category, subcategory, detail
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
      },
    ];

    describe('dryRun mode', () => {
      it('should return created count for new data', async () => {
        vi.mocked(prisma.budgetMaster.findUnique).mockResolvedValue(null);

        const result = await uploadBudgetData(testRows, 'merge', { dryRun: true });

        expect(result.success).toBe(true);
        expect(result.summary.created).toBe(1);
        expect(result.summary.updated).toBe(0);
        expect(result.summary.skipped).toBe(0);
      });

      it('should return updated count for existing data in merge mode', async () => {
        vi.mocked(prisma.budgetMaster.findUnique).mockResolvedValue({ id: '1' } as any);

        const result = await uploadBudgetData(testRows, 'merge', { dryRun: true });

        expect(result.success).toBe(true);
        expect(result.summary.created).toBe(0);
        expect(result.summary.updated).toBe(1);
      });

      it('should return skipped count for existing data in append mode', async () => {
        vi.mocked(prisma.budgetMaster.findUnique).mockResolvedValue({ id: '1' } as any);

        const result = await uploadBudgetData(testRows, 'append', { dryRun: true });

        expect(result.success).toBe(true);
        expect(result.summary.created).toBe(0);
        expect(result.summary.skipped).toBe(1);
      });
    });

    describe('actual upload', () => {
      it('should create new data in merge mode', async () => {
        const mockTx = {
          budgetMaster: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: '1' }),
            deleteMany: vi.fn(),
          },
        };
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(true);
        expect(result.summary.created).toBe(1);
        expect(mockTx.budgetMaster.create).toHaveBeenCalled();
      });

      it('should update existing data in merge mode', async () => {
        const mockTx = {
          budgetMaster: {
            findUnique: vi.fn().mockResolvedValue({ id: '1' }),
            update: vi.fn().mockResolvedValue({ id: '1' }),
            deleteMany: vi.fn(),
          },
        };
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(true);
        expect(result.summary.updated).toBe(1);
        expect(mockTx.budgetMaster.update).toHaveBeenCalled();
      });

      it('should skip existing data in append mode', async () => {
        const mockTx = {
          budgetMaster: {
            findUnique: vi.fn().mockResolvedValue({ id: '1' }),
            create: vi.fn(),
            deleteMany: vi.fn(),
          },
        };
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'append');

        expect(result.success).toBe(true);
        expect(result.summary.skipped).toBe(1);
        expect(mockTx.budgetMaster.create).not.toHaveBeenCalled();
      });

      it('should delete all data before upload in replace mode', async () => {
        const mockTx = {
          budgetMaster: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: '1' }),
            deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
          },
        };
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'replace');

        expect(result.success).toBe(true);
        expect(mockTx.budgetMaster.deleteMany).toHaveBeenCalled();
        expect(mockTx.budgetMaster.create).toHaveBeenCalled();
      });

      it('should handle database errors gracefully', async () => {
        const mockTx = {
          budgetMaster: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockRejectedValue(new Error('DB Error')),
            deleteMany: vi.fn(),
          },
        };
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(false);
        expect(result.summary.errors).toBe(1);
        expect(result.validationErrors.length).toBe(1);
        expect(result.validationErrors[0].message).toBe('DB Error');
      });

      it('should handle transaction errors', async () => {
        vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Transaction failed'));

        const result = await uploadBudgetData(testRows, 'merge');

        expect(result.success).toBe(false);
        expect(result.validationErrors.length).toBe(1);
        expect(result.validationErrors[0].field).toBe('transaction');
      });

      it('should use default isActive true when not specified', async () => {
        const rowWithoutIsActive: BudgetRow[] = [{
          committee: '기획위원회',
          department: '기획팀',
          category: '사역지원비',
          subcategory: '기획비',
          detail: '행사비',
        }];

        const mockTx = {
          budgetMaster: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: '1' }),
            deleteMany: vi.fn(),
          },
        };
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));

        await uploadBudgetData(rowWithoutIsActive, 'merge');

        expect(mockTx.budgetMaster.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            isActive: true,
          }),
        });
      });
    });
  });

  describe('exportBudgetTemplate', () => {
    it('should export Excel template with existing data', async () => {
      vi.mocked(prisma.budgetMaster.findMany).mockResolvedValue([
        {
          id: '1',
          committee: '기획위원회',
          department: '기획팀',
          category: '사역지원비',
          subcategory: '기획비',
          detail: '행사비',
          manager: '김대현',
          accountCode: '100.0',
          description: '행사비',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const buffer = await exportBudgetTemplate();

      expect(buffer).toBeDefined();
      // ExcelJS writeBuffer returns Buffer in Node.js, ArrayBuffer in browser
      expect(buffer instanceof Buffer || buffer instanceof ArrayBuffer).toBe(true);

      // 생성된 Excel 파일 검증
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.name).toBe('예산 데이터');
      expect(sheet.rowCount).toBe(2); // 헤더 + 데이터 1행
    });

    it('should export template with headers even when no data', async () => {
      vi.mocked(prisma.budgetMaster.findMany).mockResolvedValue([]);

      const buffer = await exportBudgetTemplate();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.rowCount).toBe(1); // 헤더만
      expect(sheet.getRow(1).getCell(1).value).toBe('위원회');
    });

    it('should handle inactive items', async () => {
      vi.mocked(prisma.budgetMaster.findMany).mockResolvedValue([
        {
          id: '1',
          committee: '기획위원회',
          department: '기획팀',
          category: '사역지원비',
          subcategory: '기획비',
          detail: '행사비',
          manager: null,
          accountCode: null,
          description: null,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const buffer = await exportBudgetTemplate();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];

      expect(sheet.getRow(2).getCell(9).value).toBe('false');
    });
  });
});
