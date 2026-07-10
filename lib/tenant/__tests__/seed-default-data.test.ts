/**
 * 기본 데이터 시딩 서비스 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { OrgType } from '@prisma/client';
import {
  seedDefaultData,
  hasDefaultData,
  linkDepartmentBudgetDetails,
  linkAllBudgetDetailsToAllDepartments,
  SeedDefaultDataParams,
} from '../seed-default-data';
import { getDefaultDataForOrgType } from '../default-chart-of-accounts';

// Mock Prisma 트랜잭션 클라이언트 생성
const createMockTx = () => {
  const createdCommittees: any[] = [];
  const createdDepartments: any[] = [];
  const createdCategories: any[] = [];
  const createdSubcategories: any[] = [];
  const createdDetails: any[] = [];
  const createdDepartmentBudgetDetails: any[] = [];

  let idCounter = 1;

  return {
    committee: {
      create: vi.fn().mockImplementation(({ data }) => {
        const committee = { id: `committee-${idCounter++}`, ...data };
        createdCommittees.push(committee);
        return Promise.resolve(committee);
      }),
      count: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          createdCommittees.filter((c) => c.tenantId === where.tenantId).length
        );
      }),
    },
    department: {
      create: vi.fn().mockImplementation(({ data }) => {
        const dept = { id: `department-${idCounter++}`, ...data };
        createdDepartments.push(dept);
        return Promise.resolve(dept);
      }),
      findMany: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          createdDepartments
            .filter((d) => d.tenantId === where.tenantId && d.isActive)
            .map((d) => ({ id: d.id }))
        );
      }),
    },
    budgetCategory: {
      create: vi.fn().mockImplementation(({ data }) => {
        const category = { id: `category-${idCounter++}`, ...data };
        createdCategories.push(category);
        return Promise.resolve(category);
      }),
      count: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          createdCategories.filter((c) => c.tenantId === where.tenantId).length
        );
      }),
    },
    budgetSubcategory: {
      create: vi.fn().mockImplementation(({ data }) => {
        const subcategory = { id: `subcategory-${idCounter++}`, ...data };
        createdSubcategories.push(subcategory);
        return Promise.resolve(subcategory);
      }),
    },
    budgetDetail: {
      create: vi.fn().mockImplementation(({ data }) => {
        const detail = { id: `detail-${idCounter++}`, ...data };
        createdDetails.push(detail);
        return Promise.resolve(detail);
      }),
      findMany: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          createdDetails
            .filter((d) => d.tenantId === where.tenantId && d.isActive)
            .map((d) => ({ id: d.id }))
        );
      }),
    },
    departmentBudgetDetail: {
      createMany: vi.fn().mockImplementation(({ data }) => {
        createdDepartmentBudgetDetails.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
    // 테스트 헬퍼
    _getCreatedData: () => ({
      committees: createdCommittees,
      departments: createdDepartments,
      categories: createdCategories,
      subcategories: createdSubcategories,
      details: createdDetails,
      departmentBudgetDetails: createdDepartmentBudgetDetails,
    }),
    _reset: () => {
      createdCommittees.length = 0;
      createdDepartments.length = 0;
      createdCategories.length = 0;
      createdSubcategories.length = 0;
      createdDetails.length = 0;
      createdDepartmentBudgetDetails.length = 0;
      idCounter = 1;
    },
  };
};

describe('seed-default-data', () => {
  const testTenantId = 'test-tenant-id';

  describe('seedDefaultData', () => {
    it('CHURCH: 올바른 수의 항목을 생성해야 함', async () => {
      const mockTx = createMockTx();
      const defaultData = getDefaultDataForOrgType(OrgType.CHURCH);

      const params: SeedDefaultDataParams = {
        tenantId: testTenantId,
        orgType: OrgType.CHURCH,
        tx: mockTx as any,
      };

      const result = await seedDefaultData(params);

      // 위원회 수 검증
      expect(result.committeesCreated).toBe(defaultData.committees.length);

      // 부서 수 검증
      const expectedDepartments = defaultData.committees.reduce(
        (sum, c) => sum + c.departments.length,
        0
      );
      expect(result.departmentsCreated).toBe(expectedDepartments);

      // 예산 항목(항) 수 검증
      expect(result.budgetCategoriesCreated).toBe(defaultData.budgetCategories.length);

      // 예산 목 수 검증
      const expectedSubcategories = defaultData.budgetCategories.reduce(
        (sum, c) => sum + c.subcategories.length,
        0
      );
      expect(result.budgetSubcategoriesCreated).toBe(expectedSubcategories);

      // 예산 세목 수 검증
      const expectedDetails = defaultData.budgetCategories.reduce(
        (sum, c) => sum + c.subcategories.reduce((s, sub) => s + sub.details.length, 0),
        0
      );
      expect(result.budgetDetailsCreated).toBe(expectedDetails);
    });

    it.each([OrgType.CHURCH, OrgType.NONPROFIT, OrgType.SCHOOL, OrgType.COMPANY, OrgType.OTHER])(
      '%s: 모든 생성된 항목에 올바른 tenantId가 설정되어야 함',
      async (orgType) => {
        const mockTx = createMockTx();

        const params: SeedDefaultDataParams = {
          tenantId: testTenantId,
          orgType,
          tx: mockTx as any,
        };

        await seedDefaultData(params);

        const data = mockTx._getCreatedData();

        // 모든 위원회에 tenantId 확인
        data.committees.forEach((committee) => {
          expect(committee.tenantId).toBe(testTenantId);
        });

        // 모든 부서에 tenantId 확인
        data.departments.forEach((dept) => {
          expect(dept.tenantId).toBe(testTenantId);
        });

        // 모든 예산 항목에 tenantId 확인
        data.categories.forEach((category) => {
          expect(category.tenantId).toBe(testTenantId);
        });

        data.subcategories.forEach((subcategory) => {
          expect(subcategory.tenantId).toBe(testTenantId);
        });

        data.details.forEach((detail) => {
          expect(detail.tenantId).toBe(testTenantId);
        });
      }
    );

    it('모든 생성된 항목이 isActive=true로 설정되어야 함', async () => {
      const mockTx = createMockTx();

      const params: SeedDefaultDataParams = {
        tenantId: testTenantId,
        orgType: OrgType.CHURCH,
        tx: mockTx as any,
      };

      await seedDefaultData(params);

      const data = mockTx._getCreatedData();

      data.committees.forEach((c) => expect(c.isActive).toBe(true));
      data.departments.forEach((d) => expect(d.isActive).toBe(true));
      data.categories.forEach((c) => expect(c.isActive).toBe(true));
      data.subcategories.forEach((s) => expect(s.isActive).toBe(true));
      data.details.forEach((d) => expect(d.isActive).toBe(true));
    });

    it('부서가 올바른 위원회에 연결되어야 함', async () => {
      const mockTx = createMockTx();

      const params: SeedDefaultDataParams = {
        tenantId: testTenantId,
        orgType: OrgType.CHURCH,
        tx: mockTx as any,
      };

      await seedDefaultData(params);

      const data = mockTx._getCreatedData();

      // 모든 부서에 committeeId가 있어야 함
      data.departments.forEach((dept) => {
        expect(dept.committeeId).toBeDefined();
        expect(dept.committeeId).toMatch(/^committee-/);
      });
    });

    it('예산 목이 올바른 항에 연결되어야 함', async () => {
      const mockTx = createMockTx();

      const params: SeedDefaultDataParams = {
        tenantId: testTenantId,
        orgType: OrgType.CHURCH,
        tx: mockTx as any,
      };

      await seedDefaultData(params);

      const data = mockTx._getCreatedData();

      // 모든 목에 categoryId가 있어야 함
      data.subcategories.forEach((sub) => {
        expect(sub.categoryId).toBeDefined();
        expect(sub.categoryId).toMatch(/^category-/);
      });
    });

    it('예산 세목이 올바른 목에 연결되어야 함', async () => {
      const mockTx = createMockTx();

      const params: SeedDefaultDataParams = {
        tenantId: testTenantId,
        orgType: OrgType.CHURCH,
        tx: mockTx as any,
      };

      await seedDefaultData(params);

      const data = mockTx._getCreatedData();

      // 모든 세목에 subcategoryId가 있어야 함
      data.details.forEach((detail) => {
        expect(detail.subcategoryId).toBeDefined();
        expect(detail.subcategoryId).toMatch(/^subcategory-/);
      });
    });
  });

  describe('hasDefaultData', () => {
    it('위원회가 있으면 true를 반환해야 함', async () => {
      const mockTx = createMockTx();
      mockTx.committee.count = vi.fn().mockResolvedValue(5);
      mockTx.budgetCategory.count = vi.fn().mockResolvedValue(0);

      const result = await hasDefaultData(mockTx as any, testTenantId);

      expect(result).toBe(true);
    });

    it('예산 항목이 있으면 true를 반환해야 함', async () => {
      const mockTx = createMockTx();
      mockTx.committee.count = vi.fn().mockResolvedValue(0);
      mockTx.budgetCategory.count = vi.fn().mockResolvedValue(10);

      const result = await hasDefaultData(mockTx as any, testTenantId);

      expect(result).toBe(true);
    });

    it('데이터가 없으면 false를 반환해야 함', async () => {
      const mockTx = createMockTx();
      mockTx.committee.count = vi.fn().mockResolvedValue(0);
      mockTx.budgetCategory.count = vi.fn().mockResolvedValue(0);

      const result = await hasDefaultData(mockTx as any, testTenantId);

      expect(result).toBe(false);
    });
  });

  describe('linkDepartmentBudgetDetails', () => {
    it('부서에 예산 세목을 연결해야 함', async () => {
      const mockTx = createMockTx();
      const departmentId = 'dept-1';
      const budgetDetailIds = ['detail-1', 'detail-2', 'detail-3'];

      await linkDepartmentBudgetDetails(
        mockTx as any,
        testTenantId,
        departmentId,
        budgetDetailIds
      );

      expect(mockTx.departmentBudgetDetail.createMany).toHaveBeenCalledWith({
        data: budgetDetailIds.map((id) => ({
          tenantId: testTenantId,
          departmentId,
          budgetDetailId: id,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    });

    it('빈 배열로 호출해도 오류가 발생하지 않아야 함', async () => {
      const mockTx = createMockTx();

      await expect(
        linkDepartmentBudgetDetails(mockTx as any, testTenantId, 'dept-1', [])
      ).resolves.not.toThrow();
    });
  });

  describe('linkAllBudgetDetailsToAllDepartments', () => {
    it('모든 부서와 세목의 조합을 생성해야 함', async () => {
      const mockTx = createMockTx();

      // 부서 3개, 세목 4개 모킹
      mockTx.department.findMany = vi.fn().mockResolvedValue([
        { id: 'dept-1' },
        { id: 'dept-2' },
        { id: 'dept-3' },
      ]);
      mockTx.budgetDetail.findMany = vi.fn().mockResolvedValue([
        { id: 'detail-1' },
        { id: 'detail-2' },
        { id: 'detail-3' },
        { id: 'detail-4' },
      ]);

      const result = await linkAllBudgetDetailsToAllDepartments(
        mockTx as any,
        testTenantId
      );

      // 3 * 4 = 12 조합
      expect(result).toBe(12);
      expect(mockTx.departmentBudgetDetail.createMany).toHaveBeenCalled();

      const callArgs = mockTx.departmentBudgetDetail.createMany.mock.calls[0][0];
      expect(callArgs.data.length).toBe(12);
    });

    it('부서가 없으면 0을 반환해야 함', async () => {
      const mockTx = createMockTx();
      mockTx.department.findMany = vi.fn().mockResolvedValue([]);
      mockTx.budgetDetail.findMany = vi.fn().mockResolvedValue([
        { id: 'detail-1' },
      ]);

      const result = await linkAllBudgetDetailsToAllDepartments(
        mockTx as any,
        testTenantId
      );

      expect(result).toBe(0);
      expect(mockTx.departmentBudgetDetail.createMany).not.toHaveBeenCalled();
    });

    it('예산 세목이 없으면 0을 반환해야 함', async () => {
      const mockTx = createMockTx();
      mockTx.department.findMany = vi.fn().mockResolvedValue([
        { id: 'dept-1' },
      ]);
      mockTx.budgetDetail.findMany = vi.fn().mockResolvedValue([]);

      const result = await linkAllBudgetDetailsToAllDepartments(
        mockTx as any,
        testTenantId
      );

      expect(result).toBe(0);
      expect(mockTx.departmentBudgetDetail.createMany).not.toHaveBeenCalled();
    });
  });
});
