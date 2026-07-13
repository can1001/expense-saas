/**
 * GET /api/budget/usage-details API 테스트
 *
 * 테스트 대상:
 * - 항/목/세목 조합별 사용금액 상세 내역 조회
 * - excludeExpenseId 파라미터로 특정 지출 제외
 * - CUID 형식 검증
 * - 필수 파라미터 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expenseItem: {
      findMany: vi.fn(),
    },
  },
}));

// Mock validators
vi.mock('@/lib/validators', () => ({
  isValidCuid: vi.fn((id: string) => /^c[a-z0-9]{20,32}$/.test(id)),
}));

// Import after mocking
import { GET } from '../usage-details/route';

// withAuth 래핑 이후 라우트 핸들러는 (request, context) 시그니처를 갖는다
const mockRouteContext = { params: Promise.resolve({}) } as never;
import { prisma } from '@/lib/prisma';
import { isValidCuid } from '@/lib/validators';

describe('GET /api/budget/usage-details', () => {
  const mockPrisma = prisma as any;
  const mockIsValidCuid = isValidCuid as ReturnType<typeof vi.fn>;

  const baseParams = {
    budgetCategory: '교육사역비',
    budgetSubcategory: '영유아사역비',
    budgetDetail: '행사비(선물)',
    year: '2026',
  };

  const createRequest = (params: Record<string, string>) => {
    const url = new URL('http://localhost:3000/api/budget/usage-details');
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  };

  const mockExpenseItems = [
    {
      id: 'item-1',
      budgetCategory: '교육사역비',
      budgetSubcategory: '영유아사역비',
      budgetDetail: '행사비(선물)',
      description: '영유아부 선물 구입',
      amount: 100000,
      expense: {
        id: 'expense-1',
        requestDate: new Date('2026-03-15'),
        applicantName: '홍길동',
        status: 'APPROVED_FINAL',
      },
    },
    {
      id: 'item-2',
      budgetCategory: '교육사역비',
      budgetSubcategory: '영유아사역비',
      budgetDetail: '행사비(선물)',
      description: '영유아부 행사 선물',
      amount: 50000,
      expense: {
        id: 'expense-2',
        requestDate: new Date('2026-04-20'),
        applicantName: '김철수',
        status: 'APPROVED_STEP_1',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidCuid.mockImplementation((id: string) => /^c[a-z0-9]{20,32}$/.test(id));
  });

  describe('파라미터 검증', () => {
    it('budgetCategory 파라미터가 없으면 400 에러를 반환해야 함', async () => {
      const { budgetCategory: _omit, ...rest } = baseParams;
      const request = createRequest(rest);

      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('budgetCategory');
    });

    it('budgetSubcategory 파라미터가 없으면 400 에러를 반환해야 함', async () => {
      const { budgetSubcategory: _omit, ...rest } = baseParams;
      const request = createRequest(rest);

      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('budgetSubcategory');
    });

    it('budgetDetail 파라미터가 없으면 400 에러를 반환해야 함', async () => {
      const { budgetDetail: _omit, ...rest } = baseParams;
      const request = createRequest(rest);

      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('budgetDetail');
    });

    it('year 파라미터가 없으면 400 에러를 반환해야 함', async () => {
      const { year: _omit, ...rest } = baseParams;
      const request = createRequest(rest);

      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('year');
    });

    it('year가 숫자가 아니면 400 에러를 반환해야 함', async () => {
      const request = createRequest({ ...baseParams, year: 'invalid' });

      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('숫자');
    });

    it('excludeExpenseId가 유효하지 않은 CUID 형식이면 400 에러를 반환해야 함', async () => {
      const request = createRequest({
        ...baseParams,
        excludeExpenseId: 'invalid-id-format',
      });

      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('ID 형식');
    });

    it('excludeExpenseId가 유효한 CUID 형식이면 정상 처리해야 함', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue([]);
      const validCuid = 'clfh5asn7z0000qw5vx2e4t5h7';

      const request = createRequest({
        ...baseParams,
        excludeExpenseId: validCuid,
      });

      const response = await GET(request, mockRouteContext);

      expect(response.status).toBe(200);
    });
  });

  describe('정상 조회', () => {
    it('항/목/세목별 사용 내역을 반환해야 함', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue(mockExpenseItems);

      const request = createRequest(baseParams);

      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.budgetCategory).toBe('교육사역비');
      expect(data.budgetSubcategory).toBe('영유아사역비');
      expect(data.budgetDetail).toBe('행사비(선물)');
      expect(data.year).toBe(2026);
      expect(data.items).toHaveLength(2);
      expect(data.totalAmount).toBe(150000);
      expect(data.count).toBe(2);
    });

    it('반환된 항목에 필요한 필드가 포함되어야 함', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue(mockExpenseItems);

      const request = createRequest(baseParams);

      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      const item = data.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('expenseId');
      expect(item).toHaveProperty('requestDate');
      expect(item).toHaveProperty('applicantName');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('amount');
      expect(item).toHaveProperty('status');
    });

    it('데이터가 없으면 빈 배열과 0을 반환해야 함', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue([]);

      const request = createRequest(baseParams);

      const response = await GET(request, mockRouteContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(0);
      expect(data.totalAmount).toBe(0);
      expect(data.count).toBe(0);
    });
  });

  describe('excludeExpenseId 동작', () => {
    it('excludeExpenseId가 제공되면 해당 지출을 제외하는 쿼리를 실행해야 함', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue([]);
      const excludeId = 'clfh5asn7z0000qw5vx2e4t5h7';

      const request = createRequest({
        ...baseParams,
        excludeExpenseId: excludeId,
      });

      await GET(request, mockRouteContext);

      expect(mockPrisma.expenseItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expense: expect.objectContaining({
              id: { not: excludeId },
            }),
          }),
        })
      );
    });

    it('excludeExpenseId가 없으면 id 조건 없이 쿼리해야 함', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue([]);

      const request = createRequest(baseParams);

      await GET(request, mockRouteContext);

      const callArgs = mockPrisma.expenseItem.findMany.mock.calls[0][0];
      expect(callArgs.where.expense.id).toBeUndefined();
    });
  });

  describe('쿼리 조건 검증', () => {
    it('항/목/세목 3-튜플 모두를 where에 포함해야 함 (회귀 방지)', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue([]);

      const request = createRequest(baseParams);

      await GET(request, mockRouteContext);

      expect(mockPrisma.expenseItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            budgetCategory: '교육사역비',
            budgetSubcategory: '영유아사역비',
            budgetDetail: '행사비(선물)',
          }),
        })
      );
    });

    it('승인된 상태만 조회해야 함', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue([]);

      const request = createRequest(baseParams);

      await GET(request, mockRouteContext);

      expect(mockPrisma.expenseItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expense: expect.objectContaining({
              status: {
                in: ['APPROVED_STEP_1', 'APPROVED_STEP_2', 'APPROVED_FINAL'],
              },
            }),
          }),
        })
      );
    });

    it('해당 연도의 청구일 범위로 필터링해야 함', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue([]);

      const request = createRequest(baseParams);

      await GET(request, mockRouteContext);

      const callArgs = mockPrisma.expenseItem.findMany.mock.calls[0][0];
      const requestDateFilter = callArgs.where.expense.requestDate;

      expect(requestDateFilter.gte).toEqual(new Date(2026, 0, 1));
      expect(requestDateFilter.lt).toEqual(new Date(2027, 0, 1));
    });

    it('청구일 내림차순으로 정렬해야 함', async () => {
      mockPrisma.expenseItem.findMany.mockResolvedValue([]);

      const request = createRequest(baseParams);

      await GET(request, mockRouteContext);

      expect(mockPrisma.expenseItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            expense: {
              requestDate: 'desc',
            },
          },
        })
      );
    });
  });
});
