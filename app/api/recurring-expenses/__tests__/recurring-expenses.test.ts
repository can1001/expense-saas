/**
 * 자동이체 API 테스트
 *
 * GET  /api/recurring-expenses - 자동이체 목록 조회
 * POST /api/recurring-expenses - 자동이체 생성
 * GET  /api/recurring-expenses/[id] - 자동이체 상세 조회
 * PUT  /api/recurring-expenses/[id] - 자동이체 수정
 * DELETE /api/recurring-expenses/[id] - 자동이체 삭제 (취소)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    recurringExpense: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

// Import after mocking
import { GET, POST } from '../route';
import { GET as GET_ONE, PUT, DELETE } from '../[id]/route';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

describe('자동이체 API', () => {
  const mockUser = { id: 'user-1', username: '테스트유저' };
  const mockPrisma = prisma as unknown as {
    recurringExpense: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };
  const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
  });

  describe('GET /api/recurring-expenses', () => {
    it('사용자의 자동이체 목록을 반환해야 함', async () => {
      const mockRecurringExpenses = [
        {
          id: 'rec-1',
          userId: 'user-1',
          name: '사무실 임대료',
          baseAmount: 500000,
          frequency: 'MONTHLY',
          dayOfMonth: 25,
          status: 'ACTIVE',
          generatedExpenses: [],
        },
        {
          id: 'rec-2',
          userId: 'user-1',
          name: '청소 용역비',
          baseAmount: 200000,
          frequency: 'MONTHLY',
          dayOfMonth: 5,
          status: 'ACTIVE',
          generatedExpenses: [],
        },
      ];

      mockPrisma.recurringExpense.findMany.mockResolvedValue(mockRecurringExpenses);
      mockPrisma.recurringExpense.count.mockResolvedValue(2);

      const request = new NextRequest('http://localhost/api/recurring-expenses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recurringExpenses).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
    });

    it('로그인하지 않은 경우 401을 반환해야 함', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/recurring-expenses');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('로그인');
    });

    it('상태 필터가 적용되어야 함', async () => {
      mockPrisma.recurringExpense.findMany.mockResolvedValue([]);
      mockPrisma.recurringExpense.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost/api/recurring-expenses?status=ACTIVE');
      await GET(request);

      expect(mockPrisma.recurringExpense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });
  });

  describe('POST /api/recurring-expenses', () => {
    const validCreateData = {
      name: '사무실 임대료',
      committee: '재정위원회',
      department: '총무부',
      budgetCategory: '사무행정비',
      budgetSubcategory: '임차료',
      budgetDetail: '사무실 임대',
      recipientName: '임대인 홍길동',
      bankName: '국민은행',
      accountNumber: '123-456-789012',
      baseAmount: 500000,
      frequency: 'MONTHLY',
      dayOfMonth: 25,
      startDate: '2025-01-01',
      advanceDays: 7,
    };

    it('자동이체를 생성해야 함', async () => {
      const mockCreated = {
        id: 'rec-new',
        ...validCreateData,
        userId: 'user-1',
        status: 'ACTIVE',
      };

      mockPrisma.recurringExpense.create.mockResolvedValue(mockCreated);

      const request = new NextRequest('http://localhost/api/recurring-expenses', {
        method: 'POST',
        body: JSON.stringify(validCreateData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('사무실 임대료');
    });

    it('로그인하지 않은 경우 401을 반환해야 함', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/recurring-expenses', {
        method: 'POST',
        body: JSON.stringify(validCreateData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('로그인');
    });

    it('필수 필드가 누락되면 400을 반환해야 함', async () => {
      const invalidData = { ...validCreateData };
      delete (invalidData as Record<string, unknown>).name;

      const request = new NextRequest('http://localhost/api/recurring-expenses', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('dayOfMonth가 28을 초과하면 400을 반환해야 함', async () => {
      const invalidData = { ...validCreateData, dayOfMonth: 31 };

      const request = new NextRequest('http://localhost/api/recurring-expenses', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/recurring-expenses/[id]', () => {
    it('자동이체 상세 정보를 반환해야 함', async () => {
      const mockRecurringExpense = {
        id: 'rec-1',
        userId: 'user-1',
        name: '사무실 임대료',
        baseAmount: 500000,
        frequency: 'MONTHLY',
        generatedExpenses: [],
      };

      mockPrisma.recurringExpense.findUnique.mockResolvedValue(mockRecurringExpense);

      const request = new NextRequest('http://localhost/api/recurring-expenses/rec-1');
      const response = await GET_ONE(request, { params: Promise.resolve({ id: 'rec-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('사무실 임대료');
    });

    it('존재하지 않는 자동이체는 404를 반환해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/recurring-expenses/invalid');
      const response = await GET_ONE(request, { params: Promise.resolve({ id: 'invalid' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('찾을 수 없');
    });

    it('다른 사용자의 자동이체는 403을 반환해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'other-user',
        name: '다른 사람의 자동이체',
      });

      const request = new NextRequest('http://localhost/api/recurring-expenses/rec-1');
      const response = await GET_ONE(request, { params: Promise.resolve({ id: 'rec-1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('권한');
    });
  });

  describe('PUT /api/recurring-expenses/[id]', () => {
    it('자동이체를 수정해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        status: 'ACTIVE',
        frequency: 'MONTHLY',
        dayOfMonth: 25,
        advanceDays: 7,
      });

      mockPrisma.recurringExpense.update.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        name: '수정된 임대료',
        baseAmount: 600000,
      });

      const request = new NextRequest('http://localhost/api/recurring-expenses/rec-1', {
        method: 'PUT',
        body: JSON.stringify({ name: '수정된 임대료', baseAmount: 600000 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'rec-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('수정된 임대료');
    });

    it('취소된 자동이체는 수정할 수 없어야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        status: 'CANCELLED',
      });

      const request = new NextRequest('http://localhost/api/recurring-expenses/rec-1', {
        method: 'PUT',
        body: JSON.stringify({ name: '수정 시도' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'rec-1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('취소');
    });

    it('다른 사용자의 자동이체는 수정할 수 없어야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'other-user',
        status: 'ACTIVE',
      });

      const request = new NextRequest('http://localhost/api/recurring-expenses/rec-1', {
        method: 'PUT',
        body: JSON.stringify({ name: '수정 시도' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'rec-1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('권한');
    });
  });

  describe('DELETE /api/recurring-expenses/[id]', () => {
    it('자동이체를 취소해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        status: 'ACTIVE',
      });

      mockPrisma.recurringExpense.update.mockResolvedValue({
        id: 'rec-1',
        status: 'CANCELLED',
      });

      const request = new NextRequest('http://localhost/api/recurring-expenses/rec-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'rec-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('취소');
      expect(mockPrisma.recurringExpense.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('이미 취소된 자동이체는 400을 반환해야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        status: 'CANCELLED',
      });

      const request = new NextRequest('http://localhost/api/recurring-expenses/rec-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'rec-1' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('이미 취소');
    });

    it('다른 사용자의 자동이체는 삭제할 수 없어야 함', async () => {
      mockPrisma.recurringExpense.findUnique.mockResolvedValue({
        id: 'rec-1',
        userId: 'other-user',
        status: 'ACTIVE',
      });

      const request = new NextRequest('http://localhost/api/recurring-expenses/rec-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'rec-1' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('권한');
    });
  });
});
