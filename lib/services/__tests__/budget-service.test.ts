/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getUsedAmountByDetail,
  getAllUsedAmounts,
  makeBudgetDetailKey,
  type BudgetDetailKey,
} from '../budget-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expenseItem: {
      groupBy: vi.fn(),
    },
  },
}));

const eduKey: BudgetDetailKey = {
  budgetCategory: '교육사역비',
  budgetSubcategory: '영유아사역비',
  budgetDetail: '행사비(선물)',
};

const meetingKey: BudgetDetailKey = {
  budgetCategory: '사무행정비',
  budgetSubcategory: '회의및접대비',
  budgetDetail: '회의비',
};

const elementaryGiftKey: BudgetDetailKey = {
  budgetCategory: '교육사역비',
  budgetSubcategory: '초등사역비',
  budgetDetail: '행사비(선물)', // 영유아사역비와 동일한 세목 이름
};

describe('budget-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('makeBudgetDetailKey', () => {
    it('항/목/세목을 파이프로 합쳐 합성 키를 만들어야 함', () => {
      expect(makeBudgetDetailKey(eduKey)).toBe('교육사역비|영유아사역비|행사비(선물)');
    });
  });

  describe('getUsedAmountByDetail', () => {
    it('항/목/세목 조합별 사용금액을 합성 키로 반환해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        {
          budgetCategory: '교육사역비',
          budgetSubcategory: '영유아사역비',
          budgetDetail: '행사비(선물)',
          _sum: { amount: 100000 },
        },
        {
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의및접대비',
          budgetDetail: '회의비',
          _sum: { amount: 50000 },
        },
      ] as any);

      const result = await getUsedAmountByDetail([eduKey, meetingKey], 2026);

      expect(result.get(makeBudgetDetailKey(eduKey))).toBe(100000);
      expect(result.get(makeBudgetDetailKey(meetingKey))).toBe(50000);
    });

    it('동일한 세목명이라도 항/목이 다르면 별개로 집계해야 함 (회귀 방지)', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        {
          budgetCategory: '교육사역비',
          budgetSubcategory: '영유아사역비',
          budgetDetail: '행사비(선물)',
          _sum: { amount: 100000 },
        },
        {
          budgetCategory: '교육사역비',
          budgetSubcategory: '초등사역비',
          budgetDetail: '행사비(선물)',
          _sum: { amount: 200000 },
        },
      ] as any);

      const result = await getUsedAmountByDetail([eduKey, elementaryGiftKey], 2026);

      expect(result.get(makeBudgetDetailKey(eduKey))).toBe(100000);
      expect(result.get(makeBudgetDetailKey(elementaryGiftKey))).toBe(200000);
      expect(result.size).toBe(2);
    });

    it('항/목/세목 3-튜플로 groupBy 호출해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      await getUsedAmountByDetail([eduKey], 2026);

      expect(prisma.expenseItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['budgetCategory', 'budgetSubcategory', 'budgetDetail'],
        })
      );
    });

    it('OR 조건으로 각 키의 항/목/세목 조합을 필터해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      await getUsedAmountByDetail([eduKey, elementaryGiftKey], 2026);

      const callArgs = vi.mocked(prisma.expenseItem.groupBy).mock.calls[0][0] as any;
      expect(callArgs.where.OR).toEqual([
        {
          budgetCategory: eduKey.budgetCategory,
          budgetSubcategory: eduKey.budgetSubcategory,
          budgetDetail: eduKey.budgetDetail,
        },
        {
          budgetCategory: elementaryGiftKey.budgetCategory,
          budgetSubcategory: elementaryGiftKey.budgetSubcategory,
          budgetDetail: elementaryGiftKey.budgetDetail,
        },
      ]);
    });

    it('빈 키 배열이면 DB를 조회하지 않고 빈 Map을 반환해야 함', async () => {
      const result = await getUsedAmountByDetail([], 2026);

      expect(result.size).toBe(0);
      expect(prisma.expenseItem.groupBy).not.toHaveBeenCalled();
    });

    it('excludeExpenseId가 제공되면 해당 지출을 제외해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      await getUsedAmountByDetail([eduKey], 2026, 'expense-to-exclude');

      expect(prisma.expenseItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expense: expect.objectContaining({
              id: { not: 'expense-to-exclude' },
            }),
          }),
        })
      );
    });

    it('excludeExpenseId가 undefined이면 모든 지출을 포함해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      await getUsedAmountByDetail([eduKey], 2026);

      expect(prisma.expenseItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expense: expect.not.objectContaining({
              id: expect.anything(),
            }),
          }),
        })
      );
    });

    it('승인된 상태(APPROVED_STEP_1, APPROVED_STEP_2, APPROVED_FINAL)만 포함해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      await getUsedAmountByDetail([eduKey], 2026);

      expect(prisma.expenseItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expense: expect.objectContaining({
              status: { in: ['APPROVED_STEP_1', 'APPROVED_STEP_2', 'APPROVED_FINAL'] },
            }),
          }),
        })
      );
    });

    it('해당 연도의 지출만 포함해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      await getUsedAmountByDetail([eduKey], 2026);

      expect(prisma.expenseItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expense: expect.objectContaining({
              requestDate: {
                gte: new Date(2026, 0, 1),
                lt: new Date(2027, 0, 1),
              },
            }),
          }),
        })
      );
    });

    it('_sum.amount가 null이면 0으로 처리해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        {
          budgetCategory: eduKey.budgetCategory,
          budgetSubcategory: eduKey.budgetSubcategory,
          budgetDetail: eduKey.budgetDetail,
          _sum: { amount: null },
        },
      ] as any);

      const result = await getUsedAmountByDetail([eduKey], 2026);

      expect(result.get(makeBudgetDetailKey(eduKey))).toBe(0);
    });
  });

  describe('getAllUsedAmounts', () => {
    it('모든 항/목/세목 조합의 사용금액을 합성 키로 반환해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        {
          budgetCategory: '교육사역비',
          budgetSubcategory: '영유아사역비',
          budgetDetail: '행사비(선물)',
          _sum: { amount: 100000 },
        },
        {
          budgetCategory: '교육사역비',
          budgetSubcategory: '초등사역비',
          budgetDetail: '행사비(선물)',
          _sum: { amount: 200000 },
        },
      ] as any);

      const result = await getAllUsedAmounts(2026);

      expect(result.get(makeBudgetDetailKey(eduKey))).toBe(100000);
      expect(result.get(makeBudgetDetailKey(elementaryGiftKey))).toBe(200000);
    });

    it('항/목/세목 3-튜플로 groupBy 호출해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      await getAllUsedAmounts(2026);

      expect(prisma.expenseItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['budgetCategory', 'budgetSubcategory', 'budgetDetail'],
        })
      );
    });

    it('승인된 상태만 포함해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      await getAllUsedAmounts(2026);

      expect(prisma.expenseItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expense: expect.objectContaining({
              status: { in: ['APPROVED_STEP_1', 'APPROVED_STEP_2', 'APPROVED_FINAL'] },
            }),
          }),
        })
      );
    });

    it('해당 연도의 지출만 포함해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      await getAllUsedAmounts(2025);

      expect(prisma.expenseItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expense: expect.objectContaining({
              requestDate: {
                gte: new Date(2025, 0, 1),
                lt: new Date(2026, 0, 1),
              },
            }),
          }),
        })
      );
    });
  });
});
