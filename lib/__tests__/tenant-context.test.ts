import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTenantContext,
  getTenantId,
  getTenantIdOptional,
  withTenant,
  withTenantAsync,
  extractSubdomain,
  TenantContext,
} from '../tenant-context';

describe('tenant-context', () => {
  describe('extractSubdomain', () => {
    it('should return null for null host', () => {
      expect(extractSubdomain(null)).toBeNull();
    });

    it('should return null for localhost', () => {
      expect(extractSubdomain('localhost:3000')).toBeNull();
      expect(extractSubdomain('127.0.0.1:3000')).toBeNull();
    });

    it('should return null for base domain without subdomain', () => {
      expect(extractSubdomain('expense-saas.com')).toBeNull();
    });

    it('should extract subdomain from 3-part domain', () => {
      expect(extractSubdomain('chungyeon.expense-saas.com')).toBe('chungyeon');
      expect(extractSubdomain('somang.expense-saas.com')).toBe('somang');
      expect(extractSubdomain('test.expense-saas.com')).toBe('test');
    });

    it('should return null for system subdomains', () => {
      expect(extractSubdomain('www.expense-saas.com')).toBeNull();
      expect(extractSubdomain('app.expense-saas.com')).toBeNull();
      expect(extractSubdomain('api.expense-saas.com')).toBeNull();
      expect(extractSubdomain('admin.expense-saas.com')).toBeNull();
      expect(extractSubdomain('static.expense-saas.com')).toBeNull();
    });

    it('should handle 4-part domains', () => {
      expect(extractSubdomain('chungyeon.app.expense-saas.com')).toBe('chungyeon');
    });

    it('should return null for PaaS default domains (service name is not a tenant)', () => {
      expect(extractSubdomain('zionyul-expense-saas.onrender.com')).toBeNull();
      expect(extractSubdomain('myapp.vercel.app')).toBeNull();
      expect(extractSubdomain('myapp.netlify.app')).toBeNull();
    });

    it('should ignore port when extracting subdomain', () => {
      expect(extractSubdomain('chungyeon.expense-saas.com:3000')).toBe('chungyeon');
    });
  });

  describe('getTenantContext / getTenantId / getTenantIdOptional', () => {
    it('should return undefined when not in tenant context', () => {
      expect(getTenantContext()).toBeUndefined();
      expect(getTenantIdOptional()).toBeUndefined();
    });

    it('should throw error when getTenantId called outside context', () => {
      expect(() => getTenantId()).toThrow('테넌트 컨텍스트가 설정되지 않았습니다');
    });
  });

  describe('withTenant', () => {
    it('should set tenant context within callback', () => {
      const context: TenantContext = {
        tenantId: 'test-tenant-id',
        subdomain: 'test',
        plan: 'PRO',
      };

      const result = withTenant(context, () => {
        expect(getTenantContext()).toEqual(context);
        expect(getTenantId()).toBe('test-tenant-id');
        expect(getTenantIdOptional()).toBe('test-tenant-id');
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should restore context after callback completes', () => {
      const context: TenantContext = {
        tenantId: 'test-tenant-id',
        subdomain: 'test',
      };

      withTenant(context, () => {
        expect(getTenantId()).toBe('test-tenant-id');
      });

      // 컨텍스트 외부에서는 undefined
      expect(getTenantContext()).toBeUndefined();
    });

    it('should support nested contexts', () => {
      const context1: TenantContext = {
        tenantId: 'tenant-1',
        subdomain: 'one',
      };
      const context2: TenantContext = {
        tenantId: 'tenant-2',
        subdomain: 'two',
      };

      withTenant(context1, () => {
        expect(getTenantId()).toBe('tenant-1');

        withTenant(context2, () => {
          expect(getTenantId()).toBe('tenant-2');
        });

        // 내부 컨텍스트 종료 후 외부 컨텍스트 복원
        expect(getTenantId()).toBe('tenant-1');
      });
    });
  });

  describe('withTenantAsync', () => {
    it('should set tenant context within async callback', async () => {
      const context: TenantContext = {
        tenantId: 'async-tenant-id',
        subdomain: 'async',
      };

      const result = await withTenantAsync(context, async () => {
        expect(getTenantContext()).toEqual(context);
        expect(getTenantId()).toBe('async-tenant-id');

        // 비동기 작업 시뮬레이션
        await new Promise((resolve) => setTimeout(resolve, 10));

        // 비동기 작업 후에도 컨텍스트 유지
        expect(getTenantId()).toBe('async-tenant-id');

        return 'async-success';
      });

      expect(result).toBe('async-success');
    });

    it('should restore context after async callback completes', async () => {
      const context: TenantContext = {
        tenantId: 'async-tenant-id',
        subdomain: 'async',
      };

      await withTenantAsync(context, async () => {
        expect(getTenantId()).toBe('async-tenant-id');
      });

      // 컨텍스트 외부에서는 undefined
      expect(getTenantContext()).toBeUndefined();
    });

    it('should propagate errors from async callback', async () => {
      const context: TenantContext = {
        tenantId: 'error-tenant',
        subdomain: 'error',
      };

      await expect(
        withTenantAsync(context, async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });
});
