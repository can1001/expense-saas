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
import { getSessionUserId } from '@/lib/auth';
import { getEffectiveRole } from '@/lib/services/user-service';

describe('GET /api/expenses/[id]', () => {
  const mockPrisma = prisma as any;
  const mockGetSessionUserId = getSessionUserId as ReturnType<typeof vi.fn>;
  const mockGetEffectiveRole = getEffectiveRole as ReturnType<typeof vi.fn>;

  const mockExpense = {
    id: 'expense-1',
    userId: 'owner-1',
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
    mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('계좌번호 열람 권한 테스트 (연도별 역할 기반)', () => {
    it('작성자 본인은 계좌번호를 볼 수 있다', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-1');
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
      mockGetSessionUserId.mockResolvedValue('accountant-1');
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
      mockGetSessionUserId.mockResolvedValue('finance-head-1');
      mockGetEffectiveRole.mockResolvedValue({ role: 'finance_head', department: null });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      // finance_head는 ACCOUNT_VIEW_ROLES에 포함되므로 마스킹되지 않음
      expect(data.accountNumber).toBe('123-456-789012');
    });

    it('admin은 계좌번호를 볼 수 있다', async () => {
      mockGetSessionUserId.mockResolvedValue('admin-1');
      mockGetEffectiveRole.mockResolvedValue({ role: 'admin', department: null });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountNumber).toBe('123-456-789012');
    });

    it('admin_assistant는 계좌번호를 볼 수 있다', async () => {
      mockGetSessionUserId.mockResolvedValue('assistant-1');
      mockGetEffectiveRole.mockResolvedValue({ role: 'admin_assistant', department: null });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accountNumber).toBe('123-456-789012');
    });

    it('작성자가 아닌 일반 사용자는 계좌번호가 마스킹된다', async () => {
      // 일반 사용자: 작성자도 아니고, 연도별 역할도 없음
      mockGetSessionUserId.mockResolvedValue('other-user-1');
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
      mockGetSessionUserId.mockResolvedValue('leader-1');
      mockGetEffectiveRole.mockResolvedValue({ role: 'team_leader', department: '청년부' });

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      // team_leader는 ACCOUNT_VIEW_ROLES에 포함되지 않으므로 마스킹됨
      expect(data.accountNumber).not.toBe('123-456-789012');
    });

    it('로그인하지 않은 사용자는 계좌번호가 마스킹된다', async () => {
      mockGetSessionUserId.mockResolvedValue(null);

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      // 로그인하지 않았으므로 마스킹됨
      expect(data.accountNumber).not.toBe('123-456-789012');
      // getEffectiveRole은 호출되지 않아야 함 (로그인하지 않았으므로)
      expect(mockGetEffectiveRole).not.toHaveBeenCalled();
    });
  });

  describe('지출결의서 조회 테스트', () => {
    it('존재하지 않는 지출결의서 조회 시 404 에러', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);
      mockGetSessionUserId.mockResolvedValue('user-1');

      const request = createGetRequest();
      const response = await GET(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('지출결의서를 찾을 수 없습니다.');
    });

    it('지출결의서 상세 정보가 올바르게 반환된다', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-1');
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
