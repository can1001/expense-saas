/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getUsedAmountByDetail, getAllUsedAmounts } from '../budget-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expenseItem: {
      groupBy: vi.fn(),
    },
  },
}));

describe('budget-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsedAmountByDetail', () => {
    it('특정 세목의 사용금액을 반환해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        { budgetDetail: '교육비', _sum: { amount: 100000 } },
        { budgetDetail: '회의비', _sum: { amount: 50000 } },
      ] as any);

      const result = await getUsedAmountByDetail(['교육비', '회의비'], 2026);

      expect(result.get('교육비')).toBe(100000);
      expect(result.get('회의비')).toBe(50000);
    });

    it('excludeExpenseId가 제공되면 해당 지출을 제외해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        { budgetDetail: '교육비', _sum: { amount: 50000 } },
      ] as any);

      await getUsedAmountByDetail(['교육비'], 2026, 'expense-to-exclude');

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
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        { budgetDetail: '교육비', _sum: { amount: 150000 } },
      ] as any);

      await getUsedAmountByDetail(['교육비'], 2026);

      // id 조건이 없어야 함
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

      await getUsedAmountByDetail(['교육비'], 2026);

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

      await getUsedAmountByDetail(['교육비'], 2026);

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

    it('결과가 없으면 빈 Map을 반환해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([]);

      const result = await getUsedAmountByDetail(['교육비'], 2026);

      expect(result.size).toBe(0);
    });

    it('_sum.amount가 null이면 0으로 처리해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        { budgetDetail: '교육비', _sum: { amount: null } },
      ] as any);

      const result = await getUsedAmountByDetail(['교육비'], 2026);

      expect(result.get('교육비')).toBe(0);
    });

    it('여러 세목을 한 번에 조회할 수 있어야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        { budgetDetail: '교육비', _sum: { amount: 100000 } },
        { budgetDetail: '회의비', _sum: { amount: 200000 } },
        { budgetDetail: '출장비', _sum: { amount: 300000 } },
      ] as any);

      const result = await getUsedAmountByDetail(['교육비', '회의비', '출장비'], 2026);

      expect(result.size).toBe(3);
      expect(result.get('교육비')).toBe(100000);
      expect(result.get('회의비')).toBe(200000);
      expect(result.get('출장비')).toBe(300000);
    });
  });

  describe('getAllUsedAmounts', () => {
    it('모든 세목의 사용금액을 반환해야 함', async () => {
      vi.mocked(prisma.expenseItem.groupBy).mockResolvedValue([
        { budgetDetail: '교육비', _sum: { amount: 100000 } },
        { budgetDetail: '회의비', _sum: { amount: 50000 } },
      ] as any);

      const result = await getAllUsedAmounts(2026);

      expect(result.get('교육비')).toBe(100000);
      expect(result.get('회의비')).toBe(50000);
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
