/**
 * Zod 스키마 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  expenseItemSchema,
  expenseFormSchema,
  calculateAmount,
  calculateTotalAmount,
} from '../expense-schema';

describe('expenseItemSchema', () => {
  it('should validate correct expense item', () => {
    const validItem = {
      budgetCategory: '교육비',
      budgetSubcategory: '교육자료',
      budgetDetail: '교육자료비',
      description: '세미나 자료 제작',
      unitPrice: 10000,
      quantity: 5,
      amount: 50000,
    };

    const result = expenseItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it('should reject empty budgetDetail', () => {
    const invalid = {
      budgetCategory: '교육비',
      budgetSubcategory: '교육자료',
      budgetDetail: '',
      description: '설명',
      unitPrice: 10000,
      quantity: 1,
      amount: 10000,
    };

    const result = expenseItemSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject negative unitPrice', () => {
    const invalid = {
      budgetCategory: '교육비',
      budgetSubcategory: '교육자료',
      budgetDetail: '예산',
      description: '설명',
      unitPrice: -100,
      quantity: 1,
      amount: 100,
    };

    const result = expenseItemSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject zero quantity', () => {
    const invalid = {
      budgetCategory: '교육비',
      budgetSubcategory: '교육자료',
      budgetDetail: '예산',
      description: '설명',
      unitPrice: 1000,
      quantity: 0,
      amount: 0,
    };

    const result = expenseItemSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('expenseFormSchema', () => {
  const validFormData = {
    committee: '교육위원회',
    department: '교육부',
    requestDate: '2024-12-01',
    requestTeam: '교육위원회 교육부',
    applicantName: '홍길동',
    bankName: '국민은행',
    accountNumber: '123-456-789',
    accountHolder: '홍길동',
    items: [
      {
        budgetCategory: '교육비',
        budgetSubcategory: '교육자료',
        budgetDetail: '교육자료비',
        description: '세미나 자료',
        unitPrice: 10000,
        quantity: 1,
        amount: 10000,
      },
    ],
  };

  it('should validate correct form data', () => {
    const result = expenseFormSchema.safeParse(validFormData);
    expect(result.success).toBe(true);
  });

  it('should reject mismatched requestTeam (must equal committee + department)', () => {
    const invalid = { ...validFormData, requestTeam: '출납팀' };
    const result = expenseFormSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const invalid = { ...validFormData, committee: undefined };
    const result = expenseFormSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should allow optional expenseDate', () => {
    const withDate = { ...validFormData, expenseDate: '2024-12-01' };
    const result = expenseFormSchema.safeParse(withDate);
    expect(result.success).toBe(true);
  });

  it('should reject invalid account number format', () => {
    const invalid = { ...validFormData, accountNumber: 'invalid#account' };
    const result = expenseFormSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject empty items array', () => {
    const invalid = { ...validFormData, items: [] };
    const result = expenseFormSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject more than 10 items', () => {
    const items = Array(11).fill({
      budgetDetail: '예산',
      description: '설명',
      unitPrice: 1000,
      quantity: 1,
      amount: 1000,
    });
    const invalid = { ...validFormData, items };
    const result = expenseFormSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('calculateAmount', () => {
  it('should calculate amount correctly (unitPrice × quantity, 절삭 없음)', () => {
    expect(calculateAmount(10000, 5)).toBe(50000); // 10000 * 5 = 50000
    expect(calculateAmount(1234, 3)).toBe(3702);   // 1234 * 3 = 3702
    expect(calculateAmount(9999, 1)).toBe(9999);   // 9999 * 1 = 9999
    expect(calculateAmount(37182, 2)).toBe(74364); // 37182 * 2 = 74364
  });

  it('should preserve exact calculation without rounding', () => {
    expect(calculateAmount(155, 1)).toBe(155);  // 155 * 1 = 155
    expect(calculateAmount(199, 1)).toBe(199);  // 199 * 1 = 199
  });

  it('should handle zero quantity', () => {
    expect(calculateAmount(1000, 0)).toBe(0);
  });

  it('should handle large numbers', () => {
    expect(calculateAmount(1000000, 100)).toBe(100000000); // 1000000 * 100 = 100000000
  });
});

describe('calculateTotalAmount', () => {
  it('should calculate total amount correctly', () => {
    const items = [
      { budgetDetail: '', description: '', unitPrice: 0, quantity: 0, amount: 1000 },
      { budgetDetail: '', description: '', unitPrice: 0, quantity: 0, amount: 2000 },
      { budgetDetail: '', description: '', unitPrice: 0, quantity: 0, amount: 3000 },
    ];

    expect(calculateTotalAmount(items)).toBe(6000);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotalAmount([])).toBe(0);
  });

  it('should handle single item', () => {
    const items = [
      { budgetDetail: '', description: '', unitPrice: 0, quantity: 0, amount: 5000 },
    ];

    expect(calculateTotalAmount(items)).toBe(5000);
  });
});
