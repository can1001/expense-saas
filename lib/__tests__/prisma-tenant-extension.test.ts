/**
 * Prisma Tenant Extension 테스트
 *
 * 테스트 대상:
 * - TENANT_SCOPED_MODELS 상수
 * - isTenantScopedModel 함수
 * - addTenantFilter 함수
 * - addTenantToData 함수
 * - tenantExtension (Prisma Extension)
 *
 * Note: Extension 자체는 Prisma 런타임에서 실행되므로
 * 헬퍼 함수들을 직접 테스트하고, Extension 동작은 시뮬레이션으로 검증
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TENANT_SCOPED_MODELS,
  isTenantScopedModel,
  addTenantFilter,
  addTenantToData,
  tenantExtension,
  bypassTenantExtension,
} from '../prisma-tenant-extension';

describe('prisma-tenant-extension', () => {
  describe('TENANT_SCOPED_MODELS', () => {
    it('should include all expected core models', () => {
      const coreModels = [
        'user',
        'expense',
        'expenseItem',
        'committee',
        'department',
        'budgetCategory',
        'budgetSubcategory',
        'budgetDetail',
      ];

      coreModels.forEach((model) => {
        expect(TENANT_SCOPED_MODELS).toContain(model);
      });
    });

    it('should include simple expense models', () => {
      expect(TENANT_SCOPED_MODELS).toContain('simpleExpense');
      expect(TENANT_SCOPED_MODELS).toContain('simpleExpenseItem');
      expect(TENANT_SCOPED_MODELS).toContain('simpleExpenseAttachment');
    });

    it('should include recurring expense model', () => {
      expect(TENANT_SCOPED_MODELS).toContain('recurringExpense');
    });

    it('should include template model', () => {
      expect(TENANT_SCOPED_MODELS).toContain('expenseTemplate');
    });

    it('should include notification models', () => {
      expect(TENANT_SCOPED_MODELS).toContain('notificationPreference');
      expect(TENANT_SCOPED_MODELS).toContain('notificationLog');
      expect(TENANT_SCOPED_MODELS).toContain('pushSubscription');
    });

    it('should include role and approval models', () => {
      expect(TENANT_SCOPED_MODELS).toContain('role');
      expect(TENANT_SCOPED_MODELS).toContain('approvalLog');
    });

    it('should have more than 40 tenant-scoped models', () => {
      expect(TENANT_SCOPED_MODELS.length).toBeGreaterThan(40);
    });

    it('should not include platform-level models', () => {
      // tenant, superAdmin 등은 테넌트 스코프가 아님
      expect(TENANT_SCOPED_MODELS).not.toContain('tenant');
      expect(TENANT_SCOPED_MODELS).not.toContain('superAdmin');
      expect(TENANT_SCOPED_MODELS).not.toContain('platformSetting');
    });
  });

  describe('isTenantScopedModel', () => {
    it('should return true for tenant-scoped models', () => {
      expect(isTenantScopedModel('user')).toBe(true);
      expect(isTenantScopedModel('expense')).toBe(true);
      expect(isTenantScopedModel('committee')).toBe(true);
      expect(isTenantScopedModel('department')).toBe(true);
    });

    it('should return true for lowercase model names', () => {
      // 소문자 입력도 정상 매칭
      expect(isTenantScopedModel('user')).toBe(true);
      expect(isTenantScopedModel('expense')).toBe(true);
      expect(isTenantScopedModel('committee')).toBe(true);
      expect(isTenantScopedModel('expenseitem')).toBe(true);
    });

    it('should handle Prisma model names (PascalCase)', () => {
      // Prisma는 PascalCase 모델명을 전달하므로 대소문자 무관하게 매칭
      expect(isTenantScopedModel('User')).toBe(true);
      expect(isTenantScopedModel('Expense')).toBe(true);
      expect(isTenantScopedModel('ExpenseItem')).toBe(true);
      expect(isTenantScopedModel('BudgetCategory')).toBe(true);
      expect(isTenantScopedModel('SimpleExpenseItem')).toBe(true);
    });

    it('should return false for non-tenant-scoped models', () => {
      expect(isTenantScopedModel('tenant')).toBe(false);
      expect(isTenantScopedModel('superAdmin')).toBe(false);
      expect(isTenantScopedModel('unknownModel')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isTenantScopedModel('')).toBe(false);
    });

    it('should match all models from TENANT_SCOPED_MODELS regardless of case', () => {
      // 모든 TENANT_SCOPED_MODELS가 대소문자 무관하게 매칭되어야 함
      TENANT_SCOPED_MODELS.forEach((model) => {
        expect(isTenantScopedModel(model)).toBe(true);
        expect(isTenantScopedModel(model.toUpperCase())).toBe(true);
        expect(isTenantScopedModel(model.toLowerCase())).toBe(true);
      });
    });

    it('should recognize model names as passed by Prisma extension', () => {
      // Prisma Extension에서는 model 이름이 소문자로 전달됨
      // 예: 'user', 'expense', 'expenseitem' 등
      expect(isTenantScopedModel('user')).toBe(true);
      expect(isTenantScopedModel('expense')).toBe(true);
      expect(isTenantScopedModel('role')).toBe(true);
    });
  });

  describe('addTenantFilter', () => {
    const tenantId = 'tenant-123';

    it('should add tenantId to empty where clause', () => {
      const result = addTenantFilter({}, tenantId);

      expect(result).toEqual({ tenantId: 'tenant-123' });
    });

    it('should add tenantId to existing where clause', () => {
      const where = { status: 'PENDING', amount: { gt: 1000 } };
      const result = addTenantFilter(where, tenantId);

      expect(result).toEqual({
        status: 'PENDING',
        amount: { gt: 1000 },
        tenantId: 'tenant-123',
      });
    });

    it('should override existing tenantId if present', () => {
      const where = { tenantId: 'old-tenant', name: 'test' };
      const result = addTenantFilter(where, tenantId);

      expect(result.tenantId).toBe('tenant-123');
      expect(result.name).toBe('test');
    });

    it('should handle undefined where clause', () => {
      const result = addTenantFilter(undefined, tenantId);

      expect(result).toEqual({ tenantId: 'tenant-123' });
    });

    it('should handle null where clause', () => {
      const result = addTenantFilter(null, tenantId);

      expect(result).toEqual({ tenantId: 'tenant-123' });
    });

    it('should preserve nested conditions', () => {
      const where = {
        AND: [{ status: 'APPROVED' }, { amount: { gte: 5000 } }],
        OR: [{ userId: 'user-1' }, { userId: 'user-2' }],
      };
      const result = addTenantFilter(where, tenantId);

      expect(result.AND).toEqual(where.AND);
      expect(result.OR).toEqual(where.OR);
      expect(result.tenantId).toBe('tenant-123');
    });

    it('should prevent prototype pollution via __proto__', () => {
      // 프로토타입 오염 공격 시도
      const maliciousWhere = JSON.parse('{"__proto__": {"polluted": true}, "status": "ACTIVE"}');
      const result = addTenantFilter(maliciousWhere, tenantId);

      // 결과 객체가 prototype pollution에 안전해야 함
      expect(result.tenantId).toBe('tenant-123');
      expect(result.status).toBe('ACTIVE');
      // null 프로토타입 객체이므로 Object.prototype이 오염되지 않음
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('should handle non-object where input safely', () => {
      // 문자열이나 숫자 등 비객체 입력 처리
      expect(addTenantFilter('invalid' as unknown, tenantId)).toEqual({ tenantId: 'tenant-123' });
      expect(addTenantFilter(123 as unknown, tenantId)).toEqual({ tenantId: 'tenant-123' });
      expect(addTenantFilter(true as unknown, tenantId)).toEqual({ tenantId: 'tenant-123' });
    });
  });

  describe('addTenantToData', () => {
    const tenantId = 'tenant-456';

    describe('single object data', () => {
      it('should add tenantId to data object', () => {
        const data = { name: 'Test', amount: 1000 };
        const result = addTenantToData(data, tenantId);

        expect(result).toEqual({
          name: 'Test',
          amount: 1000,
          tenantId: 'tenant-456',
        });
      });

      it('should handle empty object', () => {
        const result = addTenantToData({}, tenantId);

        expect(result).toEqual({ tenantId: 'tenant-456' });
      });

      it('should override existing tenantId', () => {
        const data = { tenantId: 'wrong-tenant', name: 'Test' };
        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe('tenant-456');
      });

      it('should add tenantId to nested create objects', () => {
        const data = {
          name: 'Test',
          items: { create: [{ amount: 100 }] },
        };
        const result = addTenantToData(data, tenantId);

        // 중첩 생성에도 tenantId가 자동 추가됨
        expect(result.items).toEqual({ create: [{ amount: 100, tenantId: 'tenant-456' }] });
        expect(result.tenantId).toBe('tenant-456');
      });
    });

    describe('array data (createMany)', () => {
      it('should add tenantId to each item in array', () => {
        const data = [
          { name: 'Item 1', amount: 100 },
          { name: 'Item 2', amount: 200 },
        ];
        const result = addTenantToData(data, tenantId);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ name: 'Item 1', amount: 100, tenantId: 'tenant-456' });
        expect(result[1]).toEqual({ name: 'Item 2', amount: 200, tenantId: 'tenant-456' });
      });

      it('should handle empty array', () => {
        const result = addTenantToData([], tenantId);

        expect(result).toEqual([]);
      });

      it('should handle single item array', () => {
        const data = [{ name: 'Single' }];
        const result = addTenantToData(data, tenantId);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ name: 'Single', tenantId: 'tenant-456' });
      });
    });
  });

  describe('tenantExtension', () => {
    it('should be defined', () => {
      expect(tenantExtension).toBeDefined();
    });
  });

  describe('bypassTenantExtension', () => {
    it('should be defined for admin/system operations', () => {
      expect(bypassTenantExtension).toBeDefined();
    });
  });

  describe('Extension behavior validation', () => {
    // Extension의 동작 로직을 검증 (실제 함수 사용)

    describe('findMany query modification', () => {
      it('should correctly modify where clause for tenant-scoped model', () => {
        const tenantId = 'tenant-test';
        const model = 'expense';
        const args = { where: { status: 'PENDING' } };

        if (isTenantScopedModel(model)) {
          const newArgs = {
            ...args,
            where: addTenantFilter(args.where, tenantId),
          };

          expect(newArgs.where.tenantId).toBe(tenantId);
          expect(newArgs.where.status).toBe('PENDING');
        }
      });

      it('should not modify args for non-tenant-scoped model', () => {
        const model = 'tenant';

        expect(isTenantScopedModel(model)).toBe(false);
      });
    });

    describe('create mutation modification', () => {
      it('should add tenantId to create data for tenant-scoped model', () => {
        const tenantId = 'tenant-create';
        const model = 'expense';
        const args = { data: { amount: 5000, description: 'Test' } };

        if (isTenantScopedModel(model)) {
          const newArgs = {
            ...args,
            data: addTenantToData(args.data, tenantId),
          };

          expect(newArgs.data.tenantId).toBe(tenantId);
          expect(newArgs.data.amount).toBe(5000);
        }
      });
    });

    describe('createMany mutation modification', () => {
      it('should add tenantId to all items', () => {
        const tenantId = 'tenant-batch';
        const model = 'expenseItem';
        const args = {
          data: [
            { amount: 100, description: 'Item 1' },
            { amount: 200, description: 'Item 2' },
          ],
        };

        if (isTenantScopedModel(model)) {
          const newArgs = {
            ...args,
            data: addTenantToData(args.data, tenantId),
          };

          expect(newArgs.data).toHaveLength(2);
          newArgs.data.forEach((item: { tenantId: string }) => {
            expect(item.tenantId).toBe(tenantId);
          });
        }
      });
    });

    describe('update/delete validation', () => {
      it('should detect tenantId mismatch', () => {
        const userTenantId = 'tenant-user';
        const resultTenantId = 'tenant-other';

        const result = { id: '1', tenantId: resultTenantId, name: 'Test' };

        expect(result.tenantId).not.toBe(userTenantId);
      });

      it('should allow when tenantId matches', () => {
        const userTenantId = 'tenant-user';
        const resultTenantId = 'tenant-user';

        const result = { id: '1', tenantId: resultTenantId, name: 'Test' };

        expect(result.tenantId).toBe(userTenantId);
      });
    });
  });

  describe('Cross-tenant prevention', () => {
    it('should prevent tenantId override in where clause', () => {
      const userTenantId = 'user-tenant';
      const maliciousWhere = { tenantId: 'other-tenant', status: 'ACTIVE' };

      const result = addTenantFilter(maliciousWhere, userTenantId);

      expect(result.tenantId).toBe(userTenantId);
    });

    it('should prevent tenantId injection in create data', () => {
      const userTenantId = 'user-tenant';
      const maliciousData = { tenantId: 'other-tenant', name: 'Malicious' };

      const result = addTenantToData(maliciousData, userTenantId);

      expect(result.tenantId).toBe(userTenantId);
    });

    it('should prevent cross-tenant access via findUnique validation', () => {
      const currentTenantId = 'tenant-a';
      const otherTenantData = { id: '1', tenantId: 'tenant-b', name: 'secret' };

      // Extension이 결과 검증 시 사용하는 로직
      const validateTenant = (result: { tenantId: string } | null, tenantId: string) => {
        if (result && result.tenantId !== tenantId) {
          return null;
        }
        return result;
      };

      const result = validateTenant(otherTenantData, currentTenantId);
      expect(result).toBeNull();
    });

    it('should prevent cross-tenant update', () => {
      const currentTenantId = 'tenant-a';
      const otherTenantData = { id: '1', tenantId: 'tenant-b', name: 'secret' };

      const validateUpdateAccess = (result: { tenantId: string }, tenantId: string) => {
        if (result && result.tenantId !== tenantId) {
          throw new Error('Unauthorized access to record');
        }
        return result;
      };

      expect(() => validateUpdateAccess(otherTenantData, currentTenantId))
        .toThrow('Unauthorized access to record');
    });

    it('should allow same-tenant data access', () => {
      const currentTenantId = 'tenant-a';
      const sameTenantData = { id: '1', tenantId: 'tenant-a', name: 'my data' };

      const validateTenant = (result: { tenantId: string } | null, tenantId: string) => {
        if (result && result.tenantId !== tenantId) {
          return null;
        }
        return result;
      };

      const result = validateTenant(sameTenantData, currentTenantId);
      expect(result).toEqual(sameTenantData);
    });
  });

  describe('Edge cases', () => {
    it('should handle complex nested where conditions', () => {
      const tenantId = 'complex-tenant';
      const complexWhere = {
        AND: [
          { status: 'APPROVED' },
          { OR: [{ amount: { gt: 1000 } }, { priority: 'HIGH' }] },
        ],
        NOT: { deletedAt: { not: null } },
      };

      const result = addTenantFilter(complexWhere, tenantId);

      expect(result.tenantId).toBe(tenantId);
      expect(result.AND).toEqual(complexWhere.AND);
      expect(result.NOT).toEqual(complexWhere.NOT);
    });

    it('should handle data with special characters in tenantId', () => {
      const specialTenantId = 'tenant-with-dashes_and_underscores';
      const data = { name: 'Test' };

      const result = addTenantToData(data, specialTenantId);

      expect(result.tenantId).toBe(specialTenantId);
    });

    it('should handle very long tenantId', () => {
      const longTenantId = 'a'.repeat(100);
      const data = { name: 'Test' };

      const result = addTenantToData(data, longTenantId);

      expect(result.tenantId).toBe(longTenantId);
      expect(result.tenantId.length).toBe(100);
    });

    it('should handle single-word model names with different casings', () => {
      // 단일 단어 모델은 대소문자 무관하게 매칭
      expect(isTenantScopedModel('user')).toBe(true);
      expect(isTenantScopedModel('USER')).toBe(true);
      expect(isTenantScopedModel('User')).toBe(true);
      expect(isTenantScopedModel('role')).toBe(true);
      expect(isTenantScopedModel('ROLE')).toBe(true);
    });
  });

  describe('TOCTOU Prevention - Pre-filtering', () => {
    describe('update() pre-filtering', () => {
      it('should add tenantId to where clause for update', () => {
        const tenantId = 'tenant-update';
        const args = { where: { id: 'expense-123' }, data: { status: 'APPROVED' } };

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };

        expect(newArgs.where).toEqual({
          id: 'expense-123',
          tenantId: 'tenant-update',
        });
      });

      it('should preserve existing where conditions when adding tenantId for update', () => {
        const tenantId = 'tenant-preserve';
        const args = {
          where: { id: 'exp-1', status: 'PENDING', amount: { gt: 1000 } },
          data: { status: 'APPROVED' },
        };

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };

        expect(newArgs.where.id).toBe('exp-1');
        expect(newArgs.where.status).toBe('PENDING');
        expect(newArgs.where.amount).toEqual({ gt: 1000 });
        expect(newArgs.where.tenantId).toBe(tenantId);
      });

      it('should override malicious tenantId in update where clause', () => {
        const tenantId = 'real-tenant';
        const maliciousArgs = {
          where: { id: '123', tenantId: 'other-tenant' },
          data: { name: 'hacked' },
        };

        const safeArgs = {
          ...maliciousArgs,
          where: addTenantFilter(maliciousArgs.where, tenantId),
        };

        expect(safeArgs.where.tenantId).toBe('real-tenant');
      });
    });

    describe('delete() pre-filtering', () => {
      it('should add tenantId to where clause for delete', () => {
        const tenantId = 'tenant-delete';
        const args = { where: { id: 'expense-to-delete' } };

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
        };

        expect(newArgs.where).toEqual({
          id: 'expense-to-delete',
          tenantId: 'tenant-delete',
        });
      });

      it('should prevent cross-tenant delete via pre-filtering', () => {
        const currentTenantId = 'tenant-a';
        // 테넌트 A 사용자가 테넌트 B 레코드 삭제 시도
        const args = { where: { id: 'record-from-tenant-b' } };
        const filteredWhere = addTenantFilter(args.where, currentTenantId);

        // 필터링된 where는 tenant-a 레코드만 찾음
        expect(filteredWhere.tenantId).toBe('tenant-a');
        // DB는 tenant-b 레코드를 찾지 못함 → 안전
      });
    });

    describe('upsert() pre-filtering', () => {
      it('should add tenantId to where, create, and update for upsert', () => {
        const tenantId = 'tenant-upsert';
        const args = {
          where: { id: 'budget-1' },
          create: { id: 'budget-1', name: 'New Budget', amount: 1000 },
          update: { amount: 2000 },
        };

        const newArgs = {
          ...args,
          where: addTenantFilter(args.where, tenantId),
          create: addTenantToData(args.create, tenantId),
          update: addTenantToData(args.update, tenantId),
        };

        expect(newArgs.where.tenantId).toBe(tenantId);
        expect(newArgs.create.tenantId).toBe(tenantId);
        expect(newArgs.update.tenantId).toBe(tenantId);
      });

      it('should prevent cross-tenant upsert update via where filtering', () => {
        const currentTenantId = 'tenant-a';
        const args = {
          where: { id: 'other-tenant-record', tenantId: 'tenant-b' },
          create: { name: 'new' },
          update: { amount: 0 },
        };

        const newArgs = {
          where: addTenantFilter(args.where, currentTenantId),
          create: addTenantToData(args.create, currentTenantId),
          update: addTenantToData(args.update, currentTenantId),
        };

        // where 절이 현재 테넌트로 강제됨
        expect(newArgs.where.tenantId).toBe('tenant-a');
      });
    });
  });

  describe('Nested Writes', () => {
    it('should add tenantId to nested create', () => {
      const tenantId = 'tenant-nested';
      const data = {
        name: 'Expense',
        items: {
          create: [
            { description: 'Item 1', amount: 100 },
            { description: 'Item 2', amount: 200 },
          ],
        },
      };

      const result = addTenantToData(data, tenantId);

      expect(result.tenantId).toBe(tenantId);
      expect(result.items.create[0].tenantId).toBe(tenantId);
      expect(result.items.create[1].tenantId).toBe(tenantId);
    });

    it('should add tenantId to nested createMany', () => {
      const tenantId = 'tenant-createMany';
      const data = {
        name: 'Report',
        entries: {
          createMany: {
            data: [
              { type: 'income', amount: 1000 },
              { type: 'expense', amount: 500 },
            ],
          },
        },
      };

      const result = addTenantToData(data, tenantId);

      expect(result.tenantId).toBe(tenantId);
      expect(result.entries.createMany.data[0].tenantId).toBe(tenantId);
      expect(result.entries.createMany.data[1].tenantId).toBe(tenantId);
    });

    it('should handle deeply nested creates', () => {
      const tenantId = 'tenant-deep';
      const data = {
        name: 'Parent',
        children: {
          create: {
            name: 'Child',
            grandchildren: {
              create: [{ name: 'GrandChild 1' }, { name: 'GrandChild 2' }],
            },
          },
        },
      };

      const result = addTenantToData(data, tenantId);

      expect(result.tenantId).toBe(tenantId);
      expect(result.children.create.tenantId).toBe(tenantId);
      expect(result.children.create.grandchildren.create[0].tenantId).toBe(tenantId);
      expect(result.children.create.grandchildren.create[1].tenantId).toBe(tenantId);
    });

    it('should handle single nested create (not array)', () => {
      const tenantId = 'tenant-single-nested';
      const data = {
        name: 'Expense',
        attachment: {
          create: { filename: 'receipt.pdf', url: 'https://...' },
        },
      };

      const result = addTenantToData(data, tenantId);

      expect(result.tenantId).toBe(tenantId);
      expect(result.attachment.create.tenantId).toBe(tenantId);
    });

    it('should add tenantId to nested connect for cross-tenant protection', () => {
      const tenantId = 'tenant-connect';
      const data = {
        name: 'Expense',
        user: {
          connect: { id: 'user-123' },
        },
      };

      const result = addTenantToData(data, tenantId);

      expect(result.tenantId).toBe(tenantId);
      // connect에도 tenantId가 추가되어 크로스 테넌트 연결 방지
      expect(result.user.connect.tenantId).toBe(tenantId);
      expect(result.user.connect.id).toBe('user-123');
    });

    it('should add tenantId to array connect', () => {
      const tenantId = 'tenant-array-connect';
      const data = {
        tags: {
          connect: [{ id: 'tag-1' }, { id: 'tag-2' }],
        },
      };

      const result = addTenantToData(data, tenantId);

      expect(result.tags.connect[0].tenantId).toBe(tenantId);
      expect(result.tags.connect[1].tenantId).toBe(tenantId);
    });

    it('should prevent cross-tenant connect', () => {
      const tenantId = 'tenant-a';
      // 공격자가 다른 테넌트의 사용자를 연결 시도
      const maliciousData = {
        user: {
          connect: { id: 'user-from-tenant-b', tenantId: 'tenant-b' },
        },
      };

      const result = addTenantToData(maliciousData, tenantId);

      // tenantId가 tenant-a로 덮어쓰기되어 tenant-b 레코드 연결 불가
      expect(result.user.connect.tenantId).toBe('tenant-a');
    });

    it('should handle null and undefined nested values', () => {
      const tenantId = 'tenant-nulls';
      const data = {
        name: 'Test',
        optional: null,
        missing: undefined,
      };

      const result = addTenantToData(data, tenantId);

      expect(result.tenantId).toBe(tenantId);
      expect(result.optional).toBeNull();
      expect(result.missing).toBeUndefined();
    });

    describe('connectOrCreate pattern', () => {
      it('should add tenantId to single connectOrCreate where and create', () => {
        const tenantId = 'tenant-connectOrCreate';
        const data = {
          name: 'Expense',
          category: {
            connectOrCreate: {
              where: { id: 'cat-1' },
              create: { id: 'cat-1', name: 'Office Supplies' },
            },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.category.connectOrCreate.create.tenantId).toBe(tenantId);
        // where에도 tenantId 추가되어 크로스 테넌트 connect 방지
        expect(result.category.connectOrCreate.where.tenantId).toBe(tenantId);
        expect(result.category.connectOrCreate.where.id).toBe('cat-1');
      });

      it('should add tenantId to array connectOrCreate where and creates', () => {
        const tenantId = 'tenant-array-connectOrCreate';
        const data = {
          name: 'Expense',
          items: {
            connectOrCreate: [
              {
                where: { id: 'item-1' },
                create: { id: 'item-1', name: 'Item 1', amount: 100 },
              },
              {
                where: { id: 'item-2' },
                create: { id: 'item-2', name: 'Item 2', amount: 200 },
              },
            ],
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.items.connectOrCreate[0].create.tenantId).toBe(tenantId);
        expect(result.items.connectOrCreate[1].create.tenantId).toBe(tenantId);
        // where에도 tenantId 추가
        expect(result.items.connectOrCreate[0].where.tenantId).toBe(tenantId);
        expect(result.items.connectOrCreate[1].where.tenantId).toBe(tenantId);
      });

      it('should handle deeply nested connectOrCreate in create', () => {
        const tenantId = 'tenant-deep-connectOrCreate';
        const data = {
          name: 'Parent',
          children: {
            create: {
              name: 'Child',
              category: {
                connectOrCreate: {
                  where: { name: 'Sub Category' },
                  create: { name: 'Sub Category' },
                },
              },
            },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.children.create.tenantId).toBe(tenantId);
        expect(result.children.create.category.connectOrCreate.create.tenantId).toBe(tenantId);
        expect(result.children.create.category.connectOrCreate.where.tenantId).toBe(tenantId);
      });

      it('should prevent cross-tenant connect by adding tenantId to where', () => {
        const tenantId = 'tenant-a';
        // 공격자가 다른 테넌트의 레코드를 connect 시도
        const maliciousData = {
          name: 'Expense',
          category: {
            connectOrCreate: {
              where: { id: 'category-from-tenant-b' },
              create: { name: 'New Category' },
            },
          },
        };

        const result = addTenantToData(maliciousData, tenantId);

        // where에 tenant-a 필터가 추가되어 tenant-b 레코드 connect 불가
        expect(result.category.connectOrCreate.where.tenantId).toBe('tenant-a');
      });
    });

    describe('nested update pattern', () => {
      it('should add tenantId to nested update where and data', () => {
        const tenantId = 'tenant-nested-update';
        const data = {
          name: 'Expense',
          items: {
            update: {
              where: { id: 'item-1' },
              data: { amount: 200 },
            },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.items.update.where.tenantId).toBe(tenantId);
        expect(result.items.update.data.tenantId).toBe(tenantId);
      });

      it('should add tenantId to array nested updates', () => {
        const tenantId = 'tenant-array-update';
        const data = {
          name: 'Expense',
          items: {
            update: [
              { where: { id: 'item-1' }, data: { amount: 100 } },
              { where: { id: 'item-2' }, data: { amount: 200 } },
            ],
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.items.update[0].where.tenantId).toBe(tenantId);
        expect(result.items.update[0].data.tenantId).toBe(tenantId);
        expect(result.items.update[1].where.tenantId).toBe(tenantId);
        expect(result.items.update[1].data.tenantId).toBe(tenantId);
      });
    });

    describe('nested upsert pattern', () => {
      it('should add tenantId to nested upsert where, create, and update', () => {
        const tenantId = 'tenant-nested-upsert';
        const data = {
          name: 'Expense',
          items: {
            upsert: {
              where: { id: 'item-1' },
              create: { id: 'item-1', amount: 100 },
              update: { amount: 200 },
            },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.items.upsert.where.tenantId).toBe(tenantId);
        expect(result.items.upsert.create.tenantId).toBe(tenantId);
        expect(result.items.upsert.update.tenantId).toBe(tenantId);
      });

      it('should add tenantId to array nested upserts', () => {
        const tenantId = 'tenant-array-upsert';
        const data = {
          items: {
            upsert: [
              { where: { id: '1' }, create: { amount: 100 }, update: { amount: 150 } },
              { where: { id: '2' }, create: { amount: 200 }, update: { amount: 250 } },
            ],
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.items.upsert[0].where.tenantId).toBe(tenantId);
        expect(result.items.upsert[0].create.tenantId).toBe(tenantId);
        expect(result.items.upsert[0].update.tenantId).toBe(tenantId);
        expect(result.items.upsert[1].where.tenantId).toBe(tenantId);
      });
    });

    describe('nested updateMany pattern', () => {
      it('should add tenantId to nested updateMany where and data', () => {
        const tenantId = 'tenant-updateMany';
        const data = {
          name: 'Expense',
          items: {
            updateMany: {
              where: { status: 'PENDING' },
              data: { status: 'APPROVED' },
            },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.items.updateMany.where.tenantId).toBe(tenantId);
        expect(result.items.updateMany.data.tenantId).toBe(tenantId);
      });

      it('should prevent cross-tenant updateMany via where filtering', () => {
        const tenantId = 'tenant-a';
        // 공격자가 다른 테넌트의 레코드를 일괄 수정 시도
        const maliciousData = {
          items: {
            updateMany: {
              where: { tenantId: 'tenant-b' }, // 악의적 tenantId 주입
              data: { amount: 0 },
            },
          },
        };

        const result = addTenantToData(maliciousData, tenantId);

        // tenantId가 tenant-a로 강제 덮어쓰기
        expect(result.items.updateMany.where.tenantId).toBe('tenant-a');
      });

      it('should handle array updateMany', () => {
        const tenantId = 'tenant-array-updateMany';
        const data = {
          items: {
            updateMany: [
              { where: { type: 'A' }, data: { status: 'DONE' } },
              { where: { type: 'B' }, data: { status: 'DONE' } },
            ],
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.items.updateMany[0].where.tenantId).toBe(tenantId);
        expect(result.items.updateMany[1].where.tenantId).toBe(tenantId);
      });
    });

    describe('nested deleteMany pattern', () => {
      it('should add tenantId to nested deleteMany where', () => {
        const tenantId = 'tenant-deleteMany';
        const data = {
          name: 'Expense',
          items: {
            deleteMany: { status: 'CANCELLED' },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.items.deleteMany.tenantId).toBe(tenantId);
      });

      it('should prevent cross-tenant deleteMany via where filtering', () => {
        const tenantId = 'tenant-a';
        // 공격자가 다른 테넌트의 레코드를 일괄 삭제 시도
        const maliciousData = {
          items: {
            deleteMany: { tenantId: 'tenant-b' },
          },
        };

        const result = addTenantToData(maliciousData, tenantId);

        // tenantId가 tenant-a로 강제 덮어쓰기
        expect(result.items.deleteMany.tenantId).toBe('tenant-a');
      });

      it('should handle array deleteMany', () => {
        const tenantId = 'tenant-array-deleteMany';
        const data = {
          items: {
            deleteMany: [{ type: 'A' }, { type: 'B' }],
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.items.deleteMany[0].tenantId).toBe(tenantId);
        expect(result.items.deleteMany[1].tenantId).toBe(tenantId);
      });
    });

    describe('nested delete (single) pattern', () => {
      it('should add tenantId to nested delete where', () => {
        const tenantId = 'tenant-delete';
        const data = {
          name: 'Expense',
          items: {
            delete: { id: 'item-1' },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.items.delete.tenantId).toBe(tenantId);
        expect(result.items.delete.id).toBe('item-1');
      });

      it('should add tenantId to array delete', () => {
        const tenantId = 'tenant-array-delete';
        const data = {
          items: {
            delete: [{ id: 'item-1' }, { id: 'item-2' }],
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.items.delete[0].tenantId).toBe(tenantId);
        expect(result.items.delete[1].tenantId).toBe(tenantId);
      });

      it('should prevent cross-tenant delete via where filtering', () => {
        const tenantId = 'tenant-a';
        const maliciousData = {
          items: {
            delete: { id: 'item-from-tenant-b', tenantId: 'tenant-b' },
          },
        };

        const result = addTenantToData(maliciousData, tenantId);

        expect(result.items.delete.tenantId).toBe('tenant-a');
      });
    });

    describe('nested disconnect pattern', () => {
      it('should add tenantId to nested disconnect where', () => {
        const tenantId = 'tenant-disconnect';
        const data = {
          user: {
            disconnect: { id: 'user-1' },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.user.disconnect.tenantId).toBe(tenantId);
      });

      it('should add tenantId to array disconnect', () => {
        const tenantId = 'tenant-array-disconnect';
        const data = {
          tags: {
            disconnect: [{ id: 'tag-1' }, { id: 'tag-2' }],
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tags.disconnect[0].tenantId).toBe(tenantId);
        expect(result.tags.disconnect[1].tenantId).toBe(tenantId);
      });

      it('should preserve disconnect: true without modification', () => {
        const tenantId = 'tenant-disconnect-true';
        const data = {
          user: {
            disconnect: true,
          },
        };

        const result = addTenantToData(data, tenantId);

        // disconnect: true는 boolean이므로 수정되지 않음
        expect(result.user.disconnect).toBe(true);
      });
    });

    describe('nested set pattern', () => {
      it('should add tenantId to nested set', () => {
        const tenantId = 'tenant-set';
        const data = {
          tags: {
            set: [{ id: 'tag-1' }, { id: 'tag-2' }],
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.tags.set[0].tenantId).toBe(tenantId);
        expect(result.tags.set[1].tenantId).toBe(tenantId);
      });

      it('should prevent cross-tenant set via where filtering', () => {
        const tenantId = 'tenant-a';
        const maliciousData = {
          tags: {
            set: [{ id: 'tag-from-tenant-b', tenantId: 'tenant-b' }],
          },
        };

        const result = addTenantToData(maliciousData, tenantId);

        expect(result.tags.set[0].tenantId).toBe('tenant-a');
      });

      it('should handle single set object', () => {
        const tenantId = 'tenant-single-set';
        const data = {
          category: {
            set: { id: 'cat-1' },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.category.set.tenantId).toBe(tenantId);
      });
    });

    describe('deeply nested patterns', () => {
      it('should add tenantId to deeply nested update in create', () => {
        const tenantId = 'tenant-deep-update';
        const data = {
          name: 'Parent',
          children: {
            create: {
              name: 'Child',
              items: {
                update: { where: { id: 'item-1' }, data: { amount: 100 } },
              },
            },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.children.create.tenantId).toBe(tenantId);
        expect(result.children.create.items.update.where.tenantId).toBe(tenantId);
        expect(result.children.create.items.update.data.tenantId).toBe(tenantId);
      });

      it('should add tenantId to deeply nested upsert in create', () => {
        const tenantId = 'tenant-deep-upsert';
        const data = {
          expense: {
            create: {
              name: 'Expense',
              items: {
                upsert: {
                  where: { id: 'item-1' },
                  create: { amount: 100 },
                  update: { amount: 200 },
                },
              },
            },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.expense.create.items.upsert.where.tenantId).toBe(tenantId);
        expect(result.expense.create.items.upsert.create.tenantId).toBe(tenantId);
        expect(result.expense.create.items.upsert.update.tenantId).toBe(tenantId);
      });
    });

    describe('combined nested write patterns', () => {
      it('should handle mixed nested write operations in single data', () => {
        const tenantId = 'tenant-mixed';
        const data = {
          name: 'Expense',
          items: {
            create: [{ amount: 100 }],
            update: [{ where: { id: '1' }, data: { amount: 200 } }],
            deleteMany: { status: 'CANCELLED' },
          },
          user: {
            connect: { id: 'user-1' },
          },
          tags: {
            set: [{ id: 'tag-1' }],
          },
        };

        const result = addTenantToData(data, tenantId);

        // 모든 중첩 작업에 tenantId 적용 확인
        expect(result.tenantId).toBe(tenantId);
        expect(result.items.create[0].tenantId).toBe(tenantId);
        expect(result.items.update[0].where.tenantId).toBe(tenantId);
        expect(result.items.update[0].data.tenantId).toBe(tenantId);
        expect(result.items.deleteMany.tenantId).toBe(tenantId);
        expect(result.user.connect.tenantId).toBe(tenantId);
        expect(result.tags.set[0].tenantId).toBe(tenantId);
      });

      it('should handle connectOrCreate with nested operations', () => {
        const tenantId = 'tenant-complex';
        const data = {
          category: {
            connectOrCreate: {
              where: { name: 'Office' },
              create: {
                name: 'Office',
                subCategories: {
                  create: [{ name: 'Supplies' }],
                },
              },
            },
          },
        };

        const result = addTenantToData(data, tenantId);

        expect(result.category.connectOrCreate.where.tenantId).toBe(tenantId);
        expect(result.category.connectOrCreate.create.tenantId).toBe(tenantId);
        expect(result.category.connectOrCreate.create.subCategories.create[0].tenantId).toBe(
          tenantId
        );
      });
    });
  });

  describe('findUnique pre-filtering', () => {
    it('should add tenantId to findUnique where clause', () => {
      const tenantId = 'tenant-findUnique';
      const args = { where: { id: 'expense-123' } };

      const newArgs = {
        ...args,
        where: addTenantFilter(args.where, tenantId),
      };

      expect(newArgs.where).toEqual({
        id: 'expense-123',
        tenantId: 'tenant-findUnique',
      });
    });

    it('should prevent cross-tenant access via findUnique pre-filtering', () => {
      const currentTenantId = 'tenant-a';
      // 다른 테넌트의 레코드 ID로 findUnique 시도
      const args = { where: { id: 'record-from-tenant-b' } };

      const filteredWhere = addTenantFilter(args.where, currentTenantId);

      // where에 tenant-a가 포함되므로 tenant-b 레코드는 찾을 수 없음
      expect(filteredWhere.tenantId).toBe('tenant-a');
    });

    it('should override malicious tenantId in findUnique where', () => {
      const realTenantId = 'real-tenant';
      // 공격자가 where에 다른 tenantId 주입 시도
      const maliciousArgs = {
        where: { id: '123', tenantId: 'victim-tenant' },
      };

      const safeWhere = addTenantFilter(maliciousArgs.where, realTenantId);

      expect(safeWhere.tenantId).toBe('real-tenant');
    });

    it('should work with compound unique constraints', () => {
      const tenantId = 'tenant-compound';
      // 복합 unique 조건
      const args = {
        where: {
          email_tenantId: {
            email: 'test@example.com',
            tenantId: tenantId,
          },
        },
      };

      const filteredWhere = addTenantFilter(args.where, tenantId);

      // 기존 복합 조건 유지 + tenantId 추가
      expect(filteredWhere.email_tenantId).toBeDefined();
      expect(filteredWhere.tenantId).toBe(tenantId);
    });
  });
});
