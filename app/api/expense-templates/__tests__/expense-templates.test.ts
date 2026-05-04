/**
 * 지출 템플릿 API 테스트
 *
 * GET  /api/expense-templates - 템플릿 목록 조회
 * POST /api/expense-templates - 템플릿 생성
 * PUT  /api/expense-templates/[id] - 템플릿 수정
 * DELETE /api/expense-templates/[id] - 템플릿 삭제
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expenseTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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
import { GET as GET_ONE, PUT, DELETE, POST as USE_TEMPLATE } from '../[id]/route';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

describe('지출 템플릿 API', () => {
  const mockUser = { id: 'user-1', username: '테스트유저' };
  const mockPrisma = prisma as any;
  const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
  });

  describe('GET /api/expense-templates', () => {
    it('사용자의 템플릿 목록을 반환해야 함', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          userId: 'user-1',
          name: '회의비 템플릿',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          budgetDetail: '다과비',
          usageCount: 5,
        },
        {
          id: 'template-2',
          userId: 'user-1',
          name: '교통비 템플릿',
          budgetCategory: '사무행정비',
          budgetSubcategory: '출장비',
          budgetDetail: '교통비',
          usageCount: 3,
        },
      ];

      mockPrisma.expenseTemplate.findMany.mockResolvedValue(mockTemplates);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.templates).toHaveLength(2);
      expect(data.templates[0].name).toBe('회의비 템플릿');
    });

    it('로그인하지 않은 경우 401을 반환해야 함', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('로그인');
    });

    it('usageCount 순으로 정렬해야 함', async () => {
      await GET();

      expect(mockPrisma.expenseTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { usageCount: 'desc' },
            { createdAt: 'desc' },
          ],
        })
      );
    });
  });

  describe('POST /api/expense-templates', () => {
    const createRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/expense-templates', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const validTemplateData = {
      name: '새 템플릿',
      budgetCategory: '사무행정비',
      budgetSubcategory: '회의비',
      budgetDetail: '다과비',
      description: '기본 적요',
      defaultAmount: 50000,
    };

    it('템플릿을 생성해야 함', async () => {
      mockPrisma.expenseTemplate.count.mockResolvedValue(0);
      mockPrisma.expenseTemplate.create.mockResolvedValue({
        id: 'new-template',
        userId: 'user-1',
        ...validTemplateData,
      });

      const request = createRequest(validTemplateData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('새 템플릿');
    });

    it('필수 필드가 없으면 400을 반환해야 함', async () => {
      const request = createRequest({
        name: '템플릿',
        // budgetCategory 누락
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('최대 20개를 초과하면 400을 반환해야 함', async () => {
      mockPrisma.expenseTemplate.count.mockResolvedValue(20);

      const request = createRequest(validTemplateData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('20');
    });
  });

  describe('GET /api/expense-templates/[id]', () => {
    const createParams = (id: string) => Promise.resolve({ id });

    it('템플릿 상세를 반환해야 함', async () => {
      const mockTemplate = {
        id: 'template-1',
        userId: 'user-1',
        name: '회의비 템플릿',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        budgetDetail: '다과비',
      };

      mockPrisma.expenseTemplate.findUnique.mockResolvedValue(mockTemplate);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1');
      const response = await GET_ONE(request, { params: createParams('template-1') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('회의비 템플릿');
    });

    it('다른 사용자의 템플릿 접근 시 403을 반환해야 함', async () => {
      const mockTemplate = {
        id: 'template-1',
        userId: 'other-user', // 다른 사용자
        name: '회의비 템플릿',
      };

      mockPrisma.expenseTemplate.findUnique.mockResolvedValue(mockTemplate);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1');
      const response = await GET_ONE(request, { params: createParams('template-1') });

      expect(response.status).toBe(403);
    });

    it('존재하지 않는 템플릿은 404를 반환해야 함', async () => {
      mockPrisma.expenseTemplate.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/nonexistent');
      const response = await GET_ONE(request, { params: createParams('nonexistent') });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/expense-templates/[id]', () => {
    const createParams = (id: string) => Promise.resolve({ id });

    it('템플릿을 수정해야 함', async () => {
      const mockTemplate = {
        id: 'template-1',
        userId: 'user-1',
        name: '기존 템플릿',
      };

      mockPrisma.expenseTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.expenseTemplate.update.mockResolvedValue({
        ...mockTemplate,
        name: '수정된 템플릿',
      });

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1', {
        method: 'PUT',
        body: JSON.stringify({ name: '수정된 템플릿' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request, { params: createParams('template-1') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('수정된 템플릿');
    });

    it('로그인하지 않은 경우 401을 반환해야 함', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1', {
        method: 'PUT',
        body: JSON.stringify({ name: '수정' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request, { params: createParams('template-1') });
      expect(response.status).toBe(401);
    });

    it('다른 사용자의 템플릿 수정 시 403을 반환해야 함', async () => {
      mockPrisma.expenseTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        userId: 'other-user',
        name: '다른 사용자 템플릿',
      });

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1', {
        method: 'PUT',
        body: JSON.stringify({ name: '수정' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request, { params: createParams('template-1') });
      expect(response.status).toBe(403);
    });

    it('존재하지 않는 템플릿 수정 시 404를 반환해야 함', async () => {
      mockPrisma.expenseTemplate.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ name: '수정' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request, { params: createParams('nonexistent') });
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/expense-templates/[id]', () => {
    const createParams = (id: string) => Promise.resolve({ id });

    it('템플릿을 삭제해야 함', async () => {
      const mockTemplate = {
        id: 'template-1',
        userId: 'user-1',
        name: '삭제할 템플릿',
      };

      mockPrisma.expenseTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.expenseTemplate.delete.mockResolvedValue(mockTemplate);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: createParams('template-1') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('삭제');
    });

    it('로그인하지 않은 경우 401을 반환해야 함', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: createParams('template-1') });
      expect(response.status).toBe(401);
    });

    it('다른 사용자의 템플릿 삭제 시 403을 반환해야 함', async () => {
      mockPrisma.expenseTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        userId: 'other-user',
        name: '다른 사용자 템플릿',
      });

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: createParams('template-1') });
      expect(response.status).toBe(403);
    });

    it('존재하지 않는 템플릿 삭제 시 404를 반환해야 함', async () => {
      mockPrisma.expenseTemplate.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/nonexistent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: createParams('nonexistent') });
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/expense-templates/[id] (사용)', () => {
    const createParams = (id: string) => Promise.resolve({ id });

    it('usageCount를 증가시켜야 함', async () => {
      const mockTemplate = {
        id: 'template-1',
        userId: 'user-1',
        name: '사용할 템플릿',
        usageCount: 5,
      };

      mockPrisma.expenseTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.expenseTemplate.update.mockResolvedValue({
        ...mockTemplate,
        usageCount: 6,
      });

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1', {
        method: 'POST',
      });

      const response = await USE_TEMPLATE(request, { params: createParams('template-1') });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.expenseTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            usageCount: { increment: 1 },
          },
        })
      );
    });

    it('로그인하지 않은 경우 401을 반환해야 함', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1', {
        method: 'POST',
      });

      const response = await USE_TEMPLATE(request, { params: createParams('template-1') });
      expect(response.status).toBe(401);
    });

    it('다른 사용자의 템플릿 사용 시 403을 반환해야 함', async () => {
      mockPrisma.expenseTemplate.findUnique.mockResolvedValue({
        id: 'template-1',
        userId: 'other-user',
        name: '다른 사용자 템플릿',
        usageCount: 5,
      });

      const request = new NextRequest('http://localhost:3000/api/expense-templates/template-1', {
        method: 'POST',
      });

      const response = await USE_TEMPLATE(request, { params: createParams('template-1') });
      expect(response.status).toBe(403);
    });

    it('존재하지 않는 템플릿 사용 시 404를 반환해야 함', async () => {
      mockPrisma.expenseTemplate.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/expense-templates/nonexistent', {
        method: 'POST',
      });

      const response = await USE_TEMPLATE(request, { params: createParams('nonexistent') });
      expect(response.status).toBe(404);
    });
  });
});
