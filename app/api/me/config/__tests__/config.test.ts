/**
 * GET /api/me/config 테스트 (ARC-002 §4.1, B4)
 *
 * 테스트 대상:
 * - 미인증 → 401
 * - 응답 형태가 §4.1 계약과 키 단위로 일치 (tenant/labels/features/branding)
 * - settings 저장값의 labels/features 부분 override 반영 (resolveTenantSettings 실사용)
 * - branding: Tenant.logoUrl + settings.theme.primaryColor (없으면 기본값 #4f46e5)
 * - 테넌트 미존재 → 404
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setMockUser, resetMockUser, mockUserSession } from '@/test/setup';

// Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prismaBase: {
    tenant: {
      findUnique: vi.fn(),
    },
  },
}));

// Import after mocking
import { GET } from '../route';
import { prismaBase } from '@/lib/prisma';

const mockPrisma = prismaBase as any;

// withAuth 래핑 이후 라우트 핸들러는 (request, context) 시그니처를 갖는다
const mockRouteContext = { params: Promise.resolve({}) } as never;

function createRequest(): NextRequest {
  return new NextRequest('http://localhost/api/me/config');
}

// CHURCH 테넌트 — settings 미저장 (orgType 기본값 그대로)
const churchTenant = {
  id: 'test-tenant-id',
  name: '청연교회',
  orgType: 'CHURCH',
  logoUrl: 'https://cdn.example.com/logo.png',
  settings: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.tenant.findUnique.mockResolvedValue(churchTenant);
});

afterEach(() => {
  resetMockUser();
});

describe('GET /api/me/config (B4)', () => {
  describe('인증', () => {
    it('미인증이면 401', async () => {
      setMockUser(null);

      const response = await GET(createRequest(), mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('로그인이 필요합니다.');
      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('응답 계약 (§4.1)', () => {
    it('tenant/labels/features/branding이 키 단위로 일치한다', async () => {
      const response = await GET(createRequest(), mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      // 세션 토큰의 tenantId로만 조회 (공통 원칙 2)
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserSession.tenantId },
        })
      );
      expect(data).toEqual({
        tenant: {
          id: 'test-tenant-id',
          name: '청연교회',
          orgType: 'CHURCH',
        },
        labels: {
          department: '사역팀',
          position: '직분',
          budget: '예산(회계연도)',
        },
        features: {
          incomeModule: true,
          budgetModule: true,
          vat: false,
          taxInvoice: false,
          offeringLink: true,
        },
        branding: {
          logoUrl: 'https://cdn.example.com/logo.png',
          primaryColor: '#4f46e5',
        },
      });
    });

    it('COMPANY 테넌트는 COMPANY 기본 labels/features를 반환한다', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'test-tenant-id',
        name: '청연컨설팅',
        orgType: 'COMPANY',
        logoUrl: null,
        settings: null,
      });

      const response = await GET(createRequest(), mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.labels).toEqual({
        department: '팀',
        position: '직급',
        budget: '예산(회계연도)',
      });
      expect(data.features).toEqual({
        incomeModule: false,
        budgetModule: true,
        vat: true,
        taxInvoice: true,
        offeringLink: false,
      });
      expect(data.branding.logoUrl).toBeNull();
    });

    it('settings 저장값이 labels/features 기본값을 부분 override한다', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        ...churchTenant,
        settings: {
          labels: { department: '파트' },
          features: { incomeModule: false },
        },
      });

      const response = await GET(createRequest(), mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      // 저장된 키만 override, 나머지는 CHURCH 기본값 유지
      expect(data.labels).toEqual({
        department: '파트',
        position: '직분',
        budget: '예산(회계연도)',
      });
      expect(data.features).toEqual({
        incomeModule: false,
        budgetModule: true,
        vat: false,
        taxInvoice: false,
        offeringLink: true,
      });
    });
  });

  describe('branding', () => {
    it('settings.theme.primaryColor가 있으면 그대로 반환한다', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        ...churchTenant,
        settings: { theme: { primaryColor: '#1F3864' } },
      });

      const response = await GET(createRequest(), mockRouteContext);
      const data = await response.json();

      expect(data.branding).toEqual({
        logoUrl: 'https://cdn.example.com/logo.png',
        primaryColor: '#1F3864',
      });
    });

    it('primaryColor 미설정이면 기본값 #4f46e5', async () => {
      const response = await GET(createRequest(), mockRouteContext);
      const data = await response.json();

      expect(data.branding.primaryColor).toBe('#4f46e5');
    });
  });

  describe('예외', () => {
    it('테넌트 미존재 시 404', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const response = await GET(createRequest(), mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('조직 정보를 찾을 수 없습니다.');
    });
  });
});
