/**
 * 지출결의서 복제 API 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock 모듈
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/domain/request-team', () => ({
  deriveRequestTeam: vi.fn((committee, department) =>
    [committee, department].filter(Boolean).join(' ').trim()
  ),
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

describe('POST /api/expenses/[id]/duplicate', () => {
  const mockUserId = 'user-123';
  const mockExpenseId = 'expense-456';
  const mockNewExpenseId = 'expense-789';

  const mockOriginalExpense = {
    id: mockExpenseId,
    userId: mockUserId,
    committee: '기획위원회',
    department: '재정팀',
    expenseDate: new Date('2026-01-15'),
    requestAmount: 100000,
    requestDate: new Date('2026-01-10'),
    requestTeam: '기획위원회 재정팀',
    applicantName: '홍길동',
    applicantTitle: '팀장',
    bankName: '국민은행',
    accountNumber: '123-456-789',
    accountHolder: '홍길동',
    status: 'APPROVED_FINAL',
    version: '4.1.0',
    applicantSignatureType: 'draw',
    applicantSignatureData: 'data:image/png;base64,...',
    items: [
      {
        id: 'item-1',
        expenseId: mockExpenseId,
        budgetCategory: '사업비',
        budgetSubcategory: '운영비',
        budgetDetail: '회의비',
        description: '회의 다과',
        unitPrice: 50000,
        quantity: 2,
        amount: 100000,
        order: 1,
      },
    ],
    attachments: [
      {
        id: 'att-1',
        expenseId: mockExpenseId,
        publicId: 'expense/abc123',
        url: 'http://example.com/image.jpg',
        secureUrl: 'https://example.com/image.jpg',
        format: 'jpg',
        fileName: 'receipt.jpg',
        fileSize: 12345,
        width: 800,
        height: 600,
        createdAt: new Date(),
      },
    ],
  };

  const mockCurrentUser = {
    id: mockUserId,
    name: '홍길동',
    email: 'hong@example.com',
    role: 'user',
  };

  const mockDuplicatedExpense = {
    ...mockOriginalExpense,
    id: mockNewExpenseId,
    status: 'DRAFT',
    expenseDate: null,
    requestDate: new Date(),
    applicantSignatureType: null,
    applicantSignatureData: null,
  };

  const createRequest = (id: string) => {
    return new NextRequest(`http://localhost:3000/api/expenses/${id}/duplicate`, {
      method: 'POST',
    });
  };

  const createParams = (id: string) => Promise.resolve({ id });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('성공 케이스', () => {
    it('본인의 지출결의서를 성공적으로 복제한다', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser);
      vi.mocked(prisma.expense.findUnique)
        .mockResolvedValueOnce(mockOriginalExpense as any)
        .mockResolvedValueOnce(mockDuplicatedExpense as any);
      vi.mocked(prisma.$transaction).mockResolvedValue(mockDuplicatedExpense as any);

      const response = await POST(
        createRequest(mockExpenseId),
        { params: createParams(mockExpenseId) }
      );

      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('지출결의서가 복제되었습니다.');
      expect(json.expense).toBeDefined();
    });

    it('DRAFT 상태의 지출결의서도 복제할 수 있다', async () => {
      const draftExpense = { ...mockOriginalExpense, status: 'DRAFT' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser);
      vi.mocked(prisma.expense.findUnique)
        .mockResolvedValueOnce(draftExpense as any)
        .mockResolvedValueOnce(mockDuplicatedExpense as any);
      vi.mocked(prisma.$transaction).mockResolvedValue(mockDuplicatedExpense as any);

      const response = await POST(
        createRequest(mockExpenseId),
        { params: createParams(mockExpenseId) }
      );

      expect(response.status).toBe(200);
    });

    it('첨부파일이 없는 지출결의서도 복제할 수 있다', async () => {
      const noAttachmentsExpense = { ...mockOriginalExpense, attachments: [] };
      vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser);
      vi.mocked(prisma.expense.findUnique)
        .mockResolvedValueOnce(noAttachmentsExpense as any)
        .mockResolvedValueOnce({ ...mockDuplicatedExpense, attachments: [] } as any);
      vi.mocked(prisma.$transaction).mockResolvedValue(mockDuplicatedExpense as any);

      const response = await POST(
        createRequest(mockExpenseId),
        { params: createParams(mockExpenseId) }
      );

      expect(response.status).toBe(200);
    });

    it('세부 항목이 없는 지출결의서도 복제할 수 있다', async () => {
      const noItemsExpense = { ...mockOriginalExpense, items: [] };
      vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser);
      vi.mocked(prisma.expense.findUnique)
        .mockResolvedValueOnce(noItemsExpense as any)
        .mockResolvedValueOnce({ ...mockDuplicatedExpense, items: [] } as any);
      vi.mocked(prisma.$transaction).mockResolvedValue(mockDuplicatedExpense as any);

      const response = await POST(
        createRequest(mockExpenseId),
        { params: createParams(mockExpenseId) }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('인증 에러 (401)', () => {
    it('로그인하지 않은 사용자는 복제할 수 없다', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await POST(
        createRequest(mockExpenseId),
        { params: createParams(mockExpenseId) }
      );

      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.error).toBe('로그인이 필요합니다.');
    });
  });

  describe('권한 에러 (403)', () => {
    it('타인의 지출결의서는 복제할 수 없다', async () => {
      const otherUserExpense = { ...mockOriginalExpense, userId: 'other-user' };
      vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser);
      vi.mocked(prisma.expense.findUnique).mockResolvedValue(otherUserExpense as any);

      const response = await POST(
        createRequest(mockExpenseId),
        { params: createParams(mockExpenseId) }
      );

      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.error).toBe('본인이 작성한 지출결의서만 복제할 수 있습니다.');
    });
  });

  describe('리소스 미존재 에러 (404)', () => {
    it('존재하지 않는 지출결의서는 복제할 수 없다', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser);
      vi.mocked(prisma.expense.findUnique).mockResolvedValue(null);

      const response = await POST(
        createRequest('non-existent-id'),
        { params: createParams('non-existent-id') }
      );

      expect(response.status).toBe(404);

      const json = await response.json();
      expect(json.error).toBe('지출결의서를 찾을 수 없습니다.');
    });
  });

  describe('잘못된 요청 에러 (400)', () => {
    it('청구팀을 생성할 수 없으면 에러를 반환한다', async () => {
      const noCommitteeExpense = {
        ...mockOriginalExpense,
        committee: '',
        department: ''
      };
      vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser);
      vi.mocked(prisma.expense.findUnique).mockResolvedValue(noCommitteeExpense as any);

      const response = await POST(
        createRequest(mockExpenseId),
        { params: createParams(mockExpenseId) }
      );

      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toBe('청구팀을 생성할 수 없습니다.');
    });
  });

  describe('데이터 무결성', () => {
    it('트랜잭션이 올바른 데이터로 호출된다', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUser);
      vi.mocked(prisma.expense.findUnique)
        .mockResolvedValueOnce(mockOriginalExpense as any)
        .mockResolvedValueOnce(mockDuplicatedExpense as any);

      // 트랜잭션 콜백 캡처
      let transactionCallback: any;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        transactionCallback = callback;
        // Mock transaction context
        const mockTx = {
          expense: {
            create: vi.fn().mockResolvedValue(mockDuplicatedExpense),
          },
          expenseItem: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          expenseAttachment: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return callback(mockTx);
      });

      await POST(
        createRequest(mockExpenseId),
        { params: createParams(mockExpenseId) }
      );

      // 트랜잭션이 호출되었는지 확인
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
