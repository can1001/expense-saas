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
    department: {
      findUnique: vi.fn(),
    },
  },
  Prisma: {},
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock user-service for getEffectiveRole
vi.mock('@/lib/services/user-service', () => ({
  getEffectiveRole: vi.fn(),
  CURRENT_YEAR: 2026,
}));

// Import after mocking
import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getEffectiveRole } from '@/lib/services/user-service';

describe('GET /api/expenses', () => {
  const mockPrisma = prisma as any;
  const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
  const mockGetEffectiveRole = getEffectiveRole as ReturnType<typeof vi.fn>;

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

    // Default: getEffectiveRole returns admin role
    mockGetEffectiveRole.mockResolvedValue({
      role: 'admin',
      departmentId: null,
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
      mockGetEffectiveRole.mockResolvedValue({
        role: 'admin',
        departmentId: null,
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
      mockGetEffectiveRole.mockResolvedValue({
        role: 'user',
        departmentId: null,
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
        role: 'user',  // User.role은 user
        department: '청년부',
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'team_leader',  // effectiveRole은 team_leader
        departmentId: 'dept-youth-id',
      });

      // Mock department lookup
      mockPrisma.department.findUnique.mockResolvedValue({
        id: 'dept-youth-id',
        name: '청년부',
        committeeId: 'committee-1',
        committee: {
          name: '교육위원회',
        },
      } as any);

      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      // where 조건에 department가 포함되어야 함
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { department: '교육위원회/청년부' },
        })
      );
    });
  });

  describe('연도별 역할(UserYearRole) 기반 필터링 테스트', () => {
    it('User.role이 user이지만 UserYearRole이 accountant면 전체 조회 가능', async () => {
      // 정혜종 시나리오: User.role = 'user', UserYearRole = 'accountant'
      mockGetCurrentUser.mockResolvedValue({
        id: 'accountant-1',
        userid: '청연정혜종',
        username: '정혜종',
        role: 'user',  // User.role은 user
        department: '재정팀',
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'accountant',  // effectiveRole은 accountant
        departmentId: 'dept-finance-id',
      });

      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      // getEffectiveRole이 호출되었는지 확인
      expect(mockGetEffectiveRole).toHaveBeenCalledWith('accountant-1', 2026);

      // accountant는 FULL_ACCESS_ROLES에 포함되므로 where 조건이 비어있어야 함
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it('User.role이 user이지만 UserYearRole이 finance_head면 전체 조회 가능', async () => {
      // 윤운문 시나리오: User.role = 'user', UserYearRole = 'finance_head' (2026년)
      mockGetCurrentUser.mockResolvedValue({
        id: 'fh-1',
        userid: '청연윤운문',
        username: '윤운문',
        role: 'user',  // User.role은 user
        department: null,
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'finance_head',  // effectiveRole은 finance_head
        departmentId: null,
      });

      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      // finance_head는 FULL_ACCESS_ROLES에 포함되므로 where 조건이 비어있어야 함
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it('User.role이 user이고 UserYearRole도 없으면 본인 작성만 조회', async () => {
      // 일반 사용자 시나리오: User.role = 'user', UserYearRole 없음
      mockGetCurrentUser.mockResolvedValue({
        id: 'normal-user-1',
        userid: '일반사용자',
        username: '김철수',
        role: 'user',
        department: '청년부',
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'user',  // effectiveRole도 user
        departmentId: null,
      });

      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      // user는 본인 작성��� 조회
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'normal-user-1' },
        })
      );
    });

    it('UserYearRole의 department를 사용하여 팀장 필터링', async () => {
      // 팀장 시나리오: User.department와 UserYearRole.departmentId가 다를 수 있음
      mockGetCurrentUser.mockResolvedValue({
        id: 'leader-2',
        userid: '팀장',
        username: '박팀장',
        role: 'user',
        department: '기획팀',  // User.department
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'team_leader',
        departmentId: 'dept-dev-id',  // UserYearRole.departmentId (다를 수 있음)
      });

      // Mock department lookup
      mockPrisma.department.findUnique.mockResolvedValue({
        id: 'dept-dev-id',
        name: '개발팀',
        committeeId: 'committee-1',
        committee: {
          name: '선교위원회',
        },
      } as any);

      mockPrisma.expense.findMany.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/expenses');
      await GET(request);

      // UserYearRole의 departmentId로 조회한 department 경로로 필터링되어야 함
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { department: '선교위원회/개발팀' },
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
