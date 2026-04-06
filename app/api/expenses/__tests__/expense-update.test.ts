/**
 * PUT /api/expenses/[id] API 테스트
 *
 * 테스트 대상:
 * - 기본 수정 기능 (DRAFT, REJECTED, WITHDRAWN 상태)
 * - 최종승인 상태 수정 권한 제한
 * - 감사 로그 기록
 * - 상태 유지 확인
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    expenseItem: {
      deleteMany: vi.fn(),
    },
    approvalLog: {
      create: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  getSessionUserId: vi.fn(),
}));

// Mock user-service for getEffectiveRole
vi.mock('@/lib/services/user-service', () => ({
  getEffectiveRole: vi.fn(),
  CURRENT_YEAR: 2026,
}));

// Mock validators
vi.mock('@/lib/validators', () => ({
  updateExpenseSchema: {
    parse: vi.fn((data) => data),
  },
  calculateAmount: vi.fn((unitPrice, quantity) => Math.floor((unitPrice * quantity) / 10) * 10),
  calculateTotal: vi.fn((items) => items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0)),
}));

// Mock domain
vi.mock('@/lib/domain/request-team', () => ({
  deriveRequestTeam: vi.fn(() => '선교위원회 청년부'),
}));

// Import after mocking
import { PUT } from '../[id]/route';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getEffectiveRole } from '@/lib/services/user-service';

describe('PUT /api/expenses/[id]', () => {
  const mockPrisma = prisma as any;
  const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
  const mockGetEffectiveRole = getEffectiveRole as ReturnType<typeof vi.fn>;

  const createMockExpense = (overrides = {}) => ({
    id: 'test-expense-id',
    status: 'DRAFT',
    paymentStatus: 'PENDING',
    committee: '선교위원회',
    department: '청년부',
    applicantName: '홍길동',
    requestTeam: '선교위원회 청년부',
    requestAmount: 100000,
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
    ...overrides,
  });

  const createMockUser = (role: string) => ({
    id: `${role}-user-id`,
    userid: role,
    username: `${role} 사용자`,
    role,
    department: '재정팀',
  });

  const createPutRequest = (body: object) => {
    return new NextRequest('http://localhost:3000/api/expenses/test-expense-id', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  };

  const createParams = () => Promise.resolve({ id: 'test-expense-id' });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.expenseItem.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.approvalLog.create.mockResolvedValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('기본 수정 성공 케이스', () => {
    it('DRAFT 상태에서 수정 성공', async () => {
      const mockExpense = createMockExpense({ status: 'DRAFT' });
      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.expense.update.mockResolvedValue({
        ...mockExpense,
        committee: '기획위원회',
      });

      const request = createPutRequest({
        committee: '기획위원회',
        department: '청년부',
        items: mockExpense.items,
      });

      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.committee).toBe('기획위원회');
    });

    it('REJECTED 상태에서 수정 성공', async () => {
      const mockExpense = createMockExpense({ status: 'REJECTED' });
      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.expense.update.mockResolvedValue(mockExpense);

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: mockExpense.items,
      });

      const response = await PUT(request, { params: createParams() });

      expect(response.status).toBe(200);
    });

    it('WITHDRAWN 상태에서 수정 성공', async () => {
      const mockExpense = createMockExpense({ status: 'WITHDRAWN' });
      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.expense.update.mockResolvedValue(mockExpense);

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: mockExpense.items,
      });

      const response = await PUT(request, { params: createParams() });

      expect(response.status).toBe(200);
    });
  });

  describe('최종승인 상태 수정 권한 테스트', () => {
    const approvedPendingExpense = createMockExpense({
      status: 'APPROVED_FINAL',
      paymentStatus: 'PENDING',
    });

    it('APPROVED_FINAL + PENDING 상태에서 admin 역할 수정 성공', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(approvedPendingExpense);
      mockPrisma.expense.update.mockResolvedValue(approvedPendingExpense);
      mockGetCurrentUser.mockResolvedValue(createMockUser('admin'));
      mockGetEffectiveRole.mockResolvedValue({ role: 'admin', department: null });

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: approvedPendingExpense.items,
      });

      const response = await PUT(request, { params: createParams() });

      expect(response.status).toBe(200);
    });

    it('APPROVED_FINAL + PENDING 상태에서 finance_head 역할 수정 성공', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(approvedPendingExpense);
      mockPrisma.expense.update.mockResolvedValue(approvedPendingExpense);
      mockGetCurrentUser.mockResolvedValue(createMockUser('finance_head'));
      mockGetEffectiveRole.mockResolvedValue({ role: 'finance_head', department: null });

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: approvedPendingExpense.items,
      });

      const response = await PUT(request, { params: createParams() });

      expect(response.status).toBe(200);
    });

    it('APPROVED_FINAL + PENDING 상태에서 accountant 역할 수정 성공', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(approvedPendingExpense);
      mockPrisma.expense.update.mockResolvedValue(approvedPendingExpense);
      mockGetCurrentUser.mockResolvedValue(createMockUser('accountant'));
      mockGetEffectiveRole.mockResolvedValue({ role: 'accountant', department: '재정팀' });

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: approvedPendingExpense.items,
      });

      const response = await PUT(request, { params: createParams() });

      expect(response.status).toBe(200);
    });

    it('APPROVED_FINAL + PENDING 상태에서 admin_assistant 역할 수정 성공', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(approvedPendingExpense);
      mockPrisma.expense.update.mockResolvedValue(approvedPendingExpense);
      mockGetCurrentUser.mockResolvedValue(createMockUser('admin_assistant'));
      mockGetEffectiveRole.mockResolvedValue({ role: 'admin_assistant', department: null });

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: approvedPendingExpense.items,
      });

      const response = await PUT(request, { params: createParams() });

      expect(response.status).toBe(200);
    });

    it('APPROVED_FINAL + PENDING 상태에서 user 역할 수정 거부 (403)', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(approvedPendingExpense);
      mockGetCurrentUser.mockResolvedValue(createMockUser('user'));
      mockGetEffectiveRole.mockResolvedValue({ role: 'user', department: '청년부' });

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: approvedPendingExpense.items,
      });

      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('이 상태에서는 수정할 수 없습니다.');
    });

    it('APPROVED_FINAL + PENDING 상태에서 team_leader 역할 수정 거부 (403)', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(approvedPendingExpense);
      mockGetCurrentUser.mockResolvedValue(createMockUser('team_leader'));
      mockGetEffectiveRole.mockResolvedValue({ role: 'team_leader', department: '청년부' });

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: approvedPendingExpense.items,
      });

      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('이 상태에서는 수정할 수 없습니다.');
    });

    it('APPROVED_FINAL + PENDING 상태에서 로그인하지 않은 사용자 수정 거부 (403)', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(approvedPendingExpense);
      mockGetCurrentUser.mockResolvedValue(null);

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: approvedPendingExpense.items,
      });

      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('이 상태에서는 수정할 수 없습니다.');
    });
  });

  describe('수정 불가 상태 테스트', () => {
    it('PENDING 상태에서 수정 거부 (403)', async () => {
      const mockExpense = createMockExpense({ status: 'PENDING' });
      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: mockExpense.items,
      });

      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('이 상태에서는 수정할 수 없습니다.');
    });

    it('APPROVED_STEP_1 상태에서 수정 거부 (403)', async () => {
      const mockExpense = createMockExpense({ status: 'APPROVED_STEP_1' });
      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: mockExpense.items,
      });

      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('이 상태에서는 수정할 수 없습니다.');
    });

    it('APPROVED_FINAL + COMPLETED 상태에서 수정 거부 (403)', async () => {
      const mockExpense = createMockExpense({
        status: 'APPROVED_FINAL',
        paymentStatus: 'COMPLETED',
      });
      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: mockExpense.items,
      });

      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('이 상태에서는 수정할 수 없습니다.');
    });

    it('APPROVED_FINAL + HOLD 상태에서 수정 거부 (403)', async () => {
      const mockExpense = createMockExpense({
        status: 'APPROVED_FINAL',
        paymentStatus: 'HOLD',
      });
      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: mockExpense.items,
      });

      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('이 상태에서는 수정할 수 없습니다.');
    });
  });

  describe('감사 로그 테스트', () => {
    it('최종승인 상태 수정 시 MODIFY_CONTENT 감사 로그 생성', async () => {
      const approvedPendingExpense = createMockExpense({
        status: 'APPROVED_FINAL',
        paymentStatus: 'PENDING',
      });
      mockPrisma.expense.findUnique.mockResolvedValue(approvedPendingExpense);
      mockPrisma.expense.update.mockResolvedValue(approvedPendingExpense);
      mockGetCurrentUser.mockResolvedValue(createMockUser('admin'));
      mockGetEffectiveRole.mockResolvedValue({ role: 'admin', department: null });

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: approvedPendingExpense.items,
      });

      await PUT(request, { params: createParams() });

      expect(mockPrisma.approvalLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expenseId: 'test-expense-id',
          action: 'MODIFY_CONTENT',
          previousStatus: 'APPROVED_FINAL',
          newStatus: 'APPROVED_FINAL',
          comment: '최종승인 후 내용 수정',
        }),
      });
    });

    it('DRAFT 상태 수정 시 감사 로그 생성하지 않음', async () => {
      const mockExpense = createMockExpense({ status: 'DRAFT' });
      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.expense.update.mockResolvedValue(mockExpense);

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        items: mockExpense.items,
      });

      await PUT(request, { params: createParams() });

      expect(mockPrisma.approvalLog.create).not.toHaveBeenCalled();
    });
  });

  describe('상태 유지 테스트', () => {
    it('최종승인 상태에서 수정 시 status가 변경되지 않음', async () => {
      const approvedPendingExpense = createMockExpense({
        status: 'APPROVED_FINAL',
        paymentStatus: 'PENDING',
      });
      mockPrisma.expense.findUnique.mockResolvedValue(approvedPendingExpense);
      mockPrisma.expense.update.mockResolvedValue(approvedPendingExpense);
      mockGetCurrentUser.mockResolvedValue(createMockUser('admin'));
      mockGetEffectiveRole.mockResolvedValue({ role: 'admin', department: null });

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        status: 'DRAFT', // 클라이언트에서 DRAFT로 보내도
        items: approvedPendingExpense.items,
      });

      await PUT(request, { params: createParams() });

      // update 호출 시 status가 포함되지 않아야 함
      expect(mockPrisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            status: 'DRAFT',
          }),
        })
      );
    });

    it('DRAFT 상태에서 수정 시 status 변경 가능', async () => {
      const mockExpense = createMockExpense({ status: 'DRAFT' });
      mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
      mockPrisma.expense.update.mockResolvedValue({ ...mockExpense, status: 'PENDING' });

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
        status: 'PENDING',
        items: mockExpense.items,
      });

      await PUT(request, { params: createParams() });

      expect(mockPrisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });
  });

  describe('404 에러 테스트', () => {
    it('존재하지 않는 지출결의서 수정 시 404 에러', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      const request = createPutRequest({
        committee: '선교위원회',
        department: '청년부',
      });

      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('지출결의서를 찾을 수 없습니다.');
    });
  });
});
