/**
 * GET /api/expenses/[id] API 테스트
 *
 * 테스트 대상:
 * - 지출결의서 상세 조회
 * - 계좌번호 열람 권한 (연도별 역할 기반)
 * - 계좌번호 마스킹 처리
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setMockUser, resetMockUser } from '@/test/setup';

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

// Mock utils
vi.mock('@/lib/utils', () => ({
  maskAccountNumber: vi.fn((accountNumber: string) => {
    if (!accountNumber || accountNumber.length < 4) return accountNumber;
    return accountNumber.slice(0, -4).replace(/./g, '*') + accountNumber.slice(-4);
  }),
}));

// Import after mocking
import { GET } from '../[id]/route';
import { prisma } from '@/lib/prisma';
import { getEffectiveRole } from '@/lib/services/user-service';

describe('GET /api/expenses/[id]', () => {
  const mockPrisma = prisma as any;
  const mockGetEffectiveRole = getEffectiveRole as ReturnType<typeof vi.fn>;

  const mockUser = {
    id: 'owner-1',
    tenantId: 'test-tenant-id',
    userid: 'testuser',
    username: '테스트유저',
    role: 'user',
    roleId: 'test-role-id',
    department: null,
    canApprove: false,
    canManageExpense: false,
    canAccessAdmin: false,
    canExportData: false,
    canRegisterUsers: false,
  };

  const mockExpense = {
    id: 'expense-1',
    userId: 'owner-1',
    tenantId: 'test-tenant-id',
    committee: '선교위원회',
    department: '청년부',
    requestAmount: 100000,
    applicantName: '홍길동',
    bankName: '국민은행',
    accountNumber: '123-456-789012',
    accountHolder: '홍길동',
    status: 'APPROVED_FINAL',
    paymentStatus: 'PENDING',
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
    attachments: [],
  };

  const createGetRequest = () => {
    return new NextRequest('http://localhost:3000/api/expenses/expense-1', {
      method: 'GET',
    });
  };

  const createParams = () => Promise.resolve({ id: 'expense-1' });

  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(mockUser);
    mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
  });

  afterEach(() => {
    resetMockUser();
  });

  describe('계좌번호 열람 권한 테스트 (연도별 역할 기반)', () => {
    it('작성자 본인은 계좌번호를 볼 수 있다', async () => {
      setMockUser({ ...mockUser, id: 'owner-1' });
      mockGetEffectiveRole.mockResolvedValue({ role: 'user', department: null });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      // 작성자 본인이므로 마스킹되지 않은 계좌번호
      expect(data.accountNumber).toBe('123-456-789012');
    });

    it('User.role이 user이지만 UserYearRole이 accountant면 계좌번호를 볼 수 있다', async () => {
      // 정혜종 시나리오: 작성자가 아니지만 회계 역할
      setMockUser({ ...mockUser, id: 'accountant-1', role: 'user' });
      mockGetEffectiveRole.mockResolvedValue({ role: 'accountant', department: '재정팀' });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      // accountant는 ACCOUNT_VIEW_ROLES에 포함되므로 마스킹되지 않음
      expect(data.accountNumber).toBe('123-456-789012');
      // getEffectiveRole이 호출되었는지 확인
      expect(mockGetEffectiveRole).toHaveBeenCalledWith('accountant-1', 2026);
    });

    it('User.role이 user이지만 UserYearRole이 finance_head면 계좌번호를 볼 수 있다', async () => {
      // 윤운문 시나리오: 작성자가 아니지만 재정팀장 역할
      setMockUser({ ...mockUser, id: 'finance-head-1', role: 'user' });
      mockGetEffectiveRole.mockResolvedValue({ role: 'finance_head', department: null });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      // finance_head는 ACCOUNT_VIEW_ROLES에 포함되므로 마스킹되지 않음
      expect(data.accountNumber).toBe('123-456-789012');
    });

    it('admin은 계좌번호를 볼 수 있다', async () => {
      setMockUser({ ...mockUser, id: 'admin-1', role: 'admin' });
      mockGetEffectiveRole.mockResolvedValue({ role: 'admin', department: null });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountNumber).toBe('123-456-789012');
    });

    it('admin_assistant는 계좌번호를 볼 수 있다', async () => {
      setMockUser({ ...mockUser, id: 'assistant-1', role: 'admin_assistant' });
      mockGetEffectiveRole.mockResolvedValue({ role: 'admin_assistant', department: null });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountNumber).toBe('123-456-789012');
    });

    it('작성자가 아닌 일반 사용자는 계좌번호가 마스킹된다', async () => {
      // 일반 사용자: 작성자도 아니고, 연도별 역할도 없음
      setMockUser({ ...mockUser, id: 'other-user-1', role: 'user' });
      mockGetEffectiveRole.mockResolvedValue({ role: 'user', department: '청년부' });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      // user는 ACCOUNT_VIEW_ROLES에 포함되지 않으므로 마스킹됨
      expect(data.accountNumber).not.toBe('123-456-789012');
      expect(data.accountNumber).toMatch(/\*+\d{4}$/); // 마지막 4자리만 보임
    });

    it('작성자가 아닌 team_leader는 계좌번호가 마스킹된다', async () => {
      // 팀장: 작성자도 아니고, ACCOUNT_VIEW_ROLES에도 없음
      setMockUser({ ...mockUser, id: 'leader-1', role: 'user' });
      mockGetEffectiveRole.mockResolvedValue({ role: 'team_leader', department: '청년부' });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      // team_leader는 ACCOUNT_VIEW_ROLES에 포함되지 않으므로 마스킹됨
      expect(data.accountNumber).not.toBe('123-456-789012');
    });

    it('로그인하지 않은 사용자는 401 에러를 반환한다', async () => {
      setMockUser(null);

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      // 인증이 필요한 API이므로 비로그인 시 401 반환
      expect(response.status).toBe(401);
      expect(data.error).toBe('로그인이 필요합니다.');
      // getEffectiveRole은 호출되지 않아야 함 (로그인하지 않았으므로)
      expect(mockGetEffectiveRole).not.toHaveBeenCalled();
    });
  });

  describe('지출결의서 조회 테스트', () => {
    it('존재하지 않는 지출결의서 조회 시 404 에러', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);
      setMockUser(mockUser);

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('지출결의서를 찾을 수 없습니다.');
    });

    it('지출결의서 상세 정보가 올바르게 반환된다', async () => {
      setMockUser({ ...mockUser, id: 'owner-1' });
      mockGetEffectiveRole.mockResolvedValue({ role: 'user', department: null });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('expense-1');
      expect(data.applicantName).toBe('홍길동');
      expect(data.items).toHaveLength(1);
    });
  });
});
