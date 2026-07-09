/**
 * 테넌트 조회 및 캐싱 테스트
 *
 * 테스트 대상:
 * - findTenantBySubdomain
 * - findTenantByCustomDomain
 * - findTenantById
 * - resolveTenant
 * - withTenantRequest
 * - invalidateTenantCache
 * - clearTenantCache
 * - 캐시 TTL 동작
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Prisma mock
vi.mock('@/lib/prisma', () => ({
  prismaBase: {
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

// tenant-context mock
vi.mock('../tenant-context', () => ({
  extractSubdomain: vi.fn(),
  withTenantAsync: vi.fn((context, fn) => fn()),
}));

import {
  findTenantBySubdomain,
  findTenantByCustomDomain,
  findTenantById,
  resolveTenant,
  withTenantRequest,
  invalidateTenantCache,
  clearTenantCache,
} from '../tenant';
import { prismaBase } from '@/lib/prisma';
import { extractSubdomain, withTenantAsync } from '../tenant-context';

const mockPrisma = prismaBase as any;
const mockExtractSubdomain = extractSubdomain as any;
const mockWithTenantAsync = withTenantAsync as any;

describe('tenant', () => {
  const mockActiveTenant = {
    id: 'tenant-1',
    subdomain: 'chungyeon',
    plan: 'PRO',
    isActive: true,
  };

  const mockInactiveTenant = {
    id: 'tenant-2',
    subdomain: 'inactive',
    plan: 'FREE',
    isActive: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearTenantCache();
    // 환경변수 설정
    process.env.BASE_DOMAIN = 'expense-saas.com';
  });

  afterEach(() => {
    clearTenantCache();
    delete process.env.BASE_DOMAIN;
  });

  describe('findTenantBySubdomain', () => {
    it('should return tenant context for active tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      const result = await findTenantBySubdomain('chungyeon');

      expect(result).toEqual({
        tenantId: 'tenant-1',
        subdomain: 'chungyeon',
        plan: 'PRO',
      });
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { subdomain: 'chungyeon' },
        select: {
          id: true,
          subdomain: true,
          plan: true,
          isActive: true,
        },
      });
    });

    it('should return null for inactive tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockInactiveTenant);

      const result = await findTenantBySubdomain('inactive');

      expect(result).toBeNull();
    });

    it('should return null when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await findTenantBySubdomain('nonexistent');

      expect(result).toBeNull();
    });

    it('should cache tenant on first call', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      // 첫 번째 호출
      await findTenantBySubdomain('chungyeon');
      // 두 번째 호출
      await findTenantBySubdomain('chungyeon');

      // DB는 한 번만 호출됨
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should return cached tenant on subsequent calls', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      const result1 = await findTenantBySubdomain('chungyeon');
      const result2 = await findTenantBySubdomain('chungyeon');

      expect(result1).toEqual(result2);
    });
  });

  describe('findTenantByCustomDomain', () => {
    const customDomainTenant = {
      id: 'tenant-3',
      subdomain: 'custom',
      plan: 'ENTERPRISE',
      isActive: true,
    };

    it('should return tenant context for custom domain', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(customDomainTenant);

      const result = await findTenantByCustomDomain('custom.church.com');

      expect(result).toEqual({
        tenantId: 'tenant-3',
        subdomain: 'custom',
        plan: 'ENTERPRISE',
      });
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { customDomain: 'custom.church.com' },
        select: {
          id: true,
          subdomain: true,
          plan: true,
          isActive: true,
        },
      });
    });

    it('should return null for inactive tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        ...customDomainTenant,
        isActive: false,
      });

      const result = await findTenantByCustomDomain('custom.church.com');

      expect(result).toBeNull();
    });

    it('should cache custom domain lookup', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(customDomainTenant);

      await findTenantByCustomDomain('custom.church.com');
      await findTenantByCustomDomain('custom.church.com');

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('findTenantById', () => {
    it('should return tenant context by id', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      const result = await findTenantById('tenant-1');

      expect(result).toEqual({
        tenantId: 'tenant-1',
        subdomain: 'chungyeon',
        plan: 'PRO',
      });
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        select: {
          id: true,
          subdomain: true,
          plan: true,
          isActive: true,
        },
      });
    });

    it('should return null for inactive tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockInactiveTenant);

      const result = await findTenantById('tenant-2');

      expect(result).toBeNull();
    });

    it('should cache id lookup', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      await findTenantById('tenant-1');
      await findTenantById('tenant-1');

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveTenant', () => {
    it('should resolve tenant from tenantParam first', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);
      mockExtractSubdomain.mockReturnValue(null);

      const result = await resolveTenant('localhost:3000', 'chungyeon');

      expect(result).toEqual({
        tenantId: 'tenant-1',
        subdomain: 'chungyeon',
        plan: 'PRO',
      });
    });

    it('should resolve tenant from subdomain', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);
      mockExtractSubdomain.mockReturnValue('chungyeon');

      const result = await resolveTenant('chungyeon.expense-saas.com', null);

      expect(result).toEqual({
        tenantId: 'tenant-1',
        subdomain: 'chungyeon',
        plan: 'PRO',
      });
    });

    it('should return null when host is null and no param', async () => {
      const result = await resolveTenant(null, null);

      expect(result).toBeNull();
    });

    it('should try custom domain when not matching base domain', async () => {
      const customTenant = {
        id: 'tenant-custom',
        subdomain: 'custom',
        plan: 'ENTERPRISE',
        isActive: true,
      };
      mockPrisma.tenant.findUnique.mockResolvedValue(customTenant);
      mockExtractSubdomain.mockReturnValue(null);

      const result = await resolveTenant('custom.church.com', null);

      expect(result).toEqual({
        tenantId: 'tenant-custom',
        subdomain: 'custom',
        plan: 'ENTERPRISE',
      });
    });

    it('should return null for localhost without param', async () => {
      mockExtractSubdomain.mockReturnValue(null);

      const result = await resolveTenant('localhost:3000', null);

      expect(result).toBeNull();
    });
  });

  describe('withTenantRequest', () => {
    it('should execute handler within tenant context', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);
      mockExtractSubdomain.mockReturnValue('chungyeon');

      const handler = vi.fn().mockResolvedValue('result');

      await withTenantRequest('chungyeon.expense-saas.com', null, handler);

      expect(mockWithTenantAsync).toHaveBeenCalledWith(
        {
          tenantId: 'tenant-1',
          subdomain: 'chungyeon',
          plan: 'PRO',
        },
        handler
      );
    });

    it('should execute handler without tenant context when not resolved', async () => {
      mockExtractSubdomain.mockReturnValue(null);

      const handler = vi.fn().mockResolvedValue('result');

      const result = await withTenantRequest('localhost:3000', null, handler);

      expect(handler).toHaveBeenCalled();
      expect(mockWithTenantAsync).not.toHaveBeenCalled();
    });

    it('should use tenantParam over host', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      const handler = vi.fn().mockResolvedValue('result');

      await withTenantRequest('localhost:3000', 'chungyeon', handler);

      expect(mockWithTenantAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          subdomain: 'chungyeon',
        }),
        handler
      );
    });
  });

  describe('invalidateTenantCache', () => {
    it('should clear cache for tenant by id', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      // 캐시 설정
      await findTenantById('tenant-1');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);

      // 캐시 무효화
      invalidateTenantCache('tenant-1');

      // 다시 조회 시 DB 호출됨
      await findTenantById('tenant-1');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should clear cache for tenant by subdomain', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      // 캐시 설정
      await findTenantBySubdomain('chungyeon');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);

      // 캐시 무효화 (subdomain 포함)
      invalidateTenantCache('tenant-1', 'chungyeon');

      // 다시 조회 시 DB 호출됨
      await findTenantBySubdomain('chungyeon');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache entries for tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      // 여러 방식으로 캐시 설정
      await findTenantById('tenant-1');
      await findTenantBySubdomain('chungyeon');

      // 캐시 무효화
      invalidateTenantCache('tenant-1', 'chungyeon');

      // 두 캐시 모두 무효화됨
      await findTenantById('tenant-1');
      await findTenantBySubdomain('chungyeon');

      // 총 4번 호출됨 (초기 2 + 재조회 2)
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(4);
    });
  });

  describe('clearTenantCache', () => {
    it('should clear all cached tenants', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      // 캐시 설정
      await findTenantById('tenant-1');
      await findTenantBySubdomain('chungyeon');

      // 전체 캐시 초기화
      clearTenantCache();

      // 재조회 시 모두 DB 호출
      await findTenantById('tenant-1');
      await findTenantBySubdomain('chungyeon');

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(4);
    });
  });

  describe('Cache TTL behavior', () => {
    it('should expire cache after TTL', async () => {
      // Date.now() 모킹
      const originalDateNow = Date.now;
      let mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      // 첫 번째 호출
      await findTenantBySubdomain('chungyeon');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1);

      // 4분 후 (TTL 내)
      mockNow += 4 * 60 * 1000;
      await findTenantBySubdomain('chungyeon');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(1); // 여전히 캐시 사용

      // 6분 후 (TTL 초과)
      mockNow += 2 * 60 * 1000;
      await findTenantBySubdomain('chungyeon');
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(2); // DB 재조회

      // Date.now 복원
      Date.now = originalDateNow;
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent requests for same tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(mockActiveTenant);

      // 동시 요청
      const results = await Promise.all([
        findTenantBySubdomain('chungyeon'),
        findTenantBySubdomain('chungyeon'),
        findTenantBySubdomain('chungyeon'),
      ]);

      // 모든 결과가 동일해야 함
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });

    it('should handle empty subdomain', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await findTenantBySubdomain('');

      expect(result).toBeNull();
    });

    it('should handle tenant with no plan', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        ...mockActiveTenant,
        plan: null,
      });

      const result = await findTenantBySubdomain('chungyeon');

      expect(result).toEqual({
        tenantId: 'tenant-1',
        subdomain: 'chungyeon',
        plan: null,
      });
    });
  });
});
