/**
 * 자동이체 서비스 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    recurringExpense: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    expense: {
      create: vi.fn(),
    },
  },
}));

// Mock deriveRequestTeam
vi.mock('@/lib/domain/request-team', () => ({
  deriveRequestTeam: vi.fn().mockReturnValue('재정위원회/총무부'),
}));

// Mock calculateApprovalLineForExpense
vi.mock('@/lib/services/approval-line-service', () => ({
  calculateApprovalLineForExpense: vi.fn().mockResolvedValue({
    approvalLine: [{ role: 'team_leader', status: 'PENDING' }],
  }),
}));

// Import after mocking
import { prisma } from '@/lib/prisma';
import {
  generateExpenseFromRecurring,
  processRecurringExpenses,
  recalculateNextGenerationDate,
} from '../recurring-expense-service';

describe('recurring-expense-service', () => {
  const mockPrisma = prisma as unknown as {
    recurringExpense: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    expense: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateExpenseFromRecurring', () => {
    const mockRecurring = {
      id: 'rec-1',
      userId: 'user-1',
      name: '사무실 임대료',
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
      advanceDays: 7,
      status: 'ACTIVE',
      startDate: new Date('2025-01-01'),
      endDate: null,
      user: {
        id: 'user-1',
        username: '테스트유저',
        department: '총무부',
      },
    };

    it('자동이체에서 지출결의서를 생성해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue(mockRecurring);
      mockPrisma.expense.create.mockResolvedValue({ id: 'expense-1' });
      mockPrisma.recurringExpense.update.mockResolvedValue({});

      const result = await generateExpenseFromRecurring('rec-1');

      expect(result.success).toBe(true);
      expect(result.expenseId).toBe('expense-1');
      expect(mockPrisma.expense.create).toHaveBeenCalled();
      expect(mockPrisma.recurringExpense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec-1' },
          data: expect.objectContaining({
            lastGeneratedDate: expect.any(Date),
            nextGenerationDate: expect.any(Date),
          }),
        })
      );
    });

    it('존재하지 않는 자동이체는 실패해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue(null);

      const result = await generateExpenseFromRecurring('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('찾을 수 없');
    });

    it('비활성화된 자동이체는 생성하지 않아야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        ...mockRecurring,
        status: 'PAUSED',
      });

      const result = await generateExpenseFromRecurring('rec-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('활성화');
      expect(mockPrisma.expense.create).not.toHaveBeenCalled();
    });

    it('종료일이 지난 자동이체는 상태를 COMPLETED로 변경해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        ...mockRecurring,
        endDate: new Date('2020-01-01'), // 과거 날짜
      });
      mockPrisma.recurringExpense.update.mockResolvedValue({});

      const result = await generateExpenseFromRecurring('rec-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('종료일');
      expect(mockPrisma.recurringExpense.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { status: 'COMPLETED' },
      });
    });
  });

  describe('processRecurringExpenses', () => {
    it('생성이 필요한 모든 자동이체를 처리해야 함', async () => {
      const mockRecurringList = [
        {
          id: 'rec-1',
          status: 'ACTIVE',
          nextGenerationDate: new Date('2025-01-01'),
        },
        {
          id: 'rec-2',
          status: 'ACTIVE',
          nextGenerationDate: new Date('2025-01-02'),
        },
      ];

      mockPrisma.recurringExpense.findMany.mockResolvedValue(mockRecurringList);
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        ...mockRecurringList[0],
        userId: 'user-1',
        name: '테스트',
        committee: '재정위원회',
        department: '총무부',
        budgetCategory: '사무행정비',
        budgetSubcategory: '임차료',
        budgetDetail: '사무실 임대',
        recipientName: '홍길동',
        bankName: '국민은행',
        accountNumber: '123-456',
        baseAmount: 100000,
        frequency: 'MONTHLY',
        dayOfMonth: 25,
        advanceDays: 7,
        endDate: null,
        user: {
          id: 'user-1',
          username: '테스트유저',
          department: '총무부',
        },
      });
      mockPrisma.expense.create.mockResolvedValue({ id: 'expense-new' });
      mockPrisma.recurringExpense.update.mockResolvedValue({});

      const result = await processRecurringExpenses();

      expect(result.processed).toBe(2);
      expect(mockPrisma.recurringExpense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('처리할 자동이체가 없으면 0을 반환해야 함', async () => {
      mockPrisma.recurringExpense.findMany.mockResolvedValue([]);

      const result = await processRecurringExpenses();

      expect(result.processed).toBe(0);
      expect(result.generated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('recalculateNextGenerationDate', () => {
    it('다음 생성일을 재계산해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        frequency: 'MONTHLY',
        dayOfMonth: 25,
        advanceDays: 7,
        status: 'ACTIVE',
      });
      mockPrisma.recurringExpense.update.mockResolvedValue({});

      const result = await recalculateNextGenerationDate('rec-1');

      expect(result).toBeInstanceOf(Date);
      expect(mockPrisma.recurringExpense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec-1' },
          data: expect.objectContaining({
            nextGenerationDate: expect.any(Date),
          }),
        })
      );
    });

    it('비활성 자동이체는 null을 반환해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        frequency: 'MONTHLY',
        dayOfMonth: 25,
        advanceDays: 7,
        status: 'PAUSED',
      });

      const result = await recalculateNextGenerationDate('rec-1');

      expect(result).toBeNull();
      expect(mockPrisma.recurringExpense.update).not.toHaveBeenCalled();
    });

    it('존재하지 않는 자동이체는 null을 반환해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue(null);

      const result = await recalculateNextGenerationDate('invalid-id');

      expect(result).toBeNull();
    });
  });
});
