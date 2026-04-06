/**
 * PUT /api/expenses/[id]/payment-status API 테스트
 *
 * 테스트 대상:
 * - 지급상태 변경 권한 (연도별 역할 기반)
 * - 상태 전이 검증
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
    userSignature: {
      findUnique: vi.fn(),
    },
    approvalLog: {
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
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

// Mock notification service
vi.mock('@/lib/services/notification', () => ({
  notificationService: {
    notifyOnPaymentComplete: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocking
import { PUT, GET } from '../[id]/payment-status/route';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getEffectiveRole } from '@/lib/services/user-service';

describe('PUT /api/expenses/[id]/payment-status', () => {
  const mockPrisma = prisma as any;
  const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
  const mockGetEffectiveRole = getEffectiveRole as ReturnType<typeof vi.fn>;

  const mockExpense = {
    id: 'expense-1',
    userId: 'owner-1',
    status: 'APPROVED_FINAL',
    paymentStatus: 'PENDING',
    applicantName: '홍길동',
    requestAmount: 100000,
    bankName: '국민은행',
    accountNumber: '123-456-789012',
  };

  const createPutRequest = (body: object) => {
    return new NextRequest('http://localhost:3000/api/expenses/expense-1/payment-status', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  };

  const createParams = () => Promise.resolve({ id: 'expense-1' });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
    mockPrisma.expense.update.mockResolvedValue({
      ...mockExpense,
      paymentStatus: 'COMPLETED',
      paymentCompletedAt: new Date(),
      paymentCompletedBy: '정혜종',
    });
    mockPrisma.approvalLog.create.mockResolvedValue({});
    mockPrisma.user.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('지급상태 변경 권한 테스트 (연도별 역할 기반)', () => {
    it('admin은 지급상태를 변경할 수 있다', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'admin-1',
        userid: 'admin',
        username: '관리자',
        role: 'admin',
      });
      mockGetEffectiveRole.mockResolvedValue({ role: 'admin', department: null });

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('User.role이 user이지만 UserYearRole이 accountant면 지급상태를 변경할 수 있다', async () => {
      // 정혜종 시나리오: User.role = 'user', UserYearRole = 'accountant'
      mockGetCurrentUser.mockResolvedValue({
        id: 'accountant-1',
        userid: '청연정혜종',
        username: '정혜종',
        role: 'user',  // User.role은 user
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'accountant',  // effectiveRole은 accountant
        department: '재정팀',
      });

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // getEffectiveRole이 호출되었는지 확인
      expect(mockGetEffectiveRole).toHaveBeenCalledWith('accountant-1', 2026);
    });

    it('User.role이 user이지만 UserYearRole이 finance_head면 지급상태를 변경할 수 있다', async () => {
      // 윤운문 시나리오: User.role = 'user', UserYearRole = 'finance_head'
      mockGetCurrentUser.mockResolvedValue({
        id: 'finance-head-1',
        userid: '청연윤운문',
        username: '윤운문',
        role: 'user',  // User.role은 user
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'finance_head',  // effectiveRole은 finance_head
        department: null,
      });

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('admin_assistant는 지급상태를 변경할 수 있다', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'assistant-1',
        userid: 'assistant',
        username: '행정보조',
        role: 'admin_assistant',
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'admin_assistant',
        department: null,
      });

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('일반 사용자(user)는 지급상태를 변경할 수 없다 - 403 에러', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-1',
        userid: 'normaluser',
        username: '일반사용자',
        role: 'user',
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'user',  // effectiveRole도 user
        department: '청년부',
      });

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('지출 상태 변경 권한이 없습니다.');
    });

    it('팀장(team_leader)은 지급상태를 변경할 수 없다 - 403 에러', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'leader-1',
        userid: 'teamleader',
        username: '팀장',
        role: 'user',
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'team_leader',  // 팀장은 지급상태 변경 권한 없음
        department: '청년부',
      });

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('지출 상태 변경 권한이 없습니다.');
    });

    it('로그인하지 않은 사용자는 401 에러', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('로그인이 필요합니다.');
    });
  });

  describe('상태 전이 검증 테스트', () => {
    beforeEach(() => {
      // 권한이 있는 사용자로 설정
      mockGetCurrentUser.mockResolvedValue({
        id: 'accountant-1',
        username: '정혜종',
        role: 'user',
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'accountant',
        department: '재정팀',
      });
    });

    it('최종 승인되지 않은 지출결의서는 상태 변경 불가 - 400 에러', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        ...mockExpense,
        status: 'PENDING',  // 최종 승인되지 않음
      });

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('최종 승인된 지출결의서만 지출 상태를 변경할 수 있습니다.');
    });

    it('이미 같은 상태인 경우 - 400 에러', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        ...mockExpense,
        paymentStatus: 'COMPLETED',  // 이미 완료 상태
      });

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('이미 지급 완료 상태입니다.');
    });

    it('HOLD 상태 변경 시 사유 필수 - 400 에러', async () => {
      const request = createPutRequest({ paymentStatus: 'HOLD' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('보류 사유를 입력해주세요.');
    });

    it('CANCELLED 상태 변경 시 사유 필수 - 400 에러', async () => {
      const request = createPutRequest({ paymentStatus: 'CANCELLED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('취소 사유를 입력해주세요.');
    });

    it('존재하지 않는 지출결의서 - 404 에러', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      const request = createPutRequest({ paymentStatus: 'COMPLETED' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('지출결의서를 찾을 수 없습니다.');
    });

    it('유효하지 않은 상태값 - 400 에러', async () => {
      const request = createPutRequest({ paymentStatus: 'INVALID' });
      const response = await PUT(request, { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('유효하지 않은 상태값입니다. (PENDING, HOLD, CANCELLED, COMPLETED)');
    });
  });

  describe('지급완료 처리 테스트', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'accountant-1',
        username: '정혜종',
        role: 'user',
      });
      mockGetEffectiveRole.mockResolvedValue({
        role: 'accountant',
        department: '재정팀',
      });
    });

    it('지급완료 시 expenseDate가 설정된다', async () => {
      const request = createPutRequest({
        paymentStatus: 'COMPLETED',
        expenseDate: '2026-04-06',
      });
      const response = await PUT(request, { params: createParams() });

      expect(response.status).toBe(200);
      expect(mockPrisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentStatus: 'COMPLETED',
            expenseDate: expect.any(Date),
          }),
        })
      );
    });

    it('지급완료 시 서명 데이터가 저장된다', async () => {
      const request = createPutRequest({
        paymentStatus: 'COMPLETED',
        signature: {
          type: 'signature',
          data: 'base64-signature-data',
        },
      });
      const response = await PUT(request, { params: createParams() });

      expect(response.status).toBe(200);
      expect(mockPrisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentSignatureType: 'signature',
            paymentSignatureData: 'base64-signature-data',
          }),
        })
      );
    });

    it('저장된 서명 ID로 서명 조회 후 저장', async () => {
      mockPrisma.userSignature.findUnique.mockResolvedValue({
        id: 'sig-1',
        type: 'stamp',
        imageData: 'saved-stamp-data',
      });

      const request = createPutRequest({
        paymentStatus: 'COMPLETED',
        signature: {
          signatureId: 'sig-1',
        },
      });
      const response = await PUT(request, { params: createParams() });

      expect(response.status).toBe(200);
      expect(mockPrisma.userSignature.findUnique).toHaveBeenCalledWith({
        where: { id: 'sig-1' },
      });
      expect(mockPrisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentSignatureType: 'stamp',
            paymentSignatureData: 'saved-stamp-data',
          }),
        })
      );
    });
  });
});

describe('GET /api/expenses/[id]/payment-status', () => {
  const mockPrisma = prisma as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('지급상태 조회 성공', async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({
      id: 'expense-1',
      status: 'APPROVED_FINAL',
      paymentStatus: 'PENDING',
      paymentCompletedAt: null,
      paymentCompletedBy: null,
      paymentNote: null,
    });

    const request = new NextRequest('http://localhost:3000/api/expenses/expense-1/payment-status');
    const response = await GET(request, { params: Promise.resolve({ id: 'expense-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paymentStatus).toBe('PENDING');
  });

  it('존재하지 않는 지출결의서 - 404 에러', async () => {
    mockPrisma.expense.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/expenses/expense-1/payment-status');
    const response = await GET(request, { params: Promise.resolve({ id: 'expense-1' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('지출결의서를 찾을 수 없습니다.');
  });
});
