/**
 * useTemplates 훅 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTemplates } from '../useTemplates';

// fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockTemplates = [
  {
    id: '1',
    userId: 'user1',
    name: '월례 회의비',
    budgetCategory: '교회운영비',
    budgetSubcategory: '운영비',
    budgetDetail: '회의비',
    description: '매월 정기 회의',
    defaultAmount: 50000,
    usageCount: 5,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '2',
    userId: 'user1',
    name: '출장 교통비',
    budgetCategory: '선교비',
    budgetSubcategory: '국내선교',
    budgetDetail: '교통비',
    description: null,
    defaultAmount: null,
    usageCount: 3,
    createdAt: '2024-01-02',
    updatedAt: '2024-01-02',
  },
];

describe('useTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('템플릿 목록 조회', () => {
    it('템플릿 목록을 성공적으로 가져온다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ templates: mockTemplates }),
      });

      const { result } = renderHook(() => useTemplates());

      // 초기 상태
      expect(result.current.loading).toBe(true);
      expect(result.current.templates).toEqual([]);
      expect(result.current.error).toBeNull();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toEqual(mockTemplates);
      expect(result.current.isMaxReached).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith('/api/expense-templates');
    });

    it('skip 옵션이 true일 때 API 호출을 건너뛴다', async () => {
      const { result } = renderHook(() => useTemplates({ skip: true }));

      expect(result.current.loading).toBe(false);
      expect(result.current.templates).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('401 에러 시 빈 목록을 반환한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('API 에러 시 에러 메시지를 설정한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('템플릿 목록을 불러오는데 실패했습니다.');
    });

    it('20개 이상 템플릿이 있으면 isMaxReached가 true가 된다', async () => {
      const manyTemplates = Array.from({ length: 20 }, (_, i) => ({
        ...mockTemplates[0],
        id: `${i}`,
        name: `템플릿 ${i}`,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ templates: manyTemplates }),
      });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isMaxReached).toBe(true);
    });
  });

  describe('useTemplate (usageCount 증가)', () => {
    it('템플릿 사용 시 usageCount가 증가한다', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ...mockTemplates[0], usageCount: 6 }),
        });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let updatedTemplate;
      await act(async () => {
        updatedTemplate = await result.current.useTemplate('1');
      });

      expect(updatedTemplate).toEqual({ ...mockTemplates[0], usageCount: 6 });
      expect(mockFetch).toHaveBeenCalledWith('/api/expense-templates/1', {
        method: 'POST',
      });
    });

    it('템플릿 사용 실패 시 null을 반환한다', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: '템플릿을 찾을 수 없습니다.' }),
        });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let updatedTemplate;
      await act(async () => {
        updatedTemplate = await result.current.useTemplate('999');
      });

      expect(updatedTemplate).toBeNull();
    });
  });

  describe('createTemplate', () => {
    it('템플릿 생성이 성공하면 목록에 추가된다', async () => {
      const newTemplate = {
        id: '3',
        userId: 'user1',
        name: '새 템플릿',
        budgetCategory: '교육비',
        budgetSubcategory: '교재비',
        budgetDetail: '인쇄비',
        description: null,
        defaultAmount: null,
        usageCount: 0,
        createdAt: '2024-01-03',
        updatedAt: '2024-01-03',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newTemplate),
        });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let createdTemplate;
      await act(async () => {
        createdTemplate = await result.current.createTemplate({
          name: '새 템플릿',
          budgetCategory: '교육비',
          budgetSubcategory: '교재비',
          budgetDetail: '인쇄비',
        });
      });

      expect(createdTemplate).toEqual(newTemplate);
      expect(result.current.templates[0]).toEqual(newTemplate);
    });

    it('템플릿 생성 실패 시 에러를 throw한다', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: '최대 20개의 템플릿만 저장할 수 있습니다.' }),
        });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await expect(
          result.current.createTemplate({
            name: '새 템플릿',
            budgetCategory: '교육비',
            budgetSubcategory: '교재비',
            budgetDetail: '인쇄비',
          })
        ).rejects.toThrow('최대 20개의 템플릿만 저장할 수 있습니다.');
      });

      expect(result.current.error).toBe('최대 20개의 템플릿만 저장할 수 있습니다.');
    });
  });

  describe('deleteTemplate', () => {
    it('템플릿 삭제가 성공하면 목록에서 제거된다', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ message: '삭제 성공' }),
        });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(2);

      let success;
      await act(async () => {
        success = await result.current.deleteTemplate('1');
      });

      expect(success).toBe(true);
      expect(result.current.templates).toHaveLength(1);
      expect(result.current.templates.find((t) => t.id === '1')).toBeUndefined();
    });

    it('템플릿 삭제 실패 시 false를 반환한다', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: '삭제 실패' }),
        });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success;
      await act(async () => {
        success = await result.current.deleteTemplate('1');
      });

      expect(success).toBe(false);
      expect(result.current.templates).toHaveLength(2);
    });
  });

  describe('refresh', () => {
    it('refresh 호출 시 목록을 다시 가져온다', async () => {
      const updatedTemplates = [...mockTemplates, {
        id: '3',
        userId: 'user1',
        name: '추가된 템플릿',
        budgetCategory: '교육비',
        budgetSubcategory: '교재비',
        budgetDetail: '인쇄비',
        description: null,
        defaultAmount: null,
        usageCount: 0,
        createdAt: '2024-01-03',
        updatedAt: '2024-01-03',
      }];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: updatedTemplates }),
        });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.templates).toHaveLength(2);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.templates).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
