import { describe, it, expect } from 'vitest';
import {
  calculateNextGenerationDate,
  shouldGenerateExpense,
  createRecurringExpenseSchema,
  RecurringFrequency,
} from '../recurring-expense';

// 타임존 독립적 날짜 비교 헬퍼
function expectDateToEqual(actual: Date, year: number, month: number, day: number) {
  expect(actual.getFullYear()).toBe(year);
  expect(actual.getMonth() + 1).toBe(month); // getMonth()는 0-indexed
  expect(actual.getDate()).toBe(day);
}

// 로컬 타임존에서 날짜 생성 헬퍼
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe('recurring-expense', () => {
  describe('calculateNextGenerationDate', () => {
    it('calculates next date for MONTHLY frequency', () => {
      const currentDate = localDate(2025, 1, 15);
      const dayOfMonth = 25;
      const advanceDays = 7;

      const result = calculateNextGenerationDate(
        RecurringFrequency.MONTHLY,
        dayOfMonth,
        advanceDays,
        currentDate
      );

      // 1월 25일 이체일, 7일 전 생성이므로 1월 18일 생성
      expectDateToEqual(result, 2025, 1, 18);
    });

    it('calculates next date for MONTHLY when current date is past generation date', () => {
      const currentDate = localDate(2025, 1, 20);
      const dayOfMonth = 25;
      const advanceDays = 7;

      const result = calculateNextGenerationDate(
        RecurringFrequency.MONTHLY,
        dayOfMonth,
        advanceDays,
        currentDate
      );

      // 이미 1월 18일이 지났으므로 다음 달 2월 25일 - 7일 = 2월 18일
      expectDateToEqual(result, 2025, 2, 18);
    });

    it('calculates next date for QUARTERLY frequency', () => {
      const currentDate = localDate(2025, 1, 10);
      const dayOfMonth = 15;
      const advanceDays = 7;

      const result = calculateNextGenerationDate(
        RecurringFrequency.QUARTERLY,
        dayOfMonth,
        advanceDays,
        currentDate
      );

      // 분기별: 1월 15일 이체, 7일 전 = 1월 8일 (이미 지남)
      // 다음 분기: 4월 15일 - 7일 = 4월 8일
      expectDateToEqual(result, 2025, 4, 8);
    });

    it('calculates next date for SEMI_ANNUAL frequency', () => {
      const currentDate = localDate(2025, 1, 10);
      const dayOfMonth = 20;
      const advanceDays = 10;

      const result = calculateNextGenerationDate(
        RecurringFrequency.SEMI_ANNUAL,
        dayOfMonth,
        advanceDays,
        currentDate
      );

      // 반기별: 1월 20일 이체, 10일 전 = 1월 10일 (오늘)
      expectDateToEqual(result, 2025, 1, 10);
    });

    it('calculates next date for ANNUAL frequency', () => {
      const currentDate = localDate(2025, 3, 1);
      const dayOfMonth = 15;
      const advanceDays = 5;

      const result = calculateNextGenerationDate(
        RecurringFrequency.ANNUAL,
        dayOfMonth,
        advanceDays,
        currentDate
      );

      // 연간: 시작 월 기준으로 다음 생성일 계산
      // 1월 15일 이체 기준이면, 다음 해 1월 10일 생성
      expectDateToEqual(result, 2026, 1, 10);
    });

    it('handles end of month correctly for dayOfMonth 28', () => {
      const currentDate = localDate(2025, 2, 1);
      const dayOfMonth = 28;
      const advanceDays = 3;

      const result = calculateNextGenerationDate(
        RecurringFrequency.MONTHLY,
        dayOfMonth,
        advanceDays,
        currentDate
      );

      // 2월 28일 이체, 3일 전 = 2월 25일 생성
      expectDateToEqual(result, 2025, 2, 25);
    });
  });

  describe('shouldGenerateExpense', () => {
    it('returns true when current date equals or passes generation date', () => {
      const nextGenerationDate = localDate(2025, 1, 15);
      const currentDate = localDate(2025, 1, 15);

      expect(shouldGenerateExpense(nextGenerationDate, currentDate)).toBe(true);
    });

    it('returns true when current date is past generation date', () => {
      const nextGenerationDate = localDate(2025, 1, 15);
      const currentDate = localDate(2025, 1, 17);

      expect(shouldGenerateExpense(nextGenerationDate, currentDate)).toBe(true);
    });

    it('returns false when current date is before generation date', () => {
      const nextGenerationDate = localDate(2025, 1, 15);
      const currentDate = localDate(2025, 1, 14);

      expect(shouldGenerateExpense(nextGenerationDate, currentDate)).toBe(false);
    });

    it('returns false when nextGenerationDate is null', () => {
      expect(shouldGenerateExpense(null, new Date())).toBe(false);
    });
  });

  describe('createRecurringExpenseSchema', () => {
    const validData = {
      name: '월간 사무실 임대료',
      committee: '재정위원회',
      department: '총무부',
      budgetCategory: '사무행정비',
      budgetSubcategory: '임차료',
      budgetDetail: '사무실 임대',
      recipientName: '임대인 홍길동',
      bankName: '국민은행',
      accountNumber: '123-456-789012',
      baseAmount: 500000,
      frequency: 'MONTHLY',
      dayOfMonth: 25,
      startDate: localDate(2025, 1, 1),
      advanceDays: 7,
    };

    it('validates a valid recurring expense data', () => {
      const result = createRecurringExpenseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('fails validation when name is empty', () => {
      const result = createRecurringExpenseSchema.safeParse({
        ...validData,
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('fails validation when dayOfMonth is invalid (> 28)', () => {
      const result = createRecurringExpenseSchema.safeParse({
        ...validData,
        dayOfMonth: 31,
      });
      expect(result.success).toBe(false);
    });

    it('fails validation when dayOfMonth is invalid (< 1)', () => {
      const result = createRecurringExpenseSchema.safeParse({
        ...validData,
        dayOfMonth: 0,
      });
      expect(result.success).toBe(false);
    });

    it('fails validation when baseAmount is negative', () => {
      const result = createRecurringExpenseSchema.safeParse({
        ...validData,
        baseAmount: -1000,
      });
      expect(result.success).toBe(false);
    });

    it('fails validation when frequency is invalid', () => {
      const result = createRecurringExpenseSchema.safeParse({
        ...validData,
        frequency: 'WEEKLY',
      });
      expect(result.success).toBe(false);
    });

    it('validates with optional endDate', () => {
      const result = createRecurringExpenseSchema.safeParse({
        ...validData,
        endDate: localDate(2025, 12, 31),
      });
      expect(result.success).toBe(true);
    });

    it('validates with optional description', () => {
      const result = createRecurringExpenseSchema.safeParse({
        ...validData,
        description: '매월 25일 자동이체되는 사무실 임대료입니다.',
      });
      expect(result.success).toBe(true);
    });

    it('fails validation when advanceDays is too large (> 30)', () => {
      const result = createRecurringExpenseSchema.safeParse({
        ...validData,
        advanceDays: 35,
      });
      expect(result.success).toBe(false);
    });

    it('fails validation when advanceDays is negative', () => {
      const result = createRecurringExpenseSchema.safeParse({
        ...validData,
        advanceDays: -1,
      });
      expect(result.success).toBe(false);
    });
  });
});
