/**
 * 은행 계좌 스키마 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  savedBankAccountSchema,
  updateBankAccountSchema,
  type SavedBankAccountInput,
  type UpdateBankAccountInput,
} from '../bank-account-schema';

describe('savedBankAccountSchema', () => {
  describe('bankName validation', () => {
    it('accepts valid bank name', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty bank name', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path[0] === 'bankName');
        expect(error?.message).toBe('은행명을 입력해주세요.');
      }
    });

    it('rejects bank name longer than 50 characters', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: 'A'.repeat(51),
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path[0] === 'bankName');
        expect(error?.message).toBe('은행명이 너무 깁니다.');
      }
    });

    it('accepts bank name with exactly 50 characters', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: 'A'.repeat(50),
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('accountNumber validation', () => {
    it('accepts valid account number with hyphens', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid account number without hyphens', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '123456789012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty account number', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path[0] === 'accountNumber');
        expect(error?.message).toBe('계좌번호를 입력해주세요.');
      }
    });

    it('rejects account number longer than 50 characters', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1'.repeat(51),
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path[0] === 'accountNumber');
        expect(error?.message).toBe('계좌번호가 너무 깁니다.');
      }
    });

    it('rejects account number with letters', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-abcd-5678',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path[0] === 'accountNumber');
        expect(error?.message).toBe(
          '계좌번호는 숫자와 하이픈(-)만 입력 가능합니다.'
        );
      }
    });

    it('rejects account number with special characters (except hyphen)', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234@5678#9012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path[0] === 'accountNumber');
        expect(error?.message).toBe(
          '계좌번호는 숫자와 하이픈(-)만 입력 가능합니다.'
        );
      }
    });
  });

  describe('accountHolder validation', () => {
    it('accepts valid account holder name', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty account holder', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path[0] === 'accountHolder');
        expect(error?.message).toBe('예금주를 입력해주세요.');
      }
    });

    it('rejects account holder name longer than 50 characters', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path[0] === 'accountHolder');
        expect(error?.message).toBe('예금주 이름이 너무 깁니다.');
      }
    });

    it('accepts account holder name with exactly 50 characters', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: 'A'.repeat(50),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('nickname validation', () => {
    it('accepts valid nickname', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
        nickname: '주거래 은행',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nickname).toBe('주거래 은행');
      }
    });

    it('accepts empty nickname (optional)', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(true);
    });

    it('accepts null nickname', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
        nickname: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects nickname longer than 50 characters', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
        nickname: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues.find((e) => e.path[0] === 'nickname');
        expect(error?.message).toBe('별명이 너무 깁니다.');
      }
    });
  });

  describe('isDefault validation', () => {
    it('accepts true for isDefault', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
        isDefault: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isDefault).toBe(true);
      }
    });

    it('accepts false for isDefault', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
        isDefault: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isDefault).toBe(false);
      }
    });

    it('defaults to false when not provided', () => {
      const result = savedBankAccountSchema.safeParse({
        bankName: '우리은행',
        accountNumber: '1234-5678-9012',
        accountHolder: '홍길동',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isDefault).toBe(false);
      }
    });
  });

  describe('complete valid data', () => {
    it('accepts complete valid data with all fields', () => {
      const validData: SavedBankAccountInput = {
        bankName: '우리은행',
        accountNumber: '1234-5678-9012-3456',
        accountHolder: '홍길동',
        nickname: '급여 계좌',
        isDefault: true,
      };

      const result = savedBankAccountSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });
  });
});

describe('updateBankAccountSchema', () => {
  it('accepts partial data (only bankName)', () => {
    const result = updateBankAccountSchema.safeParse({
      bankName: '신한은행',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial data (only accountNumber)', () => {
    const result = updateBankAccountSchema.safeParse({
      accountNumber: '9876-5432-1012',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial data (only accountHolder)', () => {
    const result = updateBankAccountSchema.safeParse({
      accountHolder: '김철수',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial data (only nickname)', () => {
    const result = updateBankAccountSchema.safeParse({
      nickname: '새로운 별명',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial data (only isDefault)', () => {
    const result = updateBankAccountSchema.safeParse({
      isDefault: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = updateBankAccountSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts multiple partial fields', () => {
    const partialData: UpdateBankAccountInput = {
      bankName: '신한은행',
      isDefault: true,
    };

    const result = updateBankAccountSchema.safeParse(partialData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(partialData);
    }
  });

  it('validates field constraints even for partial data', () => {
    const result = updateBankAccountSchema.safeParse({
      accountNumber: 'invalid-with-letters',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find((e) => e.path[0] === 'accountNumber');
      expect(error?.message).toBe(
        '계좌번호는 숫자와 하이픈(-)만 입력 가능합니다.'
      );
    }
  });

  it('validates string length even for partial data', () => {
    const result = updateBankAccountSchema.safeParse({
      bankName: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find((e) => e.path[0] === 'bankName');
      expect(error?.message).toBe('은행명이 너무 깁니다.');
    }
  });
});

describe('TypeScript type inference', () => {
  it('SavedBankAccountInput type has correct structure', () => {
    const data: SavedBankAccountInput = {
      bankName: '우리은행',
      accountNumber: '1234-5678-9012',
      accountHolder: '홍길동',
      nickname: null,
      isDefault: false,
    };

    expect(data.bankName).toBeDefined();
    expect(data.accountNumber).toBeDefined();
    expect(data.accountHolder).toBeDefined();
  });

  it('UpdateBankAccountInput type allows partial fields', () => {
    const data: UpdateBankAccountInput = {
      bankName: '신한은행',
    };

    expect(data.bankName).toBeDefined();
  });
});
