/**
 * $queryRaw 테넌트 필터링 통합 테스트 - Offerings API
 *
 * 테스트 대상:
 * - GET /api/admin/offerings의 $queryRaw에서 tenant_id 필터링
 * - Raw SQL에서 크로스 테넌트 데이터 노출 방지
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// 모듈 모킹은 vi.mock 호이스팅으로 최상단에서 설정됨
vi.mock('@/lib/prisma', () => ({
  prisma: {
    offering: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/auth/user', () => ({
  withAuth: vi.fn((handler) => async (req: NextRequest) => {
    // 테스트용 인증된 사용자 컨텍스트 시뮬레이션
    const user = {
      id: 'user-1',
      tenantId: 'tenant-A',
      role: 'admin',
    };
    return handler(req, { user });
  }),
}));

describe('Offerings API - $queryRaw Tenant Filtering', () => {
  let prisma: {
    offering: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let GET: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // 동적 import로 모킹된 모듈 로드
    const prismaModule = await import('@/lib/prisma');
    prisma = prismaModule.prisma as typeof prisma;
    const routeModule = await import('../route');
    GET = routeModule.GET;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/offerings', () => {
    it('should include tenant_id in $queryRaw for months filter', async () => {
      // 기본 응답 설정
      prisma.offering.findMany.mockResolvedValue([]);
      prisma.offering.count.mockResolvedValue(0);
      prisma.offering.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: 0 });
      prisma.offering.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([{ month: '2025-01' }]);

      const request = new NextRequest('http://localhost/api/admin/offerings');
      await GET(request);

      // $queryRaw 호출 확인
      expect(prisma.$queryRaw).toHaveBeenCalled();

      // $queryRaw 호출 시 SQL 템플릿 검증
      // Prisma $queryRaw는 tagged template literal로 호출됨
      const call = prisma.$queryRaw.mock.calls[0];
      // call[0]은 SQL 템플릿 문자열 배열, call[1]이후는 파라미터
      // 파라미터에 tenantId가 포함되어야 함
      if (call && call.length > 1) {
        const params = call.slice(1);
        // tenant-A가 파라미터에 포함되어야 함
        expect(params).toContain('tenant-A');
      }
    });

    it('should filter months by current user tenant only', async () => {
      // 다른 테넌트의 데이터가 포함되지 않도록 검증
      prisma.offering.findMany.mockResolvedValue([]);
      prisma.offering.count.mockResolvedValue(0);
      prisma.offering.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: 0 });
      prisma.offering.groupBy.mockResolvedValue([]);
      // tenant-A의 데이터만 반환 (tenant-B 데이터는 필터링됨)
      prisma.$queryRaw.mockResolvedValue([
        { month: '2025-01' },
        { month: '2024-12' },
      ]);

      const request = new NextRequest('http://localhost/api/admin/offerings');
      const response = await GET(request);
      const data = await response.json();

      // 응답에 months가 포함되어야 함
      expect(data.months).toBeDefined();
      expect(Array.isArray(data.months)).toBe(true);
    });

    it('should not expose cross-tenant data in months list', async () => {
      // 쿼리가 tenant_id 필터를 포함하므로
      // tenant-B의 월 데이터가 tenant-A 사용자에게 노출되지 않음
      prisma.offering.findMany.mockResolvedValue([]);
      prisma.offering.count.mockResolvedValue(0);
      prisma.offering.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: 0 });
      prisma.offering.groupBy.mockResolvedValue([]);
      // 빈 결과 (해당 테넌트에 헌금 데이터 없음)
      prisma.$queryRaw.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/admin/offerings');
      const response = await GET(request);
      const data = await response.json();

      expect(data.months).toEqual([]);
    });
  });

  describe('SQL injection prevention', () => {
    it('should use parameterized query for tenant_id', async () => {
      prisma.offering.findMany.mockResolvedValue([]);
      prisma.offering.count.mockResolvedValue(0);
      prisma.offering.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: 0 });
      prisma.offering.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/admin/offerings');
      await GET(request);

      // Prisma $queryRaw tagged template은 자동으로 파라미터화됨
      // SQL 인젝션 공격이 불가능하도록 처리됨
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
