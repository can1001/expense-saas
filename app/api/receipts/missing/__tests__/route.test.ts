/**
 * GET /api/receipts/missing API 테스트
 *
 * 테스트 대상:
 * - RECEIPT_READ 권한 가드 (없는 역할 403)
 * - 첨부파일 0건 결의서만 반환
 * - 예외 세목만인 결의서는 결과에서 제외
 * - 기간(월)·부서 필터 동작
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setMockUser, resetMockUser, mockUserSession } from '@/test/setup';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findMany: vi.fn(),
    },
  },
  Prisma: {},
}));

import { GET } from '../route';
import { prisma } from '@/lib/prisma';

const mockRouteContext = { params: Promise.resolve({}) } as never;

describe('GET /api/receipts/missing', () => {
  const mockPrisma = prisma as any;

  const normalExpense = {
    id: 'expense-normal',
    applicantName: '홍길동',
    department: '교육사역팀',
    committee: '교육위원회',
    requestAmount: 30000,
    status: 'APPROVED_FINAL',
    requestDate: new Date('2026-07-05'),
    items: [{ budgetDetail: '도서구입비' }],
  };

  const exemptExpense = {
    id: 'expense-exempt',
    applicantName: '김철수',
    department: '사무팀',
    committee: '운영위원회',
    requestAmount: 15000,
    status: 'APPROVED_FINAL',
    requestDate: new Date('2026-07-10'),
    items: [{ budgetDetail: '교역자식대' }],
  };

  const createRequest = (params: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3000/api/receipts/missing');
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser({ ...mockUserSession, role: 'accountant', roles: ['accountant'] });
    mockPrisma.expense.findMany.mockResolvedValue([normalExpense, exemptExpense]);
  });

  afterEach(() => {
    resetMockUser();
  });

  it('RECEIPT_READ 권한이 없는 역할(user)은 403을 반환한다', async () => {
    setMockUser({ ...mockUserSession, role: 'user', roles: ['user'] });

    const response = await GET(createRequest(), mockRouteContext);

    expect(response.status).toBe(403);
    expect(mockPrisma.expense.findMany).not.toHaveBeenCalled();
  });

  it('RECEIPT_READ 권한이 없는 역할(team_leader)은 403을 반환한다', async () => {
    setMockUser({ ...mockUserSession, role: 'team_leader', roles: ['team_leader'] });

    const response = await GET(createRequest(), mockRouteContext);

    expect(response.status).toBe(403);
  });

  it('finance_head는 미첨부 결의서 목록을 조회할 수 있다', async () => {
    setMockUser({ ...mockUserSession, role: 'finance_head', roles: ['finance_head'] });

    const response = await GET(createRequest(), mockRouteContext);

    expect(response.status).toBe(200);
  });

  it('예외 세목만인 결의서는 결과에서 제외된다', async () => {
    const response = await GET(createRequest(), mockRouteContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.expenses).toHaveLength(1);
    expect(data.expenses[0]).toMatchObject({
      expenseId: 'expense-normal',
      applicantName: '홍길동',
      department: '교육사역팀',
      requestAmount: 30000,
      status: 'APPROVED_FINAL',
    });
    expect(data.pagination).toMatchObject({ page: 1, limit: 50, total: 1, totalPages: 1 });
  });

  it('첨부파일 0건 조건이 쿼리에 포함된다', async () => {
    await GET(createRequest(), mockRouteContext);

    const where = mockPrisma.expense.findMany.mock.calls[0][0].where;
    expect(where.attachments).toEqual({ none: {} });
  });

  it('month 필터가 requestDate 범위 조건으로 변환된다', async () => {
    await GET(createRequest({ month: '2026-07' }), mockRouteContext);

    const where = mockPrisma.expense.findMany.mock.calls[0][0].where;
    expect(where.requestDate.gte).toEqual(new Date(2026, 6, 1));
    expect(where.requestDate.lt).toEqual(new Date(2026, 7, 1));
  });

  it('department 필터가 적용된다', async () => {
    await GET(createRequest({ department: '교육사역팀' }), mockRouteContext);

    const where = mockPrisma.expense.findMany.mock.calls[0][0].where;
    expect(where.department).toBe('교육사역팀');
  });
});
