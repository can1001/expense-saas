/**
 * DELETE /api/expenses/[id] API 테스트
 *
 * 테스트 대상:
 * - 비로그인 사용자 삭제 시도 → 401
 * - 타인 지출결의서 삭제 시도 → 403
 * - 본인 DRAFT 지출결의서 삭제 → 성공
 * - 본인 PENDING 지출결의서 삭제 시도 → 403 (상태 제한)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expense: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    expenseAttachment: {
      findMany: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getSessionUserId: vi.fn(),
}));

// Mock cloudinary
vi.mock('@/lib/cloudinary', () => ({
  deleteImages: vi.fn(),
}));

// Import after mocking
import { DELETE } from '../[id]/route';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';

describe('DELETE /api/expenses/[id]', () => {
  const mockPrisma = prisma as any;
  const mockGetSessionUserId = getSessionUserId as ReturnType<typeof vi.fn>;

  const createMockExpense = (overrides = {}) => ({
    id: 'test-expense-id',
    status: 'DRAFT',
    userId: 'owner-user-id',
    ...overrides,
  });

  const createDeleteRequest = () => {
    return new NextRequest('http://localhost:3000/api/expenses/test-expense-id', {
      method: 'DELETE',
    });
  };

  const createParams = () => Promise.resolve({ id: 'test-expense-id' });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.expenseAttachment.findMany.mockResolvedValue([]);
    mockPrisma.expense.delete.mockResolvedValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('인증 테스트', () => {
    it('비로그인 사용자 삭제 시도 시 401 에러', async () => {
      mockGetSessionUserId.mockResolvedValue(null);

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('로그인이 필요합니다.');
    });
  });

  describe('소유권 검증 테스트', () => {
    it('타인의 지출결의서 삭제 시도 시 403 에러', async () => {
      mockGetSessionUserId.mockResolvedValue('other-user-id');
      mockPrisma.expense.findUnique.mockResolvedValue(
        createMockExpense({ userId: 'owner-user-id' })
      );

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('삭제 권한이 없습니다.');
    });

    it('본인 지출결의서는 삭제 가능', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-user-id');
      mockPrisma.expense.findUnique.mockResolvedValue(
        createMockExpense({ userId: 'owner-user-id', status: 'DRAFT' })
      );

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('상태 제한 테스트', () => {
    it('DRAFT 상태 삭제 성공', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-user-id');
      mockPrisma.expense.findUnique.mockResolvedValue(
        createMockExpense({ userId: 'owner-user-id', status: 'DRAFT' })
      );

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma.expense.delete).toHaveBeenCalledWith({
        where: { id: 'test-expense-id' },
      });
    });

    it('REJECTED 상태 삭제 성공', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-user-id');
      mockPrisma.expense.findUnique.mockResolvedValue(
        createMockExpense({ userId: 'owner-user-id', status: 'REJECTED' })
      );

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('WITHDRAWN 상태 삭제 성공', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-user-id');
      mockPrisma.expense.findUnique.mockResolvedValue(
        createMockExpense({ userId: 'owner-user-id', status: 'WITHDRAWN' })
      );

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('PENDING 상태 삭제 시 403 에러', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-user-id');
      mockPrisma.expense.findUnique.mockResolvedValue(
        createMockExpense({ userId: 'owner-user-id', status: 'PENDING' })
      );

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('제출된 지출결의서는 삭제할 수 없습니다.');
    });

    it('APPROVED_STEP_1 상태 삭제 시 403 에러', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-user-id');
      mockPrisma.expense.findUnique.mockResolvedValue(
        createMockExpense({ userId: 'owner-user-id', status: 'APPROVED_STEP_1' })
      );

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('제출된 지출결의서는 삭제할 수 없습니다.');
    });

    it('APPROVED_FINAL 상태 삭제 시 403 에러', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-user-id');
      mockPrisma.expense.findUnique.mockResolvedValue(
        createMockExpense({ userId: 'owner-user-id', status: 'APPROVED_FINAL' })
      );

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('제출된 지출결의서는 삭제할 수 없습니다.');
    });
  });

  describe('404 에러 테스트', () => {
    it('존재하지 않는 지출결의서 삭제 시 404 에러', async () => {
      mockGetSessionUserId.mockResolvedValue('owner-user-id');
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      const response = await DELETE(createDeleteRequest(), { params: createParams() });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('지출결의서를 찾을 수 없습니다.');
    });
  });
});
