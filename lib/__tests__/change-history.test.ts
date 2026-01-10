/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  logYearRoleChange,
  logBudgetDetailYearChange,
  logYearRoleBulkChange,
  logBudgetDetailYearBulkChange,
} from '../change-history';

// Mock Prisma client
const mockCreate = vi.fn();
const mockCreateMany = vi.fn();

const mockTx = {
  userYearRoleHistory: {
    create: mockCreate,
    createMany: mockCreateMany,
  },
  budgetDetailYearHistory: {
    create: mockCreate,
    createMany: mockCreateMany,
  },
} as any;

describe('change-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logYearRoleChange', () => {
    it('should create user year role history record', async () => {
      const change = {
        userYearRoleId: 'year-role-1',
        userId: 'user-1',
        year: 2024,
        action: 'CREATE' as const,
        changedBy: 'admin',
        changedById: 'admin-1',
        newRole: 'finance_head',
        newDept: '재정부',
      };

      mockCreate.mockResolvedValue({ id: 'history-1' });

      await logYearRoleChange(mockTx, change);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userYearRoleId: 'year-role-1',
          userId: 'user-1',
          year: 2024,
          action: 'CREATE',
          changedBy: 'admin',
          changedById: 'admin-1',
          previousRole: undefined,
          previousDept: undefined,
          newRole: 'finance_head',
          newDept: '재정부',
        },
      });
    });

    it('should log UPDATE action with previous and new values', async () => {
      const change = {
        userYearRoleId: 'year-role-1',
        userId: 'user-1',
        year: 2024,
        action: 'UPDATE' as const,
        changedBy: 'admin',
        changedById: 'admin-1',
        previousRole: 'user',
        previousDept: '총무부',
        newRole: 'team_leader',
        newDept: '재정부',
      };

      mockCreate.mockResolvedValue({ id: 'history-2' });

      await logYearRoleChange(mockTx, change);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userYearRoleId: 'year-role-1',
          userId: 'user-1',
          year: 2024,
          action: 'UPDATE',
          changedBy: 'admin',
          changedById: 'admin-1',
          previousRole: 'user',
          previousDept: '총무부',
          newRole: 'team_leader',
          newDept: '재정부',
        },
      });
    });

    it('should log DELETE action', async () => {
      const change = {
        userYearRoleId: 'year-role-1',
        userId: 'user-1',
        year: 2024,
        action: 'DELETE' as const,
        changedBy: 'admin',
        changedById: 'admin-1',
        previousRole: 'finance_head',
        previousDept: '재정부',
      };

      mockCreate.mockResolvedValue({ id: 'history-3' });

      await logYearRoleChange(mockTx, change);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userYearRoleId: 'year-role-1',
          userId: 'user-1',
          year: 2024,
          action: 'DELETE',
          changedBy: 'admin',
          changedById: 'admin-1',
          previousRole: 'finance_head',
          previousDept: '재정부',
          newRole: undefined,
          newDept: undefined,
        },
      });
    });
  });

  describe('logBudgetDetailYearChange', () => {
    it('should create budget detail year history record', async () => {
      const change = {
        budgetDetailYearId: 'budget-year-1',
        budgetDetailId: 'detail-1',
        budgetDetailName: '교육비',
        year: 2024,
        action: 'CREATE' as const,
        changedBy: 'admin',
        changedById: 'admin-1',
        newManagerId: 'manager-1',
        newManagerName: '김담당',
        newBudgetAmt: 1000000,
      };

      mockCreate.mockResolvedValue({ id: 'history-1' });

      await logBudgetDetailYearChange(mockTx, change);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          budgetDetailYearId: 'budget-year-1',
          budgetDetailId: 'detail-1',
          budgetDetailName: '교육비',
          year: 2024,
          action: 'CREATE',
          changedBy: 'admin',
          changedById: 'admin-1',
          previousManagerId: undefined,
          previousManagerName: undefined,
          previousBudgetAmt: undefined,
          newManagerId: 'manager-1',
          newManagerName: '김담당',
          newBudgetAmt: 1000000,
        },
      });
    });

    it('should log UPDATE action with budget changes', async () => {
      const change = {
        budgetDetailYearId: 'budget-year-1',
        budgetDetailId: 'detail-1',
        budgetDetailName: '교육비',
        year: 2024,
        action: 'UPDATE' as const,
        changedBy: 'admin',
        changedById: 'admin-1',
        previousManagerId: 'manager-1',
        previousManagerName: '김담당',
        previousBudgetAmt: 1000000,
        newManagerId: 'manager-2',
        newManagerName: '박담당',
        newBudgetAmt: 1500000,
      };

      mockCreate.mockResolvedValue({ id: 'history-2' });

      await logBudgetDetailYearChange(mockTx, change);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          budgetDetailYearId: 'budget-year-1',
          budgetDetailId: 'detail-1',
          budgetDetailName: '교육비',
          year: 2024,
          action: 'UPDATE',
          changedBy: 'admin',
          changedById: 'admin-1',
          previousManagerId: 'manager-1',
          previousManagerName: '김담당',
          previousBudgetAmt: 1000000,
          newManagerId: 'manager-2',
          newManagerName: '박담당',
          newBudgetAmt: 1500000,
        },
      });
    });

    it('should log DELETE action', async () => {
      const change = {
        budgetDetailYearId: 'budget-year-1',
        budgetDetailId: 'detail-1',
        budgetDetailName: '교육비',
        year: 2024,
        action: 'DELETE' as const,
        changedBy: 'admin',
        changedById: 'admin-1',
        previousManagerId: 'manager-1',
        previousManagerName: '김담당',
        previousBudgetAmt: 1000000,
      };

      mockCreate.mockResolvedValue({ id: 'history-3' });

      await logBudgetDetailYearChange(mockTx, change);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          budgetDetailYearId: 'budget-year-1',
          budgetDetailId: 'detail-1',
          budgetDetailName: '교육비',
          year: 2024,
          action: 'DELETE',
          changedBy: 'admin',
          changedById: 'admin-1',
          previousManagerId: 'manager-1',
          previousManagerName: '김담당',
          previousBudgetAmt: 1000000,
          newManagerId: undefined,
          newManagerName: undefined,
          newBudgetAmt: undefined,
        },
      });
    });
  });

  describe('logYearRoleBulkChange', () => {
    it('should create multiple user year role history records', async () => {
      const changes = [
        {
          userYearRoleId: 'year-role-1',
          userId: 'user-1',
          year: 2025,
          action: 'CREATE' as const,
          changedBy: 'admin',
          changedById: 'admin-1',
          newRole: 'finance_head',
          newDept: '재정부',
        },
        {
          userYearRoleId: 'year-role-2',
          userId: 'user-2',
          year: 2025,
          action: 'CREATE' as const,
          changedBy: 'admin',
          changedById: 'admin-1',
          newRole: 'accountant',
          newDept: '회계팀',
        },
      ];

      mockCreateMany.mockResolvedValue({ count: 2 });

      await logYearRoleBulkChange(mockTx, changes);

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          {
            userYearRoleId: 'year-role-1',
            userId: 'user-1',
            year: 2025,
            action: 'CREATE',
            changedBy: 'admin',
            changedById: 'admin-1',
            previousRole: undefined,
            previousDept: undefined,
            newRole: 'finance_head',
            newDept: '재정부',
          },
          {
            userYearRoleId: 'year-role-2',
            userId: 'user-2',
            year: 2025,
            action: 'CREATE',
            changedBy: 'admin',
            changedById: 'admin-1',
            previousRole: undefined,
            previousDept: undefined,
            newRole: 'accountant',
            newDept: '회계팀',
          },
        ],
      });
    });

    it('should return early if changes array is empty', async () => {
      await logYearRoleBulkChange(mockTx, []);

      expect(mockCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('logBudgetDetailYearBulkChange', () => {
    it('should create multiple budget detail year history records', async () => {
      const changes = [
        {
          budgetDetailYearId: 'budget-year-1',
          budgetDetailId: 'detail-1',
          budgetDetailName: '교육비',
          year: 2025,
          action: 'CREATE' as const,
          changedBy: 'admin',
          changedById: 'admin-1',
          newManagerId: 'manager-1',
          newManagerName: '김담당',
          newBudgetAmt: 1000000,
        },
        {
          budgetDetailYearId: 'budget-year-2',
          budgetDetailId: 'detail-2',
          budgetDetailName: '복리후생비',
          year: 2025,
          action: 'CREATE' as const,
          changedBy: 'admin',
          changedById: 'admin-1',
          newManagerId: 'manager-2',
          newManagerName: '박담당',
          newBudgetAmt: 2000000,
        },
      ];

      mockCreateMany.mockResolvedValue({ count: 2 });

      await logBudgetDetailYearBulkChange(mockTx, changes);

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          {
            budgetDetailYearId: 'budget-year-1',
            budgetDetailId: 'detail-1',
            budgetDetailName: '교육비',
            year: 2025,
            action: 'CREATE',
            changedBy: 'admin',
            changedById: 'admin-1',
            previousManagerId: undefined,
            previousManagerName: undefined,
            previousBudgetAmt: undefined,
            newManagerId: 'manager-1',
            newManagerName: '김담당',
            newBudgetAmt: 1000000,
          },
          {
            budgetDetailYearId: 'budget-year-2',
            budgetDetailId: 'detail-2',
            budgetDetailName: '복리후생비',
            year: 2025,
            action: 'CREATE',
            changedBy: 'admin',
            changedById: 'admin-1',
            previousManagerId: undefined,
            previousManagerName: undefined,
            previousBudgetAmt: undefined,
            newManagerId: 'manager-2',
            newManagerName: '박담당',
            newBudgetAmt: 2000000,
          },
        ],
      });
    });

    it('should return early if changes array is empty', async () => {
      await logBudgetDetailYearBulkChange(mockTx, []);

      expect(mockCreateMany).not.toHaveBeenCalled();
    });
  });
});
