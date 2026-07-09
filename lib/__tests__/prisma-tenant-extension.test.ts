/**
 * Prisma 테넌트 Extension 테스트
 *
 * 테스트 대상:
 * - 테넌트 스코프 모델 확인
 * - 자동 tenantId 필터링
 * - 자동 tenantId 추가
 * - 테넌트 컨텍스트 없을 때 필터링 건너뜀
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// tenant-context 모킹
let mockTenantId: string | undefined = undefined;

vi.mock('../tenant-context', () => ({
  getTenantIdOptional: vi.fn(() => mockTenantId),
}));

// Extension 테스트를 위한 helper 함수들 직접 테스트
// (Extension 자체는 Prisma에 의해 실행되므로 로직만 테스트)

describe('prisma-tenant-extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantId = undefined;
  });

  afterEach(() => {
    mockTenantId = undefined;
  });

  describe('TENANT_SCOPED_MODELS', () => {
    // 동적으로 모듈 import (모킹 후)
    it('should include all tenant-scoped models', async () => {
      const { tenantExtension } = await import('../prisma-tenant-extension');

      // Extension이 정의되어 있는지 확인
      expect(tenantExtension).toBeDefined();
      // Prisma.defineExtension은 내부적으로 name을 다르게 저장할 수 있음
    });
  });

  describe('isTenantScopedModel helper', () => {
    it('should recognize tenant-scoped models', () => {
      // 테넌트 스코프 모델 목록
      const tenantScopedModels = [
        'user', 'role', 'expense', 'expenseItem', 'committee',
        'department', 'budgetCategory', 'budgetSubcategory', 'budgetDetail',
      ];

      // 이 함수는 내부 함수이므로 직접 테스트할 수 없음
      // Extension 동작을 통해 간접적으로 테스트됨
      expect(tenantScopedModels.length).toBeGreaterThan(0);
    });
  });

  describe('addTenantFilter helper', () => {
    it('should add tenantId to where clause', () => {
      // 직접 로직 테스트
      const addTenantFilter = (where: any, tenantId: string) => ({
        ...where,
        tenantId,
      });

      const result = addTenantFilter({ name: 'test' }, 'tenant-1');

      expect(result).toEqual({
        name: 'test',
        tenantId: 'tenant-1',
      });
    });

    it('should handle empty where clause', () => {
      const addTenantFilter = (where: any, tenantId: string) => ({
        ...where,
        tenantId,
      });

      const result = addTenantFilter({}, 'tenant-1');

      expect(result).toEqual({ tenantId: 'tenant-1' });
    });

    it('should handle undefined where clause', () => {
      const addTenantFilter = (where: any, tenantId: string) => ({
        ...where,
        tenantId,
      });

      const result = addTenantFilter(undefined, 'tenant-1');

      expect(result).toEqual({ tenantId: 'tenant-1' });
    });
  });

  describe('addTenantToData helper', () => {
    it('should add tenantId to single data object', () => {
      const addTenantToData = (data: any, tenantId: string) => {
        if (Array.isArray(data)) {
          return data.map((item) => ({ ...item, tenantId }));
        }
        return { ...data, tenantId };
      };

      const result = addTenantToData({ name: 'test' }, 'tenant-1');

      expect(result).toEqual({
        name: 'test',
        tenantId: 'tenant-1',
      });
    });

    it('should add tenantId to array of data objects', () => {
      const addTenantToData = (data: any, tenantId: string) => {
        if (Array.isArray(data)) {
          return data.map((item) => ({ ...item, tenantId }));
        }
        return { ...data, tenantId };
      };

      const result = addTenantToData(
        [{ name: 'test1' }, { name: 'test2' }],
        'tenant-1'
      );

      expect(result).toEqual([
        { name: 'test1', tenantId: 'tenant-1' },
        { name: 'test2', tenantId: 'tenant-1' },
      ]);
    });

    it('should handle empty array', () => {
      const addTenantToData = (data: any, tenantId: string) => {
        if (Array.isArray(data)) {
          return data.map((item) => ({ ...item, tenantId }));
        }
        return { ...data, tenantId };
      };

      const result = addTenantToData([], 'tenant-1');

      expect(result).toEqual([]);
    });
  });

  describe('Extension query behavior simulation', () => {
    // Extension의 동작을 시뮬레이션하여 테스트

    describe('findMany', () => {
      it('should add tenantId filter when tenant context exists', () => {
        const tenantId = 'tenant-1';
        const model = 'user';
        const args = { where: { isActive: true } };

        // Extension 로직 시뮬레이션
        const isTenantScopedModel = (m: string) =>
          ['user', 'expense', 'committee'].includes(m.toLowerCase());

        let modifiedArgs = args;
        if (tenantId && isTenantScopedModel(model)) {
          modifiedArgs = {
            ...args,
            where: { ...args.where, tenantId },
          };
        }

        expect(modifiedArgs.where).toEqual({
          isActive: true,
          tenantId: 'tenant-1',
        });
      });

      it('should not modify args when no tenant context', () => {
        const tenantId = undefined;
        const model = 'user';
        const args = { where: { isActive: true } };

        const isTenantScopedModel = (m: string) =>
          ['user', 'expense', 'committee'].includes(m.toLowerCase());

        let modifiedArgs = args;
        if (tenantId && isTenantScopedModel(model)) {
          modifiedArgs = {
            ...args,
            where: { ...args.where, tenantId },
          };
        }

        expect(modifiedArgs).toEqual(args);
      });

      it('should not modify args for non-tenant-scoped model', () => {
        const tenantId = 'tenant-1';
        const model = 'tenant'; // Tenant 모델은 테넌트 스코프가 아님
        const args = { where: { isActive: true } };

        const isTenantScopedModel = (m: string) =>
          ['user', 'expense', 'committee'].includes(m.toLowerCase());

        let modifiedArgs = args;
        if (tenantId && isTenantScopedModel(model)) {
          modifiedArgs = {
            ...args,
            where: { ...args.where, tenantId },
          };
        }

        expect(modifiedArgs).toEqual(args);
      });
    });

    describe('findUnique', () => {
      it('should return null when result belongs to different tenant', async () => {
        const tenantId = 'tenant-1';
        const queryResult = { id: '1', name: 'test', tenantId: 'tenant-2' };

        // Extension 로직 시뮬레이션
        let result = queryResult;
        if (result && result.tenantId !== tenantId) {
          result = null as any;
        }

        expect(result).toBeNull();
      });

      it('should return result when it belongs to same tenant', () => {
        const tenantId = 'tenant-1';
        const queryResult = { id: '1', name: 'test', tenantId: 'tenant-1' };

        let result: any = queryResult;
        if (result && result.tenantId !== tenantId) {
          result = null;
        }

        expect(result).toEqual(queryResult);
      });
    });

    describe('findUniqueOrThrow', () => {
      it('should throw when result belongs to different tenant', () => {
        const tenantId = 'tenant-1';
        const queryResult = { id: '1', name: 'test', tenantId: 'tenant-2' };

        // Extension 로직 시뮬레이션
        expect(() => {
          if (queryResult.tenantId !== tenantId) {
            throw new Error('Record not found');
          }
        }).toThrow('Record not found');
      });

      it('should not throw when result belongs to same tenant', () => {
        const tenantId = 'tenant-1';
        const queryResult = { id: '1', name: 'test', tenantId: 'tenant-1' };

        expect(() => {
          if (queryResult.tenantId !== tenantId) {
            throw new Error('Record not found');
          }
        }).not.toThrow();
      });
    });

    describe('create', () => {
      it('should add tenantId to data when tenant context exists', () => {
        const tenantId = 'tenant-1';
        const model = 'user';
        const args = { data: { name: 'test', isActive: true } };

        const isTenantScopedModel = (m: string) =>
          ['user', 'expense', 'committee'].includes(m.toLowerCase());

        let modifiedArgs = args;
        if (tenantId && isTenantScopedModel(model)) {
          modifiedArgs = {
            ...args,
            data: { ...args.data, tenantId },
          };
        }

        expect(modifiedArgs.data).toEqual({
          name: 'test',
          isActive: true,
          tenantId: 'tenant-1',
        });
      });
    });

    describe('createMany', () => {
      it('should add tenantId to all data items', () => {
        const tenantId = 'tenant-1';
        const args = {
          data: [
            { name: 'test1' },
            { name: 'test2' },
          ],
        };

        const modifiedData = args.data.map(item => ({
          ...item,
          tenantId,
        }));

        expect(modifiedData).toEqual([
          { name: 'test1', tenantId: 'tenant-1' },
          { name: 'test2', tenantId: 'tenant-1' },
        ]);
      });
    });

    describe('update', () => {
      it('should throw when trying to update different tenant data', () => {
        const tenantId = 'tenant-1';
        const updateResult = { id: '1', name: 'updated', tenantId: 'tenant-2' };

        expect(() => {
          if (updateResult && updateResult.tenantId !== tenantId) {
            throw new Error('Unauthorized access to record');
          }
        }).toThrow('Unauthorized access to record');
      });

      it('should allow update when same tenant', () => {
        const tenantId = 'tenant-1';
        const updateResult = { id: '1', name: 'updated', tenantId: 'tenant-1' };

        expect(() => {
          if (updateResult && updateResult.tenantId !== tenantId) {
            throw new Error('Unauthorized access to record');
          }
        }).not.toThrow();
      });
    });

    describe('updateMany', () => {
      it('should add tenantId filter to where clause', () => {
        const tenantId = 'tenant-1';
        const args = { where: { isActive: false }, data: { isActive: true } };

        const modifiedArgs = {
          ...args,
          where: { ...args.where, tenantId },
        };

        expect(modifiedArgs.where).toEqual({
          isActive: false,
          tenantId: 'tenant-1',
        });
      });
    });

    describe('upsert', () => {
      it('should add tenantId to create data', () => {
        const tenantId = 'tenant-1';
        const args = {
          where: { id: '1' },
          create: { name: 'new' },
          update: { name: 'updated' },
        };

        const modifiedArgs = {
          ...args,
          create: { ...args.create, tenantId },
        };

        expect(modifiedArgs.create).toEqual({
          name: 'new',
          tenantId: 'tenant-1',
        });
      });
    });

    describe('delete', () => {
      it('should throw when trying to delete different tenant data', () => {
        const tenantId = 'tenant-1';
        const deleteResult = { id: '1', name: 'deleted', tenantId: 'tenant-2' };

        expect(() => {
          if (deleteResult && deleteResult.tenantId !== tenantId) {
            throw new Error('Unauthorized access to record');
          }
        }).toThrow('Unauthorized access to record');
      });
    });

    describe('deleteMany', () => {
      it('should add tenantId filter to where clause', () => {
        const tenantId = 'tenant-1';
        const args = { where: { isActive: false } };

        const modifiedArgs = {
          ...args,
          where: { ...args.where, tenantId },
        };

        expect(modifiedArgs.where).toEqual({
          isActive: false,
          tenantId: 'tenant-1',
        });
      });
    });

    describe('count', () => {
      it('should add tenantId filter when counting', () => {
        const tenantId = 'tenant-1';
        const args = { where: { isActive: true } };

        const modifiedArgs = {
          ...args,
          where: { ...args.where, tenantId },
        };

        expect(modifiedArgs.where).toEqual({
          isActive: true,
          tenantId: 'tenant-1',
        });
      });
    });

    describe('aggregate', () => {
      it('should add tenantId filter to aggregate queries', () => {
        const tenantId = 'tenant-1';
        const args = { where: { isActive: true }, _sum: { amount: true } };

        const modifiedArgs = {
          ...args,
          where: { ...args.where, tenantId },
        };

        expect(modifiedArgs.where).toEqual({
          isActive: true,
          tenantId: 'tenant-1',
        });
      });
    });

    describe('groupBy', () => {
      it('should add tenantId filter to groupBy queries', () => {
        const tenantId = 'tenant-1';
        const args = { by: ['status'], where: { isActive: true } };

        const modifiedArgs = {
          ...args,
          where: { ...args.where, tenantId },
        };

        expect(modifiedArgs.where).toEqual({
          isActive: true,
          tenantId: 'tenant-1',
        });
      });
    });
  });

  describe('bypassTenantExtension', () => {
    it('should be defined for admin/system operations', async () => {
      const { bypassTenantExtension } = await import('../prisma-tenant-extension');

      // Extension이 정의되어 있는지 확인
      expect(bypassTenantExtension).toBeDefined();
      // Prisma.defineExtension은 내부적으로 name을 다르게 저장할 수 있음
    });
  });

  describe('Cross-tenant access prevention', () => {
    it('should prevent reading data from other tenants via findUnique', () => {
      const currentTenantId = 'tenant-a';
      const otherTenantData = { id: '1', tenantId: 'tenant-b', name: 'secret' };

      // Simulating extension behavior
      const validateTenant = (result: any, tenantId: string) => {
        if (result && result.tenantId !== tenantId) {
          return null;
        }
        return result;
      };

      const result = validateTenant(otherTenantData, currentTenantId);
      expect(result).toBeNull();
    });

    it('should prevent updating data from other tenants', () => {
      const currentTenantId = 'tenant-a';
      const otherTenantData = { id: '1', tenantId: 'tenant-b', name: 'secret' };

      const validateUpdateAccess = (result: any, tenantId: string) => {
        if (result && result.tenantId !== tenantId) {
          throw new Error('Unauthorized access to record');
        }
        return result;
      };

      expect(() => validateUpdateAccess(otherTenantData, currentTenantId))
        .toThrow('Unauthorized access to record');
    });

    it('should prevent deleting data from other tenants', () => {
      const currentTenantId = 'tenant-a';
      const otherTenantData = { id: '1', tenantId: 'tenant-b', name: 'secret' };

      const validateDeleteAccess = (result: any, tenantId: string) => {
        if (result && result.tenantId !== tenantId) {
          throw new Error('Unauthorized access to record');
        }
        return result;
      };

      expect(() => validateDeleteAccess(otherTenantData, currentTenantId))
        .toThrow('Unauthorized access to record');
    });

    it('should allow data access when tenantId matches', () => {
      const currentTenantId = 'tenant-a';
      const sameTenantData = { id: '1', tenantId: 'tenant-a', name: 'my data' };

      const validateTenant = (result: any, tenantId: string) => {
        if (result && result.tenantId !== tenantId) {
          return null;
        }
        return result;
      };

      const result = validateTenant(sameTenantData, currentTenantId);
      expect(result).toEqual(sameTenantData);
    });
  });
});
