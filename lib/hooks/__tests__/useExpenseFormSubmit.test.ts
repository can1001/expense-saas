/**
 * useExpenseFormSubmit 훅 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExpenseFormSubmit } from '../useExpenseFormSubmit';
import { UploadedFile } from '@/lib/types';

// next/navigation mock
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// alert mock
const mockAlert = vi.fn();
global.alert = mockAlert;

describe('useExpenseFormSubmit', () => {
  const mockSetLoading = vi.fn();
  const mockSetError = vi.fn();

  const defaultOptions = {
    apiEndpoint: '/api/expenses',
    redirectPath: '/expenses',
    attachments: [],
    setLoading: mockSetLoading,
    setError: mockSetError,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create mode (no expenseId)', () => {
    it('should submit form successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-expense-id' }),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      let submitResult: { success: boolean; id?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit({
          committee: '기획위원회',
          department: '기획팀',
        });
      });

      expect(submitResult!.success).toBe(true);
      expect(submitResult!.id).toBe('new-expense-id');
      expect(mockSetLoading).toHaveBeenCalledWith(true);
      expect(mockSetLoading).toHaveBeenCalledWith(false);
      expect(mockSetError).toHaveBeenCalledWith(null);
      expect(mockAlert).toHaveBeenCalledWith('지출결의서가 성공적으로 등록되었습니다.');
      expect(mockPush).toHaveBeenCalledWith('/expenses/new-expense-id');
      expect(mockFetch).toHaveBeenCalledWith('/api/expenses', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    it('should save attachments when present', async () => {
      const attachments: UploadedFile[] = [
        {
          publicId: 'public-1',
          url: 'http://example.com/file.pdf',
          originalName: 'file.pdf',
          format: 'pdf',
          size: 1024,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'new-expense-id' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'attachment-id' }),
        });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({ ...defaultOptions, attachments })
      );

      await act(async () => {
        await result.current.handleSubmit({ committee: '기획위원회' });
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/attachments',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should use custom saveAttachments function when provided', async () => {
      const attachments: UploadedFile[] = [
        {
          publicId: 'public-1',
          url: 'http://example.com/file.pdf',
          originalName: 'file.pdf',
          format: 'pdf',
          size: 1024,
        },
      ];
      const mockSaveAttachments = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-expense-id' }),
      });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({
          ...defaultOptions,
          attachments,
          saveAttachments: mockSaveAttachments,
        })
      );

      await act(async () => {
        await result.current.handleSubmit({ committee: '기획위원회' });
      });

      expect(mockSaveAttachments).toHaveBeenCalledWith('new-expense-id', attachments);
      expect(mockFetch).toHaveBeenCalledTimes(1); // 첨부파일 API 호출 없음
    });

    it('should skip attachments that already have id', async () => {
      const attachments: UploadedFile[] = [
        {
          id: 'existing-id',
          publicId: 'public-1',
          url: 'http://example.com/file.pdf',
          originalName: 'file.pdf',
          format: 'pdf',
          size: 1024,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-expense-id' }),
      });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({ ...defaultOptions, attachments })
      );

      await act(async () => {
        await result.current.handleSubmit({ committee: '기획위원회' });
      });

      // 첨부파일이 이미 id가 있으므로 추가 API 호출 없음
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle attachment save error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const attachments: UploadedFile[] = [
        {
          publicId: 'public-1',
          url: 'http://example.com/file.pdf',
          originalName: 'file.pdf',
          format: 'pdf',
          size: 1024,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'new-expense-id' }),
        })
        .mockRejectedValueOnce(new Error('Attachment save failed'));

      const { result } = renderHook(() =>
        useExpenseFormSubmit({ ...defaultOptions, attachments })
      );

      let submitResult: { success: boolean };
      await act(async () => {
        submitResult = await result.current.handleSubmit({ committee: '기획위원회' });
      });

      // 첨부파일 저장 실패해도 지출결의서는 성공으로 처리
      expect(submitResult!.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('edit mode (with expenseId)', () => {
    it('should submit form with PUT method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'expense-123' }),
      });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
      );

      await act(async () => {
        await result.current.handleSubmit({ committee: '기획위원회' });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/expenses/expense-123',
        expect.objectContaining({
          method: 'PUT',
        })
      );
      expect(mockAlert).toHaveBeenCalledWith('지출결의서가 성공적으로 수정되었습니다.');
    });

    it('should not save attachments in edit mode', async () => {
      const attachments: UploadedFile[] = [
        {
          publicId: 'public-1',
          url: 'http://example.com/file.pdf',
          originalName: 'file.pdf',
          format: 'pdf',
          size: 1024,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'expense-123' }),
      });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({
          ...defaultOptions,
          expenseId: 'expense-123',
          attachments,
        })
      );

      await act(async () => {
        await result.current.handleSubmit({ committee: '기획위원회' });
      });

      // 수정 모드에서는 첨부파일 저장 API 호출 안함
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    describe('edit mode + submit (status: PENDING)', () => {
      it('should save as DRAFT first, then call submit API', async () => {
        // Step 1: PUT으로 저장 (status: DRAFT)
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: 'expense-123' }),
          })
          // Step 2: submit API 호출
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: 'expense-123', status: 'PENDING' }),
          });

        const { result } = renderHook(() =>
          useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
        );

        await act(async () => {
          await result.current.handleSubmit({
            committee: '기획위원회',
            status: 'PENDING', // 제출
          });
        });

        // 2번 호출되어야 함
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // 첫 번째 호출: PUT으로 저장 (status: DRAFT)
        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          '/api/expenses/expense-123',
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('"status":"DRAFT"'),
          })
        );

        // 두 번째 호출: submit API
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          '/api/expenses/expense-123/submit',
          expect.objectContaining({
            method: 'POST',
          })
        );

        expect(mockAlert).toHaveBeenCalledWith('지출결의서가 성공적으로 제출되었습니다.');
        expect(mockPush).toHaveBeenCalledWith('/expenses/expense-123');
      });

      it('should handle save error in edit + submit flow', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve(JSON.stringify({ error: '저장 실패' })),
        });

        const { result } = renderHook(() =>
          useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
        );

        let submitResult: { success: boolean; error?: string };
        await act(async () => {
          submitResult = await result.current.handleSubmit({
            committee: '기획위원회',
            status: 'PENDING',
          });
        });

        expect(submitResult!.success).toBe(false);
        expect(submitResult!.error).toBe('저장 실패');
        expect(mockFetch).toHaveBeenCalledTimes(1); // submit API 호출 안됨
      });

      it('should handle submit API error in edit + submit flow', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: 'expense-123' }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: () => Promise.resolve(JSON.stringify({ error: '제출 실패', details: '결재선 생성 실패' })),
          });

        const { result } = renderHook(() =>
          useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
        );

        let submitResult: { success: boolean; error?: string };
        await act(async () => {
          submitResult = await result.current.handleSubmit({
            committee: '기획위원회',
            status: 'PENDING',
          });
        });

        expect(submitResult!.success).toBe(false);
        expect(submitResult!.error).toBe('제출 실패: 결재선 생성 실패');
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should handle non-JSON error response in save step', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        });

        const { result } = renderHook(() =>
          useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
        );

        let submitResult: { success: boolean; error?: string };
        await act(async () => {
          submitResult = await result.current.handleSubmit({
            committee: '기획위원회',
            status: 'PENDING',
          });
        });

        expect(submitResult!.error).toBe('서버 오류 (500): Internal Server Error');
      });

      it('should handle non-JSON error response in submit step', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: 'expense-123' }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Internal Server Error'),
          });

        const { result } = renderHook(() =>
          useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
        );

        let submitResult: { success: boolean; error?: string };
        await act(async () => {
          submitResult = await result.current.handleSubmit({
            committee: '기획위원회',
            status: 'PENDING',
          });
        });

        expect(submitResult!.error).toBe('서버 오류 (500): Internal Server Error');
      });

      it('should handle save error with details in edit + submit flow', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve(JSON.stringify({
            error: '저장 실패',
            details: '필수 필드가 누락되었습니다'
          })),
        });

        const { result } = renderHook(() =>
          useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
        );

        let submitResult: { success: boolean; error?: string };
        await act(async () => {
          submitResult = await result.current.handleSubmit({
            committee: '기획위원회',
            status: 'PENDING',
          });
        });

        expect(submitResult!.success).toBe(false);
        expect(submitResult!.error).toBe('저장 실패: 필수 필드가 누락되었습니다');
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it('should handle submit API error without details in edit + submit flow', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ id: 'expense-123' }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: () => Promise.resolve(JSON.stringify({ error: '제출 실패' })),
          });

        const { result } = renderHook(() =>
          useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
        );

        let submitResult: { success: boolean; error?: string };
        await act(async () => {
          submitResult = await result.current.handleSubmit({
            committee: '기획위원회',
            status: 'PENDING',
          });
        });

        expect(submitResult!.success).toBe(false);
        expect(submitResult!.error).toBe('제출 실패');
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('error handling', () => {
    it('should handle API error with JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () =>
          Promise.resolve(
            JSON.stringify({ error: '검증 실패', details: '필수 필드 누락' })
          ),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      let submitResult: { success: boolean; error?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit({ committee: '' });
      });

      expect(submitResult!.success).toBe(false);
      expect(submitResult!.error).toBe('검증 실패: 필수 필드 누락');
      expect(mockSetError).toHaveBeenCalledWith('검증 실패: 필수 필드 누락');
      expect(mockAlert).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle API error with error only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () =>
          Promise.resolve(JSON.stringify({ error: '저장 실패' })),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      let submitResult: { success: boolean; error?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit({ committee: '' });
      });

      expect(submitResult!.error).toBe('저장 실패');
    });

    it('should handle API error with non-JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      let submitResult: { success: boolean; error?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit({ committee: '' });
      });

      expect(submitResult!.success).toBe(false);
      expect(submitResult!.error).toBe('서버 오류 (500): Internal Server Error');
    });

    it('should handle API error with empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve(''),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      let submitResult: { success: boolean; error?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit({ committee: '' });
      });

      expect(submitResult!.error).toBe('서버 오류 (500): 응답 없음');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      let submitResult: { success: boolean; error?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit({ committee: '' });
      });

      expect(submitResult!.success).toBe(false);
      expect(submitResult!.error).toBe('Network error');
      expect(mockSetError).toHaveBeenCalledWith('Network error');
    });

    it('should handle unknown error', async () => {
      mockFetch.mockRejectedValueOnce('Unknown error');

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      let submitResult: { success: boolean; error?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit({ committee: '' });
      });

      expect(submitResult!.error).toBe('알 수 없는 오류가 발생했습니다.');
    });
  });

  describe('data transformation', () => {
    it('should convert expenseDate to null when empty string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-expense-id' }),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      await act(async () => {
        await result.current.handleSubmit({
          committee: '기획위원회',
          expenseDate: '',
        });
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.expenseDate).toBeNull();
    });

    it('should keep expenseDate when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-expense-id' }),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      await act(async () => {
        await result.current.handleSubmit({
          committee: '기획위원회',
          expenseDate: '2025-01-15',
        });
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.expenseDate).toBe('2025-01-15');
    });
  });

  describe('submit with status PENDING', () => {
    it('should call submit API when status is PENDING in create mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-expense-id' }),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      await act(async () => {
        await result.current.handleSubmit({
          committee: '기획위원회',
          status: 'PENDING',
        });
      });

      expect(mockAlert).toHaveBeenCalledWith('지출결의서가 성공적으로 제출되었습니다.');
    });
  });
});
