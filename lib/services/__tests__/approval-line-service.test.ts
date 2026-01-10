/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateApprovalLine,
  calculateApprovalLineForExpense,
  createApprovalLineForExpense,
  submitExpenseWithApprovalLine,
} from '../approval-line-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userYearRole: {
      findFirst: vi.fn(),
    },
    budgetDetailYear: {
      findUnique: vi.fn(),
    },
    budgetDetail: {
      findFirst: vi.fn(),
    },
    approvalLine: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    expense: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    approvalLog: {
      create: vi.fn(),
    },
  },
}));

describe('approval-line-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateApprovalLine', () => {
    it('should calculate approval line for general case (담당자 ≠ 재정팀장)', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };
      const accountant = { id: 'acc-1', username: '회계', userid: 'acc001' };
      const manager = { id: 'mgr-1', username: '담당자', userid: 'mgr001' };

      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        id: 'bdy-1',
        budgetDetailId: 'bd-1',
        year: 2024,
        managerId: 'mgr-1',
        budgetAmount: 1000000,
        usedAmount: 300000,
        manager,
        budgetDetail: { id: 'bd-1', name: '교육비' },
      } as any);

      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce({ user: accountant } as any);

      const result = await calculateApprovalLine('bd-1', 2024);

      expect(result).toMatchObject({
        budgetDetailId: 'bd-1',
        budgetDetailName: '교육비',
        managerId: 'mgr-1',
        managerName: '담당자',
        isDirectApproval: false,
        totalSteps: 3,
        year: 2024,
      });

      expect(result.steps).toHaveLength(3);
      expect(result.steps[0]).toMatchObject({
        stepNumber: 1,
        stepName: '담당자',
        role: 'manager',
        approverId: 'mgr-1',
        approverName: '담당자',
        isAutoApproved: false,
      });
      expect(result.steps[1]).toMatchObject({
        stepNumber: 2,
        stepName: '회계',
        role: 'accountant',
        approverId: 'acc-1',
        approverName: '회계',
        isAutoApproved: false,
      });
      expect(result.steps[2]).toMatchObject({
        stepNumber: 3,
        stepName: '재정팀장',
        role: 'finance_head',
        approverId: 'fh-1',
        approverName: '재정팀장',
        isAutoApproved: false,
      });

      expect(result.budget).toEqual({
        budgetAmount: 1000000,
        usedAmount: 300000,
        remainingAmount: 700000,
        isOverBudget: false,
      });
    });

    it('should calculate approval line for direct approval case (담당자 = 재정팀장)', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };
      const accountant = { id: 'acc-1', username: '회계', userid: 'acc001' };

      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        id: 'bdy-1',
        budgetDetailId: 'bd-1',
        year: 2024,
        managerId: 'fh-1',
        budgetAmount: 2000000,
        usedAmount: 500000,
        manager: financeHead,
        budgetDetail: { id: 'bd-1', name: '운영비' },
      } as any);

      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce({ user: accountant } as any);

      const result = await calculateApprovalLine('bd-1', 2024);

      expect(result).toMatchObject({
        budgetDetailId: 'bd-1',
        budgetDetailName: '운영비',
        managerId: 'fh-1',
        managerName: '재정팀장',
        isDirectApproval: true,
        totalSteps: 3,
        year: 2024,
      });

      expect(result.steps).toHaveLength(3);
      expect(result.steps[0]).toMatchObject({
        stepNumber: 1,
        stepName: '재정팀장(전결)',
        role: 'finance_head',
        approverId: 'fh-1',
        approverName: '재정팀장',
        isAutoApproved: true, // 자동 승인
      });
      expect(result.steps[1]).toMatchObject({
        stepNumber: 2,
        stepName: '회계',
        role: 'accountant',
        approverId: 'acc-1',
        approverName: '회계',
        isAutoApproved: false,
      });
      expect(result.steps[2]).toMatchObject({
        stepNumber: 3,
        stepName: '재정팀장',
        role: 'finance_head',
        approverId: 'fh-1',
        approverName: '재정팀장',
        isAutoApproved: false,
      });
    });

    it('should handle budget overrun case', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };
      const accountant = { id: 'acc-1', username: '회계', userid: 'acc001' };
      const manager = { id: 'mgr-1', username: '담당자', userid: 'mgr001' };

      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        id: 'bdy-1',
        budgetDetailId: 'bd-1',
        year: 2024,
        managerId: 'mgr-1',
        budgetAmount: 1000000,
        usedAmount: 1200000, // 초과
        manager,
        budgetDetail: { id: 'bd-1', name: '교육비' },
      } as any);

      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce({ user: accountant } as any);

      const result = await calculateApprovalLine('bd-1', 2024);

      expect(result.budget).toEqual({
        budgetAmount: 1000000,
        usedAmount: 1200000,
        remainingAmount: -200000,
        isOverBudget: true,
      });
    });

    it('should use finance head as default manager when manager is not assigned', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };
      const accountant = { id: 'acc-1', username: '회계', userid: 'acc001' };

      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        id: 'bdy-1',
        budgetDetailId: 'bd-1',
        year: 2024,
        managerId: null,
        budgetAmount: 1000000,
        usedAmount: 0,
        manager: null,
        budgetDetail: { id: 'bd-1', name: '교육비' },
      } as any);

      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce({ user: accountant } as any);

      const result = await calculateApprovalLine('bd-1', 2024);

      expect(result).toMatchObject({
        managerId: null,
        managerName: null,
        isDirectApproval: false,
      });

      expect(result.steps[0]).toMatchObject({
        stepNumber: 1,
        stepName: '담당자(미지정)',
        role: 'manager',
        approverId: 'fh-1', // 재정팀장이 대체
        approverName: '재정팀장',
        isAutoApproved: false,
      });
    });

    it('should throw error if finance head is not found', async () => {
      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        id: 'bdy-1',
        budgetDetailId: 'bd-1',
        year: 2024,
        managerId: 'mgr-1',
        budgetAmount: 1000000,
        usedAmount: 0,
        manager: { id: 'mgr-1', username: '담당자', userid: 'mgr001' },
        budgetDetail: { id: 'bd-1', name: '교육비' },
      } as any);

      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValueOnce(null); // 재정팀장 없음

      await expect(calculateApprovalLine('bd-1', 2024)).rejects.toThrow(
        '2024년 재정팀장이 설정되지 않았습니다.'
      );
    });

    it('should throw error if accountant is not found', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };

      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        id: 'bdy-1',
        budgetDetailId: 'bd-1',
        year: 2024,
        managerId: 'mgr-1',
        budgetAmount: 1000000,
        usedAmount: 0,
        manager: { id: 'mgr-1', username: '담당자', userid: 'mgr001' },
        budgetDetail: { id: 'bd-1', name: '교육비' },
      } as any);

      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce(null); // 회계 없음

      await expect(calculateApprovalLine('bd-1', 2024)).rejects.toThrow(
        '2024년 회계가 설정되지 않았습니다.'
      );
    });
  });

  describe('calculateApprovalLineForExpense', () => {
    it('should find budget detail and calculate approval line', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };
      const accountant = { id: 'acc-1', username: '회계', userid: 'acc001' };
      const manager = { id: 'mgr-1', username: '담당자', userid: 'mgr001' };

      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({
        id: 'bd-1',
        name: '교육비',
      } as any);

      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        id: 'bdy-1',
        budgetDetailId: 'bd-1',
        year: 2024,
        managerId: 'mgr-1',
        budgetAmount: 1000000,
        usedAmount: 0,
        manager,
        budgetDetail: { id: 'bd-1', name: '교육비' },
      } as any);

      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce({ user: accountant } as any);

      const result = await calculateApprovalLineForExpense(
        '사역비',
        '교육비',
        '교육비',
        2024
      );

      expect(result.budgetDetailId).toBe('bd-1');
      expect(result.budgetDetailName).toBe('교육비');
    });

    it('should return default approval line when budget detail is not found', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };
      const accountant = { id: 'acc-1', username: '회계', userid: 'acc001' };

      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce({ user: accountant } as any);

      const result = await calculateApprovalLineForExpense(
        '사역비',
        '교육비',
        '교육비',
        2024
      );

      expect(result).toMatchObject({
        managerId: null,
        managerName: null,
        isDirectApproval: false,
        totalSteps: 3,
        year: 2024,
      });

      expect(result.steps[0]).toMatchObject({
        stepNumber: 1,
        stepName: '담당자(미지정)',
        approverId: 'fh-1',
      });
    });

    it('should throw error if finance head not found when budget detail missing', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValueOnce(null);

      await expect(
        calculateApprovalLineForExpense('사역비', '교육비', '교육비', 2024)
      ).rejects.toThrow('2024년 재정팀장이 설정되지 않았습니다.');
    });

    it('should throw error if accountant not found when budget detail missing', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };

      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce(null);

      await expect(
        calculateApprovalLineForExpense('사역비', '교육비', '교육비', 2024)
      ).rejects.toThrow('2024년 회계가 설정되지 않았습니다.');
    });
  });

  describe('createApprovalLineForExpense', () => {
    it('should delete existing approval line and create new one', async () => {
      const approvalLineInfo = {
        budgetDetailId: 'bd-1',
        budgetDetailName: '교육비',
        managerId: 'mgr-1',
        managerName: '담당자',
        isDirectApproval: false,
        totalSteps: 3,
        year: 2024,
        steps: [
          {
            stepNumber: 1,
            stepName: '담당자',
            role: 'manager',
            approverId: 'mgr-1',
            approverName: '담당자',
            isAutoApproved: false,
          },
          {
            stepNumber: 2,
            stepName: '회계',
            role: 'accountant',
            approverId: 'acc-1',
            approverName: '회계',
            isAutoApproved: false,
          },
          {
            stepNumber: 3,
            stepName: '재정팀장',
            role: 'finance_head',
            approverId: 'fh-1',
            approverName: '재정팀장',
            isAutoApproved: false,
          },
        ],
      };

      vi.mocked(prisma.approvalLine.deleteMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.approvalLine.create).mockResolvedValue({
        id: 'al-1',
        expenseId: 'exp-1',
        currentStep: 1,
        totalSteps: 3,
        steps: [],
      } as any);

      await createApprovalLineForExpense('exp-1', approvalLineInfo);

      expect(prisma.approvalLine.deleteMany).toHaveBeenCalledWith({
        where: { expenseId: 'exp-1' },
      });

      expect(prisma.approvalLine.create).toHaveBeenCalledWith({
        data: {
          expenseId: 'exp-1',
          currentStep: 1,
          totalSteps: 3,
          isUrgent: false,
          snapshot: expect.any(String),
          steps: {
            create: expect.arrayContaining([
              expect.objectContaining({
                stepNumber: 1,
                stepName: '담당자',
                approverName: '담당자',
                status: 'PENDING',
                approvedAt: null,
                isRequired: true,
                isParallel: false,
              }),
            ]),
          },
        },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' },
          },
        },
      });
    });

    it('should set currentStep to 2 for direct approval case', async () => {
      const approvalLineInfo = {
        budgetDetailId: 'bd-1',
        budgetDetailName: '운영비',
        managerId: 'fh-1',
        managerName: '재정팀장',
        isDirectApproval: true,
        totalSteps: 3,
        year: 2024,
        steps: [
          {
            stepNumber: 1,
            stepName: '재정팀장(전결)',
            role: 'finance_head',
            approverId: 'fh-1',
            approverName: '재정팀장',
            isAutoApproved: true,
          },
          {
            stepNumber: 2,
            stepName: '회계',
            role: 'accountant',
            approverId: 'acc-1',
            approverName: '회계',
            isAutoApproved: false,
          },
          {
            stepNumber: 3,
            stepName: '재정팀장',
            role: 'finance_head',
            approverId: 'fh-1',
            approverName: '재정팀장',
            isAutoApproved: false,
          },
        ],
      };

      vi.mocked(prisma.approvalLine.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.approvalLine.create).mockResolvedValue({
        id: 'al-1',
        expenseId: 'exp-1',
        currentStep: 2,
        totalSteps: 3,
        steps: [],
      } as any);

      await createApprovalLineForExpense('exp-1', approvalLineInfo);

      expect(prisma.approvalLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentStep: 2, // 전결인 경우 2단계부터 시작
          }),
        })
      );
    });
  });

  describe('submitExpenseWithApprovalLine', () => {
    it('should create approval line and update expense status', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };
      const accountant = { id: 'acc-1', username: '회계', userid: 'acc001' };
      const manager = { id: 'mgr-1', username: '담당자', userid: 'mgr001' };

      vi.mocked(prisma.expense.findUnique).mockResolvedValue({
        id: 'exp-1',
        applicantName: '신청자',
        requestDate: new Date('2024-01-15'),
        budgetCategory: '사역비',
        budgetSubcategory: '교육비',
        items: [{ id: 'item-1', budgetDetail: '교육비' }],
      } as any);

      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({
        id: 'bd-1',
        name: '교육비',
      } as any);

      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        id: 'bdy-1',
        budgetDetailId: 'bd-1',
        year: 2024,
        managerId: 'mgr-1',
        budgetAmount: 1000000,
        usedAmount: 0,
        manager,
        budgetDetail: { id: 'bd-1', name: '교육비' },
      } as any);

      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce({ user: accountant } as any);

      vi.mocked(prisma.approvalLine.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.approvalLine.create).mockResolvedValue({
        id: 'al-1',
        expenseId: 'exp-1',
        currentStep: 1,
        totalSteps: 3,
        steps: [],
      } as any);

      vi.mocked(prisma.expense.update).mockResolvedValue({
        id: 'exp-1',
        status: 'PENDING',
      } as any);

      vi.mocked(prisma.approvalLog.create).mockResolvedValue({
        id: 'log-1',
      } as any);

      const result = await submitExpenseWithApprovalLine('exp-1');

      expect(result.newStatus).toBe('PENDING');
      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: {
          status: 'PENDING',
          submittedAt: expect.any(Date),
        },
      });

      expect(prisma.approvalLog.create).toHaveBeenCalledWith({
        data: {
          expenseId: 'exp-1',
          action: 'SUBMIT',
          actorName: '신청자',
          previousStatus: 'DRAFT',
          newStatus: 'PENDING',
          comment: '제출 완료',
          afterSnapshot: expect.any(String),
        },
      });
    });

    it('should auto-approve first step for direct approval case', async () => {
      const financeHead = { id: 'fh-1', username: '재정팀장', userid: 'fh001' };
      const accountant = { id: 'acc-1', username: '회계', userid: 'acc001' };

      vi.mocked(prisma.expense.findUnique).mockResolvedValue({
        id: 'exp-1',
        applicantName: '재정팀장',
        requestDate: new Date('2024-01-15'),
        budgetCategory: '사역비',
        budgetSubcategory: '운영비',
        items: [{ id: 'item-1', budgetDetail: '운영비' }],
      } as any);

      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({
        id: 'bd-1',
        name: '운영비',
      } as any);

      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        id: 'bdy-1',
        budgetDetailId: 'bd-1',
        year: 2024,
        managerId: 'fh-1',
        budgetAmount: 2000000,
        usedAmount: 0,
        manager: financeHead,
        budgetDetail: { id: 'bd-1', name: '운영비' },
      } as any);

      vi.mocked(prisma.userYearRole.findFirst)
        .mockResolvedValueOnce({ user: financeHead } as any)
        .mockResolvedValueOnce({ user: accountant } as any);

      vi.mocked(prisma.approvalLine.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.approvalLine.create).mockResolvedValue({
        id: 'al-1',
        expenseId: 'exp-1',
        currentStep: 2,
        totalSteps: 3,
        steps: [],
      } as any);

      vi.mocked(prisma.expense.update).mockResolvedValue({
        id: 'exp-1',
        status: 'APPROVED_STEP_1',
      } as any);

      vi.mocked(prisma.approvalLog.create).mockResolvedValue({
        id: 'log-1',
      } as any);

      const result = await submitExpenseWithApprovalLine('exp-1');

      expect(result.newStatus).toBe('APPROVED_STEP_1');
      expect(result.approvalLineInfo.isDirectApproval).toBe(true);

      expect(prisma.approvalLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          comment: '제출 완료 (1차 전결 자동 승인)',
        }),
      });
    });

    it('should throw error if expense is not found', async () => {
      vi.mocked(prisma.expense.findUnique).mockResolvedValue(null);

      await expect(submitExpenseWithApprovalLine('exp-1')).rejects.toThrow(
        '지출결의서를 찾을 수 없습니다.'
      );
    });

    it('should throw error if expense has no items', async () => {
      vi.mocked(prisma.expense.findUnique).mockResolvedValue({
        id: 'exp-1',
        applicantName: '신청자',
        requestDate: new Date('2024-01-15'),
        budgetCategory: '사역비',
        budgetSubcategory: '교육비',
        items: [],
      } as any);

      await expect(submitExpenseWithApprovalLine('exp-1')).rejects.toThrow(
        '지출결의서 항목이 없습니다.'
      );
    });
  });
});
