import { describe, it, expect } from 'vitest';
import {
  calculateAmount,
  calculateTotal,
  expenseItemSchema,
  createExpenseSchema,
  updateExpenseSchema,
} from '../validators';

describe('validators', () => {
  describe('calculateAmount (re-exported)', () => {
    it('calculates amount correctly', () => {
      expect(calculateAmount(100, 5)).toBe(500);
    });

    it('rounds down to nearest 10 won', () => {
      expect(calculateAmount(333, 3)).toBe(990); // 999 -> 990
    });

    it('handles zero values', () => {
      expect(calculateAmount(0, 5)).toBe(0);
      expect(calculateAmount(100, 0)).toBe(0);
    });

    it('handles large numbers', () => {
      expect(calculateAmount(1000000, 10)).toBe(10000000);
    });
  });

  describe('calculateTotal (re-exported)', () => {
    it('sums all item amounts', () => {
      const items = [
        { amount: 1000 },
        { amount: 2000 },
        { amount: 3000 },
      ];
      expect(calculateTotal(items)).toBe(6000);
    });

    it('handles empty array', () => {
      expect(calculateTotal([])).toBe(0);
    });

    it('handles single item', () => {
      const items = [{ amount: 5000 }];
      expect(calculateTotal(items)).toBe(5000);
    });
  });

  describe('expenseItemSchema', () => {
    it('validates valid expense item', () => {
      const validItem = {
        budgetDetail: '예산세목',
        description: '항목 설명',
        unitPrice: 10000,
        quantity: 5,
        amount: 50000,
      };

      const result = expenseItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it('validates with optional order field', () => {
      const itemWithOrder = {
        budgetDetail: '예산세목',
        description: '항목 설명',
        unitPrice: 10000,
        quantity: 5,
        amount: 50000,
        order: 1,
      };

      const result = expenseItemSchema.safeParse(itemWithOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.order).toBe(1);
      }
    });

    it('requires budgetDetail', () => {
      const invalidItem = {
        description: '항목 설명',
        unitPrice: 10000,
        quantity: 5,
        amount: 50000,
      };

      const result = expenseItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it('requires positive unitPrice and quantity', () => {
      const invalidItem = {
        budgetDetail: '예산세목',
        description: '항목 설명',
        unitPrice: -100,
        quantity: 0,
        amount: 0,
      };

      const result = expenseItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe('createExpenseSchema', () => {
    const validExpense = {
      committee: '기획위원회',
      department: '재정팀',
      budgetCategory: '사무행정비',
      budgetSubcategory: '사무_회의및접대비',
      items: [
        {
          budgetDetail: '아웃팅비_재정팀',
          description: '재정팀 회의 후 식사',
          unitPrice: 10000,
          quantity: 5,
          amount: 50000,
          order: 1,
        },
      ],
      requestDate: '2024-03-15',
      applicantName: '홍길동',
      bankName: '우리은행',
      accountNumber: '123-456-789',
      accountHolder: '홍길동',
    };

    it('validates complete expense data', () => {
      const result = createExpenseSchema.safeParse(validExpense);
      expect(result.success).toBe(true);
    });

    it('transforms string dates to Date objects', () => {
      const result = createExpenseSchema.safeParse(validExpense);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requestDate).toBeInstanceOf(Date);
      }
    });

    it('handles Date object for requestDate', () => {
      const expenseWithDate = {
        ...validExpense,
        requestDate: new Date('2024-03-15'),
      };
      const result = createExpenseSchema.safeParse(expenseWithDate);
      expect(result.success).toBe(true);
    });

    it('transforms expenseDate string to Date', () => {
      const expenseWithDate = {
        ...validExpense,
        expenseDate: '2024-03-20',
      };
      const result = createExpenseSchema.safeParse(expenseWithDate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expenseDate).toBeInstanceOf(Date);
      }
    });

    it('handles null expenseDate', () => {
      const expenseWithNullDate = {
        ...validExpense,
        expenseDate: null,
      };
      const result = createExpenseSchema.safeParse(expenseWithNullDate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expenseDate).toBeNull();
      }
    });

    it('handles Date object for expenseDate', () => {
      const date = new Date('2024-03-20');
      const expenseWithDate = {
        ...validExpense,
        expenseDate: date,
      };
      const result = createExpenseSchema.safeParse(expenseWithDate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expenseDate).toBe(date);
      }
    });

    it('allows omitting requestTeam (server derives it from committee/department)', () => {
      const result = createExpenseSchema.safeParse(validExpense);
      expect(result.success).toBe(true);
    });

    it('requires committee field', () => {
      const { committee, ...incomplete } = validExpense;
      const result = createExpenseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('requires department field', () => {
      const { department, ...incomplete } = validExpense;
      const result = createExpenseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('requires budgetCategory field', () => {
      const { budgetCategory, ...incomplete } = validExpense;
      const result = createExpenseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('requires budgetSubcategory field', () => {
      const { budgetSubcategory, ...incomplete } = validExpense;
      const result = createExpenseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('requires at least one item', () => {
      const noItems = {
        ...validExpense,
        items: [],
      };
      const result = createExpenseSchema.safeParse(noItems);
      expect(result.success).toBe(false);
    });

    it('requires applicantName', () => {
      const { applicantName, ...incomplete } = validExpense;
      const result = createExpenseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('requires bankName', () => {
      const { bankName, ...incomplete } = validExpense;
      const result = createExpenseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('requires accountNumber', () => {
      const { accountNumber, ...incomplete } = validExpense;
      const result = createExpenseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('requires accountHolder', () => {
      const { accountHolder, ...incomplete } = validExpense;
      const result = createExpenseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('allows optional applicantTitle', () => {
      const withTitle = {
        ...validExpense,
        applicantTitle: '팀장',
      };
      const result = createExpenseSchema.safeParse(withTitle);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applicantTitle).toBe('팀장');
      }
    });

    it('handles null applicantTitle', () => {
      const withNullTitle = {
        ...validExpense,
        applicantTitle: null,
      };
      const result = createExpenseSchema.safeParse(withNullTitle);
      expect(result.success).toBe(true);
    });

    it('validates multiple items', () => {
      const multipleItems = {
        ...validExpense,
        items: [
          {
            budgetDetail: '세목1',
            description: '항목1',
            unitPrice: 10000,
            quantity: 2,
            amount: 20000,
            order: 1,
          },
          {
            budgetDetail: '세목2',
            description: '항목2',
            unitPrice: 5000,
            quantity: 3,
            amount: 15000,
            order: 2,
          },
        ],
      };
      const result = createExpenseSchema.safeParse(multipleItems);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
      }
    });
  });

  describe('updateExpenseSchema', () => {
    it('allows partial updates', () => {
      const partialUpdate = {
        applicantName: '김철수',
      };
      const result = updateExpenseSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('allows updating only bank information', () => {
      const bankUpdate = {
        bankName: '신한은행',
        accountNumber: '987-654-321',
      };
      const result = updateExpenseSchema.safeParse(bankUpdate);
      expect(result.success).toBe(true);
    });

    it('allows updating only items', () => {
      const itemsUpdate = {
        items: [
          {
            budgetDetail: '새로운 세목',
            description: '새로운 항목',
            unitPrice: 20000,
            quantity: 1,
            amount: 20000,
          },
        ],
      };
      const result = updateExpenseSchema.safeParse(itemsUpdate);
      expect(result.success).toBe(true);
    });

    it('allows empty object (no updates)', () => {
      const result = updateExpenseSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('validates fields when provided', () => {
      const invalidUpdate = {
        items: [], // Empty array not allowed even in partial update
      };
      const result = updateExpenseSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });
});
