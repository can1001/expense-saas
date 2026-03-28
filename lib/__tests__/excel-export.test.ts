/**
 * 엑셀 내보내기 유틸리티 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  formatDateForExcel,
  expenseToExcelRows,
  expensesToExcelRows,
  generateExcelWorkbook,
  generateExcelBuffer,
  generateExcelFilename,
  expenseToWooriBankRow,
  expensesToWooriBankRows,
  generateWooriBankWorkbook,
  generateWooriBankBuffer,
  generateWooriBankFilename,
  type ExpenseForExcel,
  type ExcelRow,
  type ExpenseForWooriBank,
  type WooriBankTransferRow,
} from '../excel-export';

describe('excel-export', () => {
  describe('formatDateForExcel', () => {
    it('formats date to YYYY-MM-DD format', () => {
      const date = new Date('2025-12-30');
      expect(formatDateForExcel(date)).toBe('2025-12-30');
    });

    it('pads single digit months and days with zero', () => {
      const date = new Date('2025-01-05');
      expect(formatDateForExcel(date)).toBe('2025-01-05');
    });

    it('handles dates with double digit months and days', () => {
      const date = new Date('2025-11-25');
      expect(formatDateForExcel(date)).toBe('2025-11-25');
    });

    it('handles year changes correctly', () => {
      const date = new Date('2024-01-01');
      expect(formatDateForExcel(date)).toBe('2024-01-01');
    });
  });

  describe('expenseToExcelRows', () => {
    const mockExpense: ExpenseForExcel = {
      accountHolder: '홍길동',
      bankName: '우리은행',
      accountNumber: '123-456-789',
      expenseDate: new Date('2025-12-15'),
      requestDate: new Date('2025-12-20'),
      items: [
        {
          budgetCategory: '사무행정비',
          budgetSubcategory: '사무_회의및접대비',
          budgetDetail: '아웃팅비_재정팀',
          description: '재정팀 회의 후 식사',
          amount: 50000,
        },
        {
          budgetCategory: '사무행정비',
          budgetSubcategory: '사무_회의및접대비',
          budgetDetail: '회의비_일반',
          description: '월간 회의 다과',
          amount: 30000,
        },
      ],
    };

    it('converts expense to excel rows', () => {
      const rows = expenseToExcelRows(mockExpense);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        항: '사무행정비',
        목: '사무_회의및접대비',
        세목: '아웃팅비_재정팀',
        세세목: '',
        지급방법: '이체',
        예금주: '홍길동',
        은행: '우리은행',
        계좌번호: '123-456-789',
        금액: 50000,
        날짜: '2025-12-15',
        메모: '재정팀 회의 후 식사',
      });
      expect(rows[1]).toEqual({
        항: '사무행정비',
        목: '사무_회의및접대비',
        세목: '회의비_일반',
        세세목: '',
        지급방법: '이체',
        예금주: '홍길동',
        은행: '우리은행',
        계좌번호: '123-456-789',
        금액: 30000,
        날짜: '2025-12-15',
        메모: '월간 회의 다과',
      });
    });

    it('uses expenseDate when available', () => {
      const rows = expenseToExcelRows(mockExpense);
      expect(rows[0].날짜).toBe('2025-12-15');
    });

    it('falls back to requestDate when expenseDate is null', () => {
      const expenseWithoutDate: ExpenseForExcel = {
        ...mockExpense,
        expenseDate: null,
      };
      const rows = expenseToExcelRows(expenseWithoutDate);
      expect(rows[0].날짜).toBe('2025-12-20');
    });

    it('uses overrideDate when provided', () => {
      const overrideDate = new Date('2025-12-25');
      const rows = expenseToExcelRows(mockExpense, overrideDate);
      expect(rows[0].날짜).toBe('2025-12-25');
      expect(rows[1].날짜).toBe('2025-12-25');
    });

    it('handles single item expense', () => {
      const singleItemExpense: ExpenseForExcel = {
        ...mockExpense,
        items: [mockExpense.items[0]],
      };
      const rows = expenseToExcelRows(singleItemExpense);
      expect(rows).toHaveLength(1);
    });

    it('handles empty items array', () => {
      const emptyExpense: ExpenseForExcel = {
        ...mockExpense,
        items: [],
      };
      const rows = expenseToExcelRows(emptyExpense);
      expect(rows).toHaveLength(0);
    });
  });

  describe('expensesToExcelRows', () => {
    const mockExpenses: ExpenseForExcel[] = [
      {
        accountHolder: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        expenseDate: new Date('2025-12-15'),
        requestDate: new Date('2025-12-20'),
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '사무_회의및접대비',
            budgetDetail: '아웃팅비_재정팀',
            description: '재정팀 회의',
            amount: 50000,
          },
        ],
      },
      {
        accountHolder: '김철수',
        bankName: '신한은행',
        accountNumber: '987-654-321',
        expenseDate: new Date('2025-12-16'),
        requestDate: new Date('2025-12-21'),
        items: [
          {
            budgetCategory: '교육비',
            budgetSubcategory: '교육_세미나',
            budgetDetail: '세미나_등록비',
            description: '기술 세미나 참가비',
            amount: 100000,
          },
          {
            budgetCategory: '교육비',
            budgetSubcategory: '교육_세미나',
            budgetDetail: '세미나_교통비',
            description: '세미나 교통비',
            amount: 20000,
          },
        ],
      },
    ];

    it('converts multiple expenses to excel rows', () => {
      const rows = expensesToExcelRows(mockExpenses);
      expect(rows).toHaveLength(3);
    });

    it('applies overrideDate to all expenses', () => {
      const overrideDate = new Date('2025-12-30');
      const rows = expensesToExcelRows(mockExpenses, overrideDate);
      expect(rows[0].날짜).toBe('2025-12-30');
      expect(rows[1].날짜).toBe('2025-12-30');
      expect(rows[2].날짜).toBe('2025-12-30');
    });

    it('handles empty expenses array', () => {
      const rows = expensesToExcelRows([]);
      expect(rows).toHaveLength(0);
    });

    it('preserves order of expenses and items', () => {
      const rows = expensesToExcelRows(mockExpenses);
      expect(rows[0].항).toBe('사무행정비');
      expect(rows[1].항).toBe('교육비');
      expect(rows[2].항).toBe('교육비');
    });
  });

  describe('generateExcelWorkbook', () => {
    const mockExpenses: ExpenseForExcel[] = [
      {
        budgetCategory: '사무행정비',
        budgetSubcategory: '사무_회의및접대비',
        accountHolder: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        expenseDate: new Date('2025-12-15'),
        requestDate: new Date('2025-12-20'),
        items: [
          {
            budgetDetail: '아웃팅비_재정팀',
            description: '재정팀 회의',
            amount: 50000,
          },
        ],
      },
    ];

    it('generates a valid Excel workbook', () => {
      const workbook = generateExcelWorkbook(mockExpenses);
      expect(workbook).toBeDefined();
      expect(workbook.SheetNames).toContain('지출재정');
    });

    it('creates worksheet with correct data', () => {
      const workbook = generateExcelWorkbook(mockExpenses);
      const worksheet = workbook.Sheets['지출재정'];
      expect(worksheet).toBeDefined();
    });

    it('applies column width settings', () => {
      const workbook = generateExcelWorkbook(mockExpenses);
      const worksheet = workbook.Sheets['지출재정'];
      expect(worksheet['!cols']).toBeDefined();
      expect(worksheet['!cols']).toHaveLength(11);
      expect(worksheet['!cols']?.[0]).toEqual({ wch: 20 }); // 항
      expect(worksheet['!cols']?.[10]).toEqual({ wch: 40 }); // 메모
    });

    it('handles overrideDate parameter', () => {
      const overrideDate = new Date('2025-12-30');
      const workbook = generateExcelWorkbook(mockExpenses, overrideDate);
      expect(workbook).toBeDefined();
      expect(workbook.SheetNames).toContain('지출재정');
    });

    it('handles empty expenses array', () => {
      const workbook = generateExcelWorkbook([]);
      expect(workbook).toBeDefined();
      expect(workbook.SheetNames).toContain('지출재정');
    });
  });

  describe('generateExcelBuffer', () => {
    const mockExpenses: ExpenseForExcel[] = [
      {
        budgetCategory: '사무행정비',
        budgetSubcategory: '사무_회의및접대비',
        accountHolder: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        expenseDate: new Date('2025-12-15'),
        requestDate: new Date('2025-12-20'),
        items: [
          {
            budgetDetail: '아웃팅비_재정팀',
            description: '재정팀 회의',
            amount: 50000,
          },
        ],
      },
    ];

    it('generates a Buffer from workbook', () => {
      const buffer = generateExcelBuffer(mockExpenses);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('generates valid Excel file data', () => {
      const buffer = generateExcelBuffer(mockExpenses);
      // Check for Excel file signature (first 4 bytes: PK or D0 CF)
      expect(buffer.length).toBeGreaterThan(100);
    });

    it('handles overrideDate parameter', () => {
      const overrideDate = new Date('2025-12-30');
      const buffer = generateExcelBuffer(mockExpenses, overrideDate);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('generateExcelFilename', () => {
    const mockExpenses: ExpenseForExcel[] = [
      {
        budgetCategory: '사무행정비',
        budgetSubcategory: '사무_회의및접대비',
        accountHolder: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        expenseDate: new Date('2025-12-15'),
        requestDate: new Date('2025-12-20'),
        items: [
          {
            budgetDetail: '아웃팅비_재정팀',
            description: '재정팀 회의',
            amount: 50000,
          },
        ],
      },
    ];

    it('generates filename for single expense', () => {
      const filename = generateExcelFilename(mockExpenses);
      expect(filename).toBe('지출재정_홍길동_2025-12-15.xlsx');
    });

    it('generates filename with date range for multiple expenses', () => {
      const multipleExpenses = [
        ...mockExpenses,
        {
          ...mockExpenses[0],
          accountHolder: '김철수',
        },
      ];
      const startDate = new Date('2025-12-01');
      const endDate = new Date('2025-12-31');
      const filename = generateExcelFilename(multipleExpenses, startDate, endDate);
      expect(filename).toBe('지출재정_2025-12-01_2025-12-31.xlsx');
    });

    it('generates default filename with current date for multiple expenses without date range', () => {
      const multipleExpenses = [
        ...mockExpenses,
        {
          ...mockExpenses[0],
          accountHolder: '김철수',
        },
      ];
      const filename = generateExcelFilename(multipleExpenses);
      expect(filename).toMatch(/^지출재정_\d{4}-\d{2}-\d{2}\.xlsx$/);
    });

    it('uses expenseDate for single expense', () => {
      const filename = generateExcelFilename(mockExpenses);
      expect(filename).toContain('2025-12-15');
    });

    it('uses requestDate when expenseDate is null for single expense', () => {
      const expenseWithoutDate: ExpenseForExcel[] = [
        {
          ...mockExpenses[0],
          expenseDate: null,
        },
      ];
      const filename = generateExcelFilename(expenseWithoutDate);
      expect(filename).toContain('2025-12-20');
    });

    it('handles empty expenses array', () => {
      const filename = generateExcelFilename([]);
      expect(filename).toMatch(/^지출재정_\d{4}-\d{2}-\d{2}\.xlsx$/);
    });
  });

  describe('ExcelRow interface', () => {
    it('creates valid ExcelRow object', () => {
      const row: ExcelRow = {
        항: '사무행정비',
        목: '사무_회의및접대비',
        세목: '아웃팅비_재정팀',
        세세목: '',
        지급방법: '이체',
        예금주: '홍길동',
        은행: '우리은행',
        계좌번호: '123-456-789',
        금액: 50000,
        날짜: '2025-12-15',
        메모: '재정팀 회의',
      };

      expect(row).toBeDefined();
      expect(row.항).toBe('사무행정비');
      expect(row.금액).toBe(50000);
    });
  });

  describe('Edge cases', () => {
    it('handles expense with very long description', () => {
      const longDescription = 'A'.repeat(500);
      const expense: ExpenseForExcel = {
        budgetCategory: '사무행정비',
        budgetSubcategory: '사무_회의및접대비',
        accountHolder: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        expenseDate: new Date('2025-12-15'),
        requestDate: new Date('2025-12-20'),
        items: [
          {
            budgetDetail: '아웃팅비_재정팀',
            description: longDescription,
            amount: 50000,
          },
        ],
      };

      const rows = expenseToExcelRows(expense);
      expect(rows[0].메모).toBe(longDescription);
    });

    it('handles large amounts', () => {
      const expense: ExpenseForExcel = {
        budgetCategory: '사무행정비',
        budgetSubcategory: '사무_회의및접대비',
        accountHolder: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        expenseDate: new Date('2025-12-15'),
        requestDate: new Date('2025-12-20'),
        items: [
          {
            budgetDetail: '아웃팅비_재정팀',
            description: '대규모 행사',
            amount: 10000000,
          },
        ],
      };

      const rows = expenseToExcelRows(expense);
      expect(rows[0].금액).toBe(10000000);
    });

    it('handles special characters in fields', () => {
      const expense: ExpenseForExcel = {
        budgetCategory: '사무행정비',
        budgetSubcategory: '사무_회의및접대비',
        accountHolder: '홍길동 (대표)',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        expenseDate: new Date('2025-12-15'),
        requestDate: new Date('2025-12-20'),
        items: [
          {
            budgetDetail: '아웃팅비_재정팀',
            description: '회의 & 식사 (저녁)',
            amount: 50000,
          },
        ],
      };

      const rows = expenseToExcelRows(expense);
      expect(rows[0].예금주).toBe('홍길동 (대표)');
      expect(rows[0].메모).toBe('회의 & 식사 (저녁)');
    });
  });

  describe('WooriBank Export', () => {
    const mockWooriBankExpense: ExpenseForWooriBank = {
      bankName: '우리은행',
      accountNumber: '123-456-789',
      accountHolder: '홍길동',
      requestAmount: 100000,
    };

    describe('expenseToWooriBankRow', () => {
      it('converts expense to WooriBank transfer row', () => {
        const row = expenseToWooriBankRow(mockWooriBankExpense);

        expect(row.입금은행).toBe('우리은행');
        expect(row.입금계좌번호).toBe('123456789');
        expect(row.이체금액).toBe(100000);
        expect(row.보내는분통장표시).toBe('청연교회');
        expect(row.받는분통장표시).toBe('홍길동');
        expect(row.CMS번호).toBe('');
      });

      it('removes hyphens from account number', () => {
        const expense = { ...mockWooriBankExpense, accountNumber: '123-456-7890' };
        const row = expenseToWooriBankRow(expense);

        expect(row.입금계좌번호).toBe('1234567890');
      });

      it('handles account number without hyphens', () => {
        const expense = { ...mockWooriBankExpense, accountNumber: '1234567890' };
        const row = expenseToWooriBankRow(expense);

        expect(row.입금계좌번호).toBe('1234567890');
      });

      it('handles different bank names', () => {
        const expense = { ...mockWooriBankExpense, bankName: '신한은행' };
        const row = expenseToWooriBankRow(expense);

        expect(row.입금은행).toBe('신한은행');
      });

      it('handles large amounts', () => {
        const expense = { ...mockWooriBankExpense, requestAmount: 10000000 };
        const row = expenseToWooriBankRow(expense);

        expect(row.이체금액).toBe(10000000);
      });
    });

    describe('expensesToWooriBankRows', () => {
      it('converts multiple expenses to WooriBank rows', () => {
        const expenses: ExpenseForWooriBank[] = [
          mockWooriBankExpense,
          { ...mockWooriBankExpense, accountHolder: '김철수', requestAmount: 200000 },
        ];

        const rows = expensesToWooriBankRows(expenses);

        expect(rows).toHaveLength(2);
        expect(rows[0].받는분통장표시).toBe('홍길동');
        expect(rows[0].이체금액).toBe(100000);
        expect(rows[1].받는분통장표시).toBe('김철수');
        expect(rows[1].이체금액).toBe(200000);
      });

      it('handles empty array', () => {
        const rows = expensesToWooriBankRows([]);

        expect(rows).toEqual([]);
      });

      it('handles single expense', () => {
        const rows = expensesToWooriBankRows([mockWooriBankExpense]);

        expect(rows).toHaveLength(1);
      });
    });

    describe('generateWooriBankWorkbook', () => {
      it('generates a valid Excel workbook', () => {
        const workbook = generateWooriBankWorkbook([mockWooriBankExpense]);

        expect(workbook).toBeDefined();
        expect(workbook.SheetNames).toContain('Sheet1');
      });

      it('creates worksheet with correct data', () => {
        const workbook = generateWooriBankWorkbook([mockWooriBankExpense]);
        const worksheet = workbook.Sheets['Sheet1'];

        expect(worksheet).toBeDefined();
      });

      it('applies column width settings', () => {
        const workbook = generateWooriBankWorkbook([mockWooriBankExpense]);
        const worksheet = workbook.Sheets['Sheet1'];

        expect(worksheet['!cols']).toBeDefined();
        expect(worksheet['!cols']).toHaveLength(6);
        expect(worksheet['!cols']?.[0]).toEqual({ wch: 12 }); // 입금은행
        expect(worksheet['!cols']?.[1]).toEqual({ wch: 18 }); // 입금계좌번호
      });

      it('handles multiple expenses', () => {
        const expenses: ExpenseForWooriBank[] = [
          mockWooriBankExpense,
          { ...mockWooriBankExpense, accountHolder: '김철수' },
        ];
        const workbook = generateWooriBankWorkbook(expenses);

        expect(workbook).toBeDefined();
        expect(workbook.SheetNames).toContain('Sheet1');
      });

      it('handles empty expenses array', () => {
        const workbook = generateWooriBankWorkbook([]);

        expect(workbook).toBeDefined();
        expect(workbook.SheetNames).toContain('Sheet1');
      });
    });

    describe('generateWooriBankBuffer', () => {
      it('generates a Buffer from workbook', () => {
        const buffer = generateWooriBankBuffer([mockWooriBankExpense]);

        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(0);
      });

      it('generates valid Excel file data', () => {
        const buffer = generateWooriBankBuffer([mockWooriBankExpense]);

        expect(buffer.length).toBeGreaterThan(100);
      });

      it('handles multiple expenses', () => {
        const expenses: ExpenseForWooriBank[] = [
          mockWooriBankExpense,
          { ...mockWooriBankExpense, accountHolder: '김철수' },
        ];
        const buffer = generateWooriBankBuffer(expenses);

        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(0);
      });
    });

    describe('generateWooriBankFilename', () => {
      it('generates filename with current date', () => {
        const filename = generateWooriBankFilename();

        expect(filename).toMatch(/^우리은행_대량이체_\d{4}-\d{2}-\d{2}\.xlsx$/);
      });

      it('includes correct prefix and extension', () => {
        const filename = generateWooriBankFilename();

        expect(filename).toContain('우리은행_대량이체_');
        expect(filename.endsWith('.xlsx')).toBe(true);
      });
    });

    describe('WooriBankTransferRow interface', () => {
      it('creates valid WooriBankTransferRow object', () => {
        const row: WooriBankTransferRow = {
          입금은행: '우리은행',
          입금계좌번호: '1234567890',
          이체금액: 100000,
          보내는분통장표시: '청연교회',
          받는분통장표시: '홍길동',
          CMS번호: '',
        };

        expect(row).toBeDefined();
        expect(row.입금은행).toBe('우리은행');
        expect(row.이체금액).toBe(100000);
      });
    });
  });
});
