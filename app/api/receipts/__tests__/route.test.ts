/**
 * GET /api/receipts API 테스트
 *
 * 테스트 대상:
 * - RECEIPT_READ 권한 가드 (없는 역할 403)
 * - 기간(월)·부서·결재상태 필터 동작
 * - 응답 형식(썸네일 정보 + 결의서 메타)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setMockUser, resetMockUser, mockUserSession } from '@/test/setup';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    expenseAttachment: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  Prisma: {},
}));

import { GET } from '../route';
import { prisma } from '@/lib/prisma';

const mockRouteContext = { params: Promise.resolve({}) } as never;

describe('GET /api/receipts', () => {
  const mockPrisma = prisma as any;

  const mockAttachment = {
    id: 'attachment-1',
    url: 'https://res.cloudinary.com/demo/image/upload/v1/receipt.jpg',
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/receipt.jpg',
    fileName: 'receipt.jpg',
    format: 'jpg',
    expenseId: 'expense-1',
    expense: {
      department: '교육사역팀',
      committee: '교육위원회',
      requestAmount: 50000,
      status: 'APPROVED_FINAL',
      applicantName: '홍길동',
      requestDate: new Date('2026-07-05'),
    },
  };

  const createRequest = (params: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3000/api/receipts');
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser({ ...mockUserSession, role: 'accountant', roles: ['accountant'] });
    mockPrisma.expenseAttachment.findMany.mockResolvedValue([mockAttachment]);
    mockPrisma.expenseAttachment.count.mockResolvedValue(1);
  });

  afterEach(() => {
    resetMockUser();
  });

  it('RECEIPT_READ 권한이 없는 역할(user)은 403을 반환한다', async () => {
    setMockUser({ ...mockUserSession, role: 'user', roles: ['user'] });

    const response = await GET(createRequest(), mockRouteContext);

    expect(response.status).toBe(403);
    expect(mockPrisma.expenseAttachment.findMany).not.toHaveBeenCalled();
  });

  it('RECEIPT_READ 권한이 없는 역할(team_leader)은 403을 반환한다', async () => {
    setMockUser({ ...mockUserSession, role: 'team_leader', roles: ['team_leader'] });

    const response = await GET(createRequest(), mockRouteContext);

    expect(response.status).toBe(403);
  });

  it('accountant는 영수증 목록을 조회할 수 있다', async () => {
    const response = await GET(createRequest(), mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.receipts).toHaveLength(1);
    expect(data.receipts[0]).toMatchObject({
      id: 'attachment-1',
      secureUrl: mockAttachment.secureUrl,
      fileName: 'receipt.jpg',
      expenseId: 'expense-1',
      department: '교육사역팀',
      requestAmount: 50000,
      status: 'APPROVED_FINAL',
    });
    expect(data.pagination).toMatchObject({ page: 1, limit: 50, total: 1, totalPages: 1 });
  });

  it('finance_head는 영수증 목록을 조회할 수 있다', async () => {
    setMockUser({ ...mockUserSession, role: 'finance_head', roles: ['finance_head'] });

    const response = await GET(createRequest(), mockRouteContext);

    expect(response.status).toBe(200);
  });

  it('month 필터가 requestDate 범위 조건으로 변환된다', async () => {
    await GET(createRequest({ month: '2026-07' }), mockRouteContext);

    const where = mockPrisma.expenseAttachment.findMany.mock.calls[0][0].where;
    expect(where.expense.requestDate.gte).toEqual(new Date(2026, 6, 1));
    expect(where.expense.requestDate.lt).toEqual(new Date(2026, 7, 1));
  });

  it('department 필터가 적용된다', async () => {
    await GET(createRequest({ department: '교육사역팀' }), mockRouteContext);

    const where = mockPrisma.expenseAttachment.findMany.mock.calls[0][0].where;
    expect(where.expense.department).toBe('교육사역팀');
  });

  it('status 필터가 적용된다', async () => {
    await GET(createRequest({ status: 'APPROVED_FINAL' }), mockRouteContext);

    const where = mockPrisma.expenseAttachment.findMany.mock.calls[0][0].where;
    expect(where.expense.status).toBe('APPROVED_FINAL');
  });

  it('필터가 없으면 expense where 절이 비어있다', async () => {
    await GET(createRequest(), mockRouteContext);

    const where = mockPrisma.expenseAttachment.findMany.mock.calls[0][0].where;
    expect(where.expense).toEqual({});
  });
});
