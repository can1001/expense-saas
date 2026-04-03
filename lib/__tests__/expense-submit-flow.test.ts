/**
 * 지출결의서 임시저장 및 제출 흐름 테스트
 *
 * 영수증 예외 세목 validation과 제출 모드별 동작 검증
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpenseFormSubmit } from '../hooks/useExpenseFormSubmit';
import {
  areAllItemsReceiptExempt,
  RECEIPT_EXEMPT_DETAILS,
} from '../constants/receipt-exempt-details';
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

describe('지출결의서 임시저장 및 제출 흐름', () => {
  const mockSetLoading = vi.fn();
  const mockSetError = vi.fn();

  const defaultOptions = {
    apiEndpoint: '/api/expenses',
    redirectPath: '/expenses',
    attachments: [] as UploadedFile[],
    setLoading: mockSetLoading,
    setError: mockSetError,
  };

  const mockExpenseData = {
    committee: '기획위원회',
    department: '기획팀',
    applicantName: '홍길동',
    bankName: '국민은행',
    accountNumber: '110-123-456789',
    accountHolder: '홍길동',
    items: [
      {
        budgetCategory: '일반관리비',
        budgetSubcategory: '일반직무비',
        budgetDetail: '회의비',
        description: '팀 회의',
        unitPrice: 10000,
        quantity: 3,
        amount: 30000,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('영수증 validation 로직 (areAllItemsReceiptExempt)', () => {
    describe('영수증 필수인 경우 (일반 세목)', () => {
      it('일반 세목이 하나라도 있으면 영수증 필수', () => {
        const items = [
          { budgetDetail: '회의비' },
          { budgetDetail: '교역자식대' }, // 예외 세목
        ];
        expect(areAllItemsReceiptExempt(items)).toBe(false);
      });

      it('모든 항목이 일반 세목이면 영수증 필수', () => {
        const items = [
          { budgetDetail: '회의비' },
          { budgetDetail: '출장비' },
        ];
        expect(areAllItemsReceiptExempt(items)).toBe(false);
      });
    });

    describe('영수증 선택사항인 경우 (예외 세목)', () => {
      it('모든 항목이 예외 세목이면 영수증 선택', () => {
        const items = [
          { budgetDetail: '교역자식대' },
          { budgetDetail: '사무간사식대' },
        ];
        expect(areAllItemsReceiptExempt(items)).toBe(true);
      });

      it.each(RECEIPT_EXEMPT_DETAILS)(
        '예외 세목 "%s" 단독 사용 시 영수증 선택',
        (detail) => {
          const items = [{ budgetDetail: detail }];
          expect(areAllItemsReceiptExempt(items)).toBe(true);
        }
      );
    });
  });

  describe('임시저장 (DRAFT) 모드', () => {
    it('신규 생성 시 POST 호출 및 DRAFT 상태 저장', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-expense-id' }),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      await act(async () => {
        await result.current.handleSubmit({
          ...mockExpenseData,
          status: 'DRAFT',
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/expenses',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"status":"DRAFT"'),
        })
      );
      expect(mockAlert).toHaveBeenCalledWith('지출결의서가 성공적으로 등록되었습니다.');
    });

    it('수정 시 PUT 호출 및 DRAFT 상태 유지', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'expense-123' }),
      });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
      );

      await act(async () => {
        await result.current.handleSubmit({
          ...mockExpenseData,
          status: 'DRAFT',
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/expenses/expense-123',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"status":"DRAFT"'),
        })
      );
      expect(mockAlert).toHaveBeenCalledWith('지출결의서가 성공적으로 수정되었습니다.');
    });

    it('영수증 없이도 임시저장 가능', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-expense-id' }),
      });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({ ...defaultOptions, attachments: [] })
      );

      let submitResult: { success: boolean };
      await act(async () => {
        submitResult = await result.current.handleSubmit({
          ...mockExpenseData,
          status: 'DRAFT',
        });
      });

      expect(submitResult!.success).toBe(true);
    });
  });

  describe('제출 (PENDING) 모드 - 신규 생성', () => {
    it('신규 생성 + 제출 시 PENDING 상태로 저장', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-expense-id' }),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      await act(async () => {
        await result.current.handleSubmit({
          ...mockExpenseData,
          status: 'PENDING',
        });
      });

      expect(mockAlert).toHaveBeenCalledWith('지출결의서가 성공적으로 제출되었습니다.');
    });

    it('첨부파일이 있으면 함께 저장', async () => {
      const attachments: UploadedFile[] = [
        {
          publicId: 'public-1',
          url: 'http://example.com/receipt.pdf',
          originalName: 'receipt.pdf',
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
        await result.current.handleSubmit({
          ...mockExpenseData,
          status: 'PENDING',
        });
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/attachments',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('제출 (PENDING) 모드 - 수정', () => {
    it('수정 + 제출 시 DRAFT 저장 후 submit API 호출', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'expense-123' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'expense-123', status: 'PENDING' }),
        });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
      );

      await act(async () => {
        await result.current.handleSubmit({
          ...mockExpenseData,
          status: 'PENDING',
        });
      });

      // 2단계 호출 확인
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Step 1: PUT으로 DRAFT 저장
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/api/expenses/expense-123',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"status":"DRAFT"'),
        })
      );

      // Step 2: submit API 호출
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/expenses/expense-123/submit',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('저장 실패 시 submit API 호출하지 않음', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve(JSON.stringify({ error: '저장 실패' })),
      });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
      );

      let submitResult: { success: boolean };
      await act(async () => {
        submitResult = await result.current.handleSubmit({
          ...mockExpenseData,
          status: 'PENDING',
        });
      });

      expect(submitResult!.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // submit API 호출 안됨
    });

    it('submit API 실패 시 에러 메시지 표시', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'expense-123' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () =>
            Promise.resolve(
              JSON.stringify({ error: '제출 실패', details: '결재선 생성 오류' })
            ),
        });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({ ...defaultOptions, expenseId: 'expense-123' })
      );

      let submitResult: { success: boolean; error?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit({
          ...mockExpenseData,
          status: 'PENDING',
        });
      });

      expect(submitResult!.success).toBe(false);
      expect(submitResult!.error).toBe('제출 실패: 결재선 생성 오류');
    });
  });

  describe('예외 세목과 첨부파일 조합', () => {
    it('예외 세목만 있는 경우 영수증 없이도 제출 가능 확인', () => {
      const exemptItems = [
        { budgetDetail: '교역자식대' },
        { budgetDetail: '사무간사식대' },
      ];
      const attachments: UploadedFile[] = [];

      // 영수증 없음 + 모두 예외 세목 = 제출 허용
      const shouldAllowSubmit =
        attachments.length > 0 || areAllItemsReceiptExempt(exemptItems);
      expect(shouldAllowSubmit).toBe(true);
    });

    it('일반 세목이 포함되면 영수증 필수', () => {
      const mixedItems = [
        { budgetDetail: '교역자식대' }, // 예외
        { budgetDetail: '회의비' }, // 일반
      ];
      const attachments: UploadedFile[] = [];

      // 영수증 없음 + 일반 세목 포함 = 제출 불허
      const shouldAllowSubmit =
        attachments.length > 0 || areAllItemsReceiptExempt(mixedItems);
      expect(shouldAllowSubmit).toBe(false);
    });

    it('일반 세목이지만 영수증 있으면 제출 허용', () => {
      const normalItems = [{ budgetDetail: '회의비' }];
      const attachments: UploadedFile[] = [
        {
          publicId: 'public-1',
          url: 'http://example.com/receipt.pdf',
          originalName: 'receipt.pdf',
          format: 'pdf',
          size: 1024,
        },
      ];

      // 영수증 있음 = 제출 허용
      const shouldAllowSubmit =
        attachments.length > 0 || areAllItemsReceiptExempt(normalItems);
      expect(shouldAllowSubmit).toBe(true);
    });
  });

  describe('Simple 지출결의서 (간편 폼)', () => {
    it('간편 폼도 동일한 API 엔드포인트 패턴 사용', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'simple-expense-id' }),
      });

      const { result } = renderHook(() =>
        useExpenseFormSubmit({
          ...defaultOptions,
          apiEndpoint: '/api/simple-expenses',
          redirectPath: '/expenses/simple',
        })
      );

      await act(async () => {
        await result.current.handleSubmit({
          ...mockExpenseData,
          status: 'DRAFT',
        });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/simple-expenses',
        expect.objectContaining({ method: 'POST' })
      );
      expect(mockPush).toHaveBeenCalledWith('/expenses/simple/simple-expense-id');
    });
  });

  describe('에러 처리', () => {
    it('네트워크 오류 처리', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      let submitResult: { success: boolean; error?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit(mockExpenseData);
      });

      expect(submitResult!.success).toBe(false);
      expect(submitResult!.error).toBe('Network error');
      expect(mockSetError).toHaveBeenCalledWith('Network error');
    });

    it('서버 오류 (non-JSON) 처리', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const { result } = renderHook(() => useExpenseFormSubmit(defaultOptions));

      let submitResult: { success: boolean; error?: string };
      await act(async () => {
        submitResult = await result.current.handleSubmit(mockExpenseData);
      });

      expect(submitResult!.error).toBe('서버 오류 (500): Internal Server Error');
    });

    it('검증 오류 (JSON) 처리', async () => {
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
        submitResult = await result.current.handleSubmit(mockExpenseData);
      });

      expect(submitResult!.error).toBe('검증 실패: 필수 필드 누락');
    });
  });
});
