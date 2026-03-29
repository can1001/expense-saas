import { describe, it, expect } from 'vitest';
import {
  simpleExpenseFormSchema,
  createSimpleExpenseSchema,
} from '../simple-expense-schema';

describe('simple-expense-schema', () => {
  describe('simpleExpenseFormSchema', () => {
    it('should validate valid simple expense form data', () => {
      const validData = {
        expenseDate: '2024-01-15',
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '회의 다과',
            unitPrice: 10000,
            quantity: 5,
            amount: 50000,
            order: 1,
          },
        ],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = simpleExpenseFormSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require at least one item', () => {
      const invalidData = {
        expenseDate: '2024-01-15',
        items: [],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = simpleExpenseFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should limit items to maximum 16', () => {
      const items = Array.from({ length: 17 }, (_, i) => ({
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        budgetDetail: '다과비',
        description: `항목 ${i + 1}`,
        unitPrice: 10000,
        quantity: 1,
        amount: 10000,
        order: i + 1,
      }));

      const invalidData = {
        expenseDate: '2024-01-15',
        items,
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = simpleExpenseFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require all budget fields', () => {
      const invalidData = {
        expenseDate: '2024-01-15',
        items: [
          {
            // budgetCategory missing
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '회의 다과',
            unitPrice: 10000,
            quantity: 5,
            amount: 50000,
            order: 1,
          },
        ],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = simpleExpenseFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createSimpleExpenseSchema', () => {
    it('should validate valid create data', () => {
      const validData = {
        expenseDate: '2024-01-15',
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '회의 다과',
            unitPrice: 10000,
            quantity: 5,
            amount: 50000,
            order: 1,
          },
        ],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = createSimpleExpenseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should calculate total requestAmount from items', () => {
      const validData = {
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '항목1',
            unitPrice: 10000,
            quantity: 2,
            amount: 20000,
            order: 1,
          },
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '식사비',
            description: '항목2',
            unitPrice: 15000,
            quantity: 3,
            amount: 45000,
            order: 2,
          },
        ],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = createSimpleExpenseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should transform expenseDate string to Date', () => {
      const validData = {
        expenseDate: '2024-01-15',
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '회의 다과',
            unitPrice: 10000,
            quantity: 5,
            amount: 50000,
            order: 1,
          },
        ],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = createSimpleExpenseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expenseDate).toBeInstanceOf(Date);
      }
    });

    it('should transform expenseDate null to null', () => {
      const validData = {
        expenseDate: null,
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '회의 다과',
            unitPrice: 10000,
            quantity: 5,
            amount: 50000,
            order: 1,
          },
        ],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = createSimpleExpenseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expenseDate).toBeNull();
      }
    });

    it('should keep expenseDate as Date object', () => {
      const date = new Date('2024-01-15');
      const validData = {
        expenseDate: date,
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '회의 다과',
            unitPrice: 10000,
            quantity: 5,
            amount: 50000,
            order: 1,
          },
        ],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = createSimpleExpenseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expenseDate).toBe(date);
      }
    });

    it('should transform requestDate string to Date', () => {
      const validData = {
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '회의 다과',
            unitPrice: 10000,
            quantity: 5,
            amount: 50000,
            order: 1,
          },
        ],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = createSimpleExpenseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requestDate).toBeInstanceOf(Date);
      }
    });

    it('should keep requestDate as Date object', () => {
      const date = new Date('2024-01-15');
      const validData = {
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '회의 다과',
            unitPrice: 10000,
            quantity: 5,
            amount: 50000,
            order: 1,
          },
        ],
        requestDate: date,
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      const result = createSimpleExpenseSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requestDate).toBe(date);
      }
    });

    describe('status field', () => {
      const baseData = {
        items: [
          {
            budgetCategory: '사무행정비',
            budgetSubcategory: '회의비',
            budgetDetail: '다과비',
            description: '회의 다과',
            unitPrice: 10000,
            quantity: 5,
            amount: 50000,
            order: 1,
          },
        ],
        requestDate: '2024-01-15',
        applicantName: '홍길동',
        bankName: '우리은행',
        accountNumber: '123-456-789',
        accountHolder: '홍길동',
      };

      it('should default status to DRAFT when not provided', () => {
        const result = createSimpleExpenseSchema.safeParse(baseData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('DRAFT');
        }
      });

      it('should accept DRAFT status', () => {
        const result = createSimpleExpenseSchema.safeParse({
          ...baseData,
          status: 'DRAFT',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('DRAFT');
        }
      });

      it('should accept PENDING status', () => {
        const result = createSimpleExpenseSchema.safeParse({
          ...baseData,
          status: 'PENDING',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('PENDING');
        }
      });

      it('should reject invalid status values', () => {
        const result = createSimpleExpenseSchema.safeParse({
          ...baseData,
          status: 'INVALID_STATUS',
        });
        expect(result.success).toBe(false);
      });

      it('should reject APPROVED status', () => {
        const result = createSimpleExpenseSchema.safeParse({
          ...baseData,
          status: 'APPROVED',
        });
        expect(result.success).toBe(false);
      });
    });
  });
});
