/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  lookupBudgetHierarchy,
  lookupBudgetHierarchyById,
  isFinanceHeadManager,
} from '../budget-lookup-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    budgetDetail: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    departmentBudgetDetail: {
      findFirst: vi.fn(),
    },
    budgetDetailYear: {
      findUnique: vi.fn(),
    },
    userYearRole: {
      findFirst: vi.fn(),
    },
  },
}));

describe('budget-lookup-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 테스트용 mock 데이터
  const mockBudgetDetail = {
    id: 'bd-1',
    name: '교육비',
    subcategory: {
      id: 'bs-1',
      name: '직원교육',
      category: {
        id: 'bc-1',
        name: '사무행정비',
      },
    },
  };

  const mockDeptBudgetDetail = {
    id: 'dbd-1',
    departmentId: 'dept-1',
    budgetDetailId: 'bd-1',
    isActive: true,
    department: {
      id: 'dept-1',
      name: '재정팀',
      committee: {
        id: 'comm-1',
        name: '기획위원회',
      },
    },
  };

  describe('lookupBudgetHierarchy', () => {
    it('should return budget hierarchy info when budget detail exists', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(mockBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(mockDeptBudgetDetail as any);

      const result = await lookupBudgetHierarchy('사무행정비', '직원교육', '교육비');

      expect(result).toEqual({
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '직원교육',
        budgetDetailId: 'bd-1',
      });

      expect(prisma.budgetDetail.findFirst).toHaveBeenCalledWith({
        where: {
          name: '교육비',
          subcategory: {
            name: '직원교육',
            category: {
              name: '사무행정비',
            },
          },
        },
        include: {
          subcategory: {
            include: {
              category: true,
            },
          },
        },
      });
    });

    it('should return null when budget detail is not found', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(null);

      const result = await lookupBudgetHierarchy('없는항목', '없는목', '없는세목');

      expect(result).toBeNull();
      expect(prisma.departmentBudgetDetail.findFirst).not.toHaveBeenCalled();
    });

    it('should return null when department budget detail is not found', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(mockBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(null);

      const result = await lookupBudgetHierarchy('사무행정비', '직원교육', '교육비');

      expect(result).toBeNull();
    });

    it('should only find active department budget details', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(mockBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(mockDeptBudgetDetail as any);

      await lookupBudgetHierarchy('사무행정비', '직원교육', '교육비');

      expect(prisma.departmentBudgetDetail.findFirst).toHaveBeenCalledWith({
        where: {
          budgetDetailId: 'bd-1',
          isActive: true,
        },
        include: {
          department: {
            include: {
              committee: true,
            },
          },
        },
      });
    });

    it('should handle different budget categories correctly', async () => {
      const differentBudgetDetail = {
        ...mockBudgetDetail,
        id: 'bd-2',
        name: '회의비',
        subcategory: {
          id: 'bs-2',
          name: '팀회의',
          category: {
            id: 'bc-2',
            name: '비전사역비',
          },
        },
      };

      const differentDeptBudgetDetail = {
        ...mockDeptBudgetDetail,
        budgetDetailId: 'bd-2',
        department: {
          id: 'dept-2',
          name: '선교팀',
          committee: {
            id: 'comm-2',
            name: '선교위원회',
          },
        },
      };

      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(differentBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(differentDeptBudgetDetail as any);

      const result = await lookupBudgetHierarchy('비전사역비', '팀회의', '회의비');

      expect(result).toEqual({
        committee: '선교위원회',
        department: '선교팀',
        budgetCategory: '비전사역비',
        budgetSubcategory: '팀회의',
        budgetDetailId: 'bd-2',
      });
    });
  });

  describe('lookupBudgetHierarchyById', () => {
    it('should return budget hierarchy info when budget detail exists by ID', async () => {
      vi.mocked(prisma.budgetDetail.findUnique).mockResolvedValue(mockBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(mockDeptBudgetDetail as any);

      const result = await lookupBudgetHierarchyById('bd-1');

      expect(result).toEqual({
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '직원교육',
        budgetDetailId: 'bd-1',
      });

      expect(prisma.budgetDetail.findUnique).toHaveBeenCalledWith({
        where: { id: 'bd-1' },
        include: {
          subcategory: {
            include: {
              category: true,
            },
          },
        },
      });
    });

    it('should return null when budget detail ID is not found', async () => {
      vi.mocked(prisma.budgetDetail.findUnique).mockResolvedValue(null);

      const result = await lookupBudgetHierarchyById('non-existent-id');

      expect(result).toBeNull();
      expect(prisma.departmentBudgetDetail.findFirst).not.toHaveBeenCalled();
    });

    it('should return null when department budget detail is not found by ID', async () => {
      vi.mocked(prisma.budgetDetail.findUnique).mockResolvedValue(mockBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(null);

      const result = await lookupBudgetHierarchyById('bd-1');

      expect(result).toBeNull();
    });

    it('should only find active department budget details by ID', async () => {
      vi.mocked(prisma.budgetDetail.findUnique).mockResolvedValue(mockBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(mockDeptBudgetDetail as any);

      await lookupBudgetHierarchyById('bd-1');

      expect(prisma.departmentBudgetDetail.findFirst).toHaveBeenCalledWith({
        where: {
          budgetDetailId: 'bd-1',
          isActive: true,
        },
        include: {
          department: {
            include: {
              committee: true,
            },
          },
        },
      });
    });
  });

  describe('BudgetHierarchyInfo type', () => {
    it('should have correct structure', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(mockBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(mockDeptBudgetDetail as any);

      const result = await lookupBudgetHierarchy('사무행정비', '직원교육', '교육비');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('committee');
      expect(result).toHaveProperty('department');
      expect(result).toHaveProperty('budgetCategory');
      expect(result).toHaveProperty('budgetSubcategory');
      expect(result).toHaveProperty('budgetDetailId');

      // Type checks
      expect(typeof result!.committee).toBe('string');
      expect(typeof result!.department).toBe('string');
      expect(typeof result!.budgetCategory).toBe('string');
      expect(typeof result!.budgetSubcategory).toBe('string');
      expect(typeof result!.budgetDetailId).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string parameters', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(null);

      const result = await lookupBudgetHierarchy('', '', '');

      expect(result).toBeNull();
    });

    it('should handle special characters in names', async () => {
      const specialBudgetDetail = {
        ...mockBudgetDetail,
        name: '교육비 (특별)',
        subcategory: {
          ...mockBudgetDetail.subcategory,
          name: '직원교육/연수',
          category: {
            ...mockBudgetDetail.subcategory.category,
            name: '사무행정비 & 기타',
          },
        },
      };

      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(specialBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(mockDeptBudgetDetail as any);

      const result = await lookupBudgetHierarchy(
        '사무행정비 & 기타',
        '직원교육/연수',
        '교육비 (특별)'
      );

      expect(result).toBeDefined();
      expect(result!.budgetCategory).toBe('사무행정비 & 기타');
      expect(result!.budgetSubcategory).toBe('직원교육/연수');
    });

    it('should handle Korean names correctly', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(mockBudgetDetail as any);
      vi.mocked(prisma.departmentBudgetDetail.findFirst).mockResolvedValue(mockDeptBudgetDetail as any);

      const result = await lookupBudgetHierarchy('사무행정비', '직원교육', '교육비');

      expect(result!.committee).toBe('기획위원회');
      expect(result!.department).toBe('재정팀');
    });
  });

  describe('isFinanceHeadManager', () => {
    const mockFinanceHead = { id: 'fh-1', username: '재정팀장' };
    const mockManager = { id: 'mgr-1', username: '일반담당자' };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return isFinanceHead true when manager is finance head', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({ id: 'bd-1' } as any);
      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        manager: mockFinanceHead,
      } as any);
      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValue({
        user: mockFinanceHead,
      } as any);

      const result = await isFinanceHeadManager('사무행정비', '직원교육', '교육비', 2024);

      expect(result.isFinanceHead).toBe(true);
      expect(result.managerName).toBe('재정팀장');
      expect(result.financeHeadName).toBe('재정팀장');
    });

    it('should return isFinanceHead false when manager is not finance head', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({ id: 'bd-1' } as any);
      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        manager: mockManager,
      } as any);
      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValue({
        user: mockFinanceHead,
      } as any);

      const result = await isFinanceHeadManager('사무행정비', '직원교육', '교육비', 2024);

      expect(result.isFinanceHead).toBe(false);
      expect(result.managerName).toBe('일반담당자');
      expect(result.financeHeadName).toBe('재정팀장');
    });

    it('should return isFinanceHead false when budget detail not found', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue(null);

      const result = await isFinanceHeadManager('없는항', '없는목', '없는세목', 2024);

      expect(result.isFinanceHead).toBe(false);
      expect(result.managerName).toBeNull();
      expect(result.financeHeadName).toBeNull();
    });

    it('should return isFinanceHead false when finance head not configured', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({ id: 'bd-1' } as any);
      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        manager: mockManager,
      } as any);
      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValue(null);

      const result = await isFinanceHeadManager('사무행정비', '직원교육', '교육비', 2024);

      expect(result.isFinanceHead).toBe(false);
      expect(result.managerName).toBe('일반담당자');
      expect(result.financeHeadName).toBeNull();
    });

    it('should return isFinanceHead false when manager not assigned', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({ id: 'bd-1' } as any);
      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue({
        manager: null,
      } as any);
      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValue({
        user: mockFinanceHead,
      } as any);

      const result = await isFinanceHeadManager('사무행정비', '직원교육', '교육비', 2024);

      expect(result.isFinanceHead).toBe(false);
      expect(result.managerName).toBeNull();
      expect(result.financeHeadName).toBe('재정팀장');
    });

    it('should return isFinanceHead false when budgetDetailYear not found', async () => {
      vi.mocked(prisma.budgetDetail.findFirst).mockResolvedValue({ id: 'bd-1' } as any);
      vi.mocked(prisma.budgetDetailYear.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userYearRole.findFirst).mockResolvedValue({
        user: mockFinanceHead,
      } as any);

      const result = await isFinanceHeadManager('사무행정비', '직원교육', '교육비', 2024);

      expect(result.isFinanceHead).toBe(false);
      expect(result.managerName).toBeNull();
      expect(result.financeHeadName).toBe('재정팀장');
    });
  });
});
