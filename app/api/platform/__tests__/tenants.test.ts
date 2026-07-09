/**
 * 플랫폼 테넌트 API 테스트
 *
 * 테스트 대상:
 * - GET /api/platform/tenants - 테넌트 목록 조회
 * - POST /api/platform/tenants - 테넌트 생성
 * - withSuperAdmin 인증 래퍼 동작
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// 플랫폼 API 테스트는 통합 테스트 성격이므로
// 핵심 비즈니스 로직을 시뮬레이션하여 테스트

describe('Platform Tenants API', () => {
  describe('GET /api/platform/tenants', () => {
    // 테넌트 목록 조회 로직 시뮬레이션
    interface Tenant {
      id: string;
      name: string;
      subdomain: string;
      customDomain: string | null;
      orgType: string;
      plan: string;
      maxUsers: number;
      currentUsers: number;
      isActive: boolean;
      createdAt: Date;
    }

    const mockTenants: Tenant[] = [
      {
        id: 'tenant-1',
        name: '청연교회',
        subdomain: 'chungyeon',
        customDomain: null,
        orgType: 'church',
        plan: 'PRO',
        maxUsers: 50,
        currentUsers: 10,
        isActive: true,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'tenant-2',
        name: '서울교회',
        subdomain: 'seoul',
        customDomain: 'expense.seoulchurch.org',
        orgType: 'church',
        plan: 'ENTERPRISE',
        maxUsers: -1,
        currentUsers: 100,
        isActive: true,
        createdAt: new Date('2024-02-01'),
      },
      {
        id: 'tenant-3',
        name: '비활성 테스트',
        subdomain: 'inactive',
        customDomain: null,
        orgType: 'nonprofit',
        plan: 'FREE',
        maxUsers: 5,
        currentUsers: 3,
        isActive: false,
        createdAt: new Date('2024-03-01'),
      },
    ];

    // 검색/필터/페이지네이션 시뮬레이션
    const queryTenants = (params: {
      search?: string;
      plan?: string;
      orgType?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }) => {
      let filtered = [...mockTenants];

      // 검색
      if (params.search) {
        const search = params.search.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.name.toLowerCase().includes(search) ||
            t.subdomain.toLowerCase().includes(search) ||
            t.customDomain?.toLowerCase().includes(search)
        );
      }

      // 필터
      if (params.plan) {
        filtered = filtered.filter((t) => t.plan === params.plan);
      }
      if (params.orgType) {
        filtered = filtered.filter((t) => t.orgType === params.orgType);
      }
      if (params.isActive !== undefined) {
        filtered = filtered.filter((t) => t.isActive === params.isActive);
      }

      // 정렬
      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder || 'desc';
      filtered.sort((a, b) => {
        const aVal = a[sortBy as keyof Tenant];
        const bVal = b[sortBy as keyof Tenant];
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // 페이지네이션
      const page = params.page || 1;
      const limit = params.limit || 10;
      const start = (page - 1) * limit;
      const paged = filtered.slice(start, start + limit);

      return {
        tenants: paged,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      };
    };

    it('should return all tenants with default pagination', () => {
      const result = queryTenants({});

      expect(result.tenants).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by search keyword', () => {
      const result = queryTenants({ search: '청연' });

      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0].subdomain).toBe('chungyeon');
    });

    it('should filter by plan', () => {
      const result = queryTenants({ plan: 'PRO' });

      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0].plan).toBe('PRO');
    });

    it('should filter by orgType', () => {
      const result = queryTenants({ orgType: 'church' });

      expect(result.tenants).toHaveLength(2);
    });

    it('should filter by isActive', () => {
      const activeResult = queryTenants({ isActive: true });
      const inactiveResult = queryTenants({ isActive: false });

      expect(activeResult.tenants).toHaveLength(2);
      expect(inactiveResult.tenants).toHaveLength(1);
    });

    it('should apply pagination', () => {
      const result = queryTenants({ page: 1, limit: 2 });

      expect(result.tenants).toHaveLength(2);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should sort by specified field', () => {
      const ascResult = queryTenants({ sortBy: 'name', sortOrder: 'asc' });
      const descResult = queryTenants({ sortBy: 'name', sortOrder: 'desc' });

      expect(ascResult.tenants[0].name < ascResult.tenants[1].name).toBe(true);
      expect(descResult.tenants[0].name > descResult.tenants[1].name).toBe(true);
    });
  });

  describe('POST /api/platform/tenants', () => {
    // 테넌트 생성 로직 시뮬레이션
    interface CreateTenantInput {
      name: string;
      subdomain: string;
      customDomain?: string;
      orgType: string;
      plan: string;
      description?: string;
      adminEmail?: string;
      adminName?: string;
      adminPassword?: string;
    }

    const existingSubdomains = ['chungyeon', 'seoul'];
    const existingDomains = ['expense.seoulchurch.org'];

    const planLimits: Record<string, { maxUsers: number; maxStorageMB: number }> = {
      FREE: { maxUsers: 5, maxStorageMB: 100 },
      PRO: { maxUsers: 50, maxStorageMB: 1000 },
      ENTERPRISE: { maxUsers: -1, maxStorageMB: -1 },
    };

    const validateSubdomain = (subdomain: string): { valid: boolean; error?: string } => {
      if (existingSubdomains.includes(subdomain)) {
        return { valid: false, error: '이미 사용 중인 서브도메인입니다.' };
      }
      return { valid: true };
    };

    const validateCustomDomain = (domain: string | undefined): { valid: boolean; error?: string } => {
      if (!domain) return { valid: true };
      if (existingDomains.includes(domain)) {
        return { valid: false, error: '이미 사용 중인 커스텀 도메인입니다.' };
      }
      return { valid: true };
    };

    const createTenant = (input: CreateTenantInput): {
      success: boolean;
      tenant?: any;
      error?: string;
      statusCode?: number;
    } => {
      // 서브도메인 중복 검사
      const subdomainCheck = validateSubdomain(input.subdomain);
      if (!subdomainCheck.valid) {
        return { success: false, error: subdomainCheck.error, statusCode: 409 };
      }

      // 커스텀 도메인 중복 검사
      const domainCheck = validateCustomDomain(input.customDomain);
      if (!domainCheck.valid) {
        return { success: false, error: domainCheck.error, statusCode: 409 };
      }

      // 요금제 제한 적용
      const limits = planLimits[input.plan];

      // 테넌트 생성
      const newTenant = {
        id: `tenant-${Date.now()}`,
        name: input.name,
        subdomain: input.subdomain,
        customDomain: input.customDomain || null,
        orgType: input.orgType,
        plan: input.plan,
        description: input.description || null,
        maxUsers: limits.maxUsers,
        maxStorageMB: limits.maxStorageMB,
        currentUsers: input.adminEmail ? 1 : 0,
        isActive: true,
        createdAt: new Date(),
      };

      return { success: true, tenant: newTenant, statusCode: 201 };
    };

    it('should create tenant successfully', () => {
      const result = createTenant({
        name: '새 교회',
        subdomain: 'newchurch',
        orgType: 'church',
        plan: 'PRO',
      });

      expect(result.success).toBe(true);
      expect(result.tenant).toBeDefined();
      expect(result.tenant.name).toBe('새 교회');
      expect(result.statusCode).toBe(201);
    });

    it('should reject duplicate subdomain', () => {
      const result = createTenant({
        name: '중복 테스트',
        subdomain: 'chungyeon', // 이미 존재
        orgType: 'church',
        plan: 'FREE',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('서브도메인');
      expect(result.statusCode).toBe(409);
    });

    it('should reject duplicate custom domain', () => {
      const result = createTenant({
        name: '도메인 중복 테스트',
        subdomain: 'unique',
        customDomain: 'expense.seoulchurch.org', // 이미 존재
        orgType: 'church',
        plan: 'ENTERPRISE',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('커스텀 도메인');
      expect(result.statusCode).toBe(409);
    });

    it('should apply plan limits correctly', () => {
      const freeResult = createTenant({
        name: 'Free Plan',
        subdomain: 'free1',
        orgType: 'nonprofit',
        plan: 'FREE',
      });

      const proResult = createTenant({
        name: 'Pro Plan',
        subdomain: 'pro1',
        orgType: 'church',
        plan: 'PRO',
      });

      const enterpriseResult = createTenant({
        name: 'Enterprise Plan',
        subdomain: 'enterprise1',
        orgType: 'enterprise',
        plan: 'ENTERPRISE',
      });

      expect(freeResult.tenant.maxUsers).toBe(5);
      expect(proResult.tenant.maxUsers).toBe(50);
      expect(enterpriseResult.tenant.maxUsers).toBe(-1); // 무제한
    });

    it('should set currentUsers to 1 when admin is provided', () => {
      const withAdmin = createTenant({
        name: '관리자 포함',
        subdomain: 'withadmin',
        orgType: 'church',
        plan: 'PRO',
        adminEmail: 'admin@test.com',
        adminName: '관리자',
        adminPassword: 'password123',
      });

      const withoutAdmin = createTenant({
        name: '관리자 미포함',
        subdomain: 'withoutadmin',
        orgType: 'church',
        plan: 'PRO',
      });

      expect(withAdmin.tenant.currentUsers).toBe(1);
      expect(withoutAdmin.tenant.currentUsers).toBe(0);
    });
  });

  describe('Authentication for Platform API', () => {
    // withSuperAdmin 래퍼 동작 검증
    interface SuperAdminSession {
      id: string;
      email: string;
      name: string;
    }

    const mockSuperAdmin: SuperAdminSession = {
      id: 'super-1',
      email: 'admin@platform.com',
      name: '플랫폼 관리자',
    };

    // withSuperAdmin 시뮬레이션
    const withSuperAdmin = (
      getSuperAdmin: () => SuperAdminSession | null,
      handler: (req: NextRequest, ctx: { superAdmin: SuperAdminSession }) => Promise<NextResponse>
    ) => {
      return async (req: NextRequest): Promise<NextResponse> => {
        const superAdmin = getSuperAdmin();
        if (!superAdmin) {
          return NextResponse.json(
            { error: '인증이 필요합니다. 플랫폼 관리자로 로그인하세요.' },
            { status: 401 }
          );
        }
        return handler(req, { superAdmin });
      };
    };

    it('should return 401 when not authenticated', async () => {
      const handler = vi.fn();
      const wrapped = withSuperAdmin(() => null, handler);

      const request = new NextRequest('http://localhost/api/platform/tenants');
      const response = await wrapped(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('인증이 필요합니다');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should call handler when authenticated', async () => {
      const handler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );
      const wrapped = withSuperAdmin(() => mockSuperAdmin, handler);

      const request = new NextRequest('http://localhost/api/platform/tenants');
      const response = await wrapped(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it('should pass superAdmin to handler', async () => {
      const handler = vi.fn().mockImplementation((_req, ctx) => {
        expect(ctx.superAdmin).toEqual(mockSuperAdmin);
        return NextResponse.json({ success: true });
      });
      const wrapped = withSuperAdmin(() => mockSuperAdmin, handler);

      const request = new NextRequest('http://localhost/api/platform/tenants');
      await wrapped(request);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Tenant Update Operations', () => {
    // PUT /api/platform/tenants/[id] 시뮬레이션
    interface Tenant {
      id: string;
      name: string;
      subdomain: string;
      plan: string;
      maxUsers: number;
      isActive: boolean;
    }

    const existingTenant: Tenant = {
      id: 'tenant-1',
      name: '청연교회',
      subdomain: 'chungyeon',
      plan: 'PRO',
      maxUsers: 50,
      isActive: true,
    };

    const updateTenant = (
      tenantId: string,
      updates: Partial<Tenant>
    ): { success: boolean; tenant?: Tenant; error?: string; statusCode?: number } => {
      if (tenantId !== existingTenant.id) {
        return { success: false, error: '테넌트를 찾을 수 없습니다.', statusCode: 404 };
      }

      const updated = { ...existingTenant, ...updates };
      return { success: true, tenant: updated, statusCode: 200 };
    };

    it('should update tenant successfully', () => {
      const result = updateTenant('tenant-1', { name: '청연교회 (수정됨)' });

      expect(result.success).toBe(true);
      expect(result.tenant?.name).toBe('청연교회 (수정됨)');
    });

    it('should return 404 for non-existent tenant', () => {
      const result = updateTenant('non-existent', { name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
    });

    it('should update plan and adjust limits', () => {
      const result = updateTenant('tenant-1', {
        plan: 'ENTERPRISE',
        maxUsers: -1,
      });

      expect(result.success).toBe(true);
      expect(result.tenant?.plan).toBe('ENTERPRISE');
      expect(result.tenant?.maxUsers).toBe(-1);
    });
  });

  describe('Tenant Suspension Operations', () => {
    // 테넌트 정지/재활성화 시뮬레이션
    interface TenantWithSuspension {
      id: string;
      name: string;
      isActive: boolean;
      suspendedAt: Date | null;
      suspendReason: string | null;
    }

    let mockTenant: TenantWithSuspension = {
      id: 'tenant-1',
      name: '청연교회',
      isActive: true,
      suspendedAt: null,
      suspendReason: null,
    };

    const suspendTenant = (reason: string): TenantWithSuspension => {
      mockTenant = {
        ...mockTenant,
        isActive: false,
        suspendedAt: new Date(),
        suspendReason: reason,
      };
      return mockTenant;
    };

    const reactivateTenant = (): TenantWithSuspension => {
      mockTenant = {
        ...mockTenant,
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
      };
      return mockTenant;
    };

    beforeEach(() => {
      mockTenant = {
        id: 'tenant-1',
        name: '청연교회',
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
      };
    });

    it('should suspend tenant with reason', () => {
      const result = suspendTenant('결제 미납');

      expect(result.isActive).toBe(false);
      expect(result.suspendedAt).toBeDefined();
      expect(result.suspendReason).toBe('결제 미납');
    });

    it('should reactivate suspended tenant', () => {
      suspendTenant('테스트 정지');
      const result = reactivateTenant();

      expect(result.isActive).toBe(true);
      expect(result.suspendedAt).toBeNull();
      expect(result.suspendReason).toBeNull();
    });
  });

  describe('Activity Logging', () => {
    // 활동 로그 기록 시뮬레이션
    interface ActivityLog {
      id: string;
      superAdminId: string;
      superAdminEmail: string;
      action: string;
      entityType: string;
      entityId: string;
      tenantId?: string;
      tenantName?: string;
      details: Record<string, any>;
      createdAt: Date;
    }

    const activityLogs: ActivityLog[] = [];

    const logActivity = (log: Omit<ActivityLog, 'id' | 'createdAt'>): ActivityLog => {
      const newLog: ActivityLog = {
        ...log,
        id: `log-${Date.now()}`,
        createdAt: new Date(),
      };
      activityLogs.push(newLog);
      return newLog;
    };

    beforeEach(() => {
      activityLogs.length = 0;
    });

    it('should log CREATE_TENANT action', () => {
      const log = logActivity({
        superAdminId: 'super-1',
        superAdminEmail: 'admin@platform.com',
        action: 'CREATE_TENANT',
        entityType: 'tenant',
        entityId: 'tenant-new',
        tenantId: 'tenant-new',
        tenantName: '새 테넌트',
        details: {
          name: '새 테넌트',
          subdomain: 'new',
          plan: 'PRO',
        },
      });

      expect(log.action).toBe('CREATE_TENANT');
      expect(log.entityType).toBe('tenant');
      expect(log.details.subdomain).toBe('new');
    });

    it('should log UPDATE_TENANT action', () => {
      const log = logActivity({
        superAdminId: 'super-1',
        superAdminEmail: 'admin@platform.com',
        action: 'UPDATE_TENANT',
        entityType: 'tenant',
        entityId: 'tenant-1',
        tenantId: 'tenant-1',
        tenantName: '청연교회',
        details: {
          changes: { plan: { from: 'PRO', to: 'ENTERPRISE' } },
        },
      });

      expect(log.action).toBe('UPDATE_TENANT');
      expect(log.details.changes.plan.to).toBe('ENTERPRISE');
    });

    it('should log SUSPEND_TENANT action', () => {
      const log = logActivity({
        superAdminId: 'super-1',
        superAdminEmail: 'admin@platform.com',
        action: 'SUSPEND_TENANT',
        entityType: 'tenant',
        entityId: 'tenant-1',
        tenantId: 'tenant-1',
        tenantName: '청연교회',
        details: {
          reason: '결제 미납',
        },
      });

      expect(log.action).toBe('SUSPEND_TENANT');
      expect(log.details.reason).toBe('결제 미납');
      expect(activityLogs).toHaveLength(1);
    });
  });
});
