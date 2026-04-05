/**
 * GET /api/expenses API 테스트
 *
 * 테스트 대상:
 * - 지출결의서 목록 조회
 * - 첨부파일 정보 포함 확인
 * - 역할 기반 필터링
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  Prisma: {},
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

// Import after mocking
import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

describe('GET /api/expenses', () => {
  const mockPrisma = prisma as any;
  const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

  const mockExpenseWithAttachments = {
    id: 'expense-1',
    userId: 'user-1',
    committee: '선교위원회',
    department: '청년부',
    requestAmount: 100000,
    applicantName: '홍길동',
    requestDate: new Date('2026-04-05'),
    createdAt: new Date('2026-04-05'),
    status: 'APPROVED_FINAL',
    paymentStatus: 'PENDING',
    approvedAt: new Date('2026-04-05'),
    items: [
      {
        id: 'item-1',
        budgetCategory: '선교비',
        budgetSubcategory: '국내선교비',
        budgetDetail: '교통비',
        description: '출장 교통비',
        unitPrice: 100000,
        quantity: 1,
        amount: 100000,
        order: 1,
      },
    ],
    attachments: [
      {
        id: 'attachment-1',
        secureUrl: 'https://example.com/image1.jpg',
        format: 'jpg',
      },
    ],
  };

  const mockExpenseWithoutAttachments = {
    ...mockExpenseWithAttachments,
    id: 'expense-2',
    attachments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: admin user with full access
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      userid: 'admin',
      username: '관리자',
      role: 'admin',
      department: null,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('첨부파일 포함 테스트', () => {
    it('목록 조회 시 첨부파일 정보가 포함된다', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([mockExpenseWithAttachments]);
      mockPrisma.expense.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.expenses).toHaveLength(1);
      expect(data.expenses[0].attachments).toBeDefined();
      expect(data.expenses[0].attachments).toHaveLength(1);
      expect(data.expenses[0].attachments[0]).toEqual({
        id: 'attachment-1',
        secureUrl: 'https://example.com/image1.jpg',
        format: 'jpg',
      });
    });

    it('첨부파일이 없는 경우 빈 배열로 반환된다', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([mockExpenseWithoutAttachments]);
      mockPrisma.expense.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.expenses[0].attachments).toBeDefined();
      expect(data.expenses[0].attachments).toHaveLength(0);
    });

    it('첨부파일이 여러 개여도 첫 번째만 반환된다 (take: 1)', async () => {
      // Prisma include에서 take: 1 옵션으로 첫 번째만 가져옴
      // 이 테스트는 Prisma mock이 올바른 쿼리를 받는지 확인
      mockPrisma.expense.findMany.mockResolvedValue([mockExpenseWithAttachments]);
      mockPrisma.expense.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      // findMany 호출 시 attachments include 옵션 확인
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            attachments: expect.objectContaining({
              take: 1,
              select: {
                id: true,
                secureUrl: true,
                format: true,
              },
            }),
          }),
        })
      );
    });
  });

  describe('인증 테스트', () => {
    it('로그인하지 않은 경우 401 에러 반환', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('로그인이 필요합니다.');
    });
  });

  describe('역할 기반 필터링 테스트', () => {
    it('admin 역할은 전체 조회 가능', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'admin-1',
        userid: 'admin',
        username: '관리자',
        role: 'admin',
        department: null,
      });

      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      // where 조건이 비어있어야 함 (전체 조회)
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it('일반 사용자는 본인 작성 지출결의서만 조회', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-1',
        userid: 'user',
        username: '일반사용자',
        role: 'user',
        department: '청년부',
      });

      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      // where 조건에 userId가 포함되어야 함
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        })
      );
    });

    it('팀장은 본인 부서 지출결의서만 조회', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'leader-1',
        userid: 'leader',
        username: '팀장',
        role: 'team_leader',
        department: '청년부',
      });

      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      // where 조건에 department가 포함되어야 함
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { department: '청년부' },
        })
      );
    });
  });

  describe('페이지네이션 테스트', () => {
    it('페이지와 limit 파라미터가 적용된다', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(100);

      const request = new NextRequest('http://localhost:3000/api/expenses?page=2&limit=20');
      const response = await GET(request);
      const data = await response.json();

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (2-1) * 20
          take: 20,
        })
      );

      expect(data.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 100,
        totalPages: 5,
      });
    });
  });
});
