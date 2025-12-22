/**
 * 지출결의서 폼 상태 관리 훅
 *
 * loading, error, fetchLoading, attachments 상태를 통합 관리합니다.
 * ExpenseForm과 SimpleExpenseForm에서 공통으로 사용합니다.
 */

'use client';

import { useState, useCallback } from 'react';
import { UploadedFile } from '@/lib/types';

interface UseExpenseFormStateResult {
  /** 폼 제출 중 로딩 상태 */
  loading: boolean;
  setLoading: (loading: boolean) => void;

  /** 에러 메시지 */
  error: string | null;
  setError: (error: string | null) => void;

  /** 데이터 fetch 중 로딩 상태 (수정 모드) */
  fetchLoading: boolean;
  setFetchLoading: (loading: boolean) => void;

  /** 첨부파일 목록 */
  attachments: UploadedFile[];
  setAttachments: (files: UploadedFile[]) => void;

  /** 에러 초기화 */
  clearError: () => void;

  /** 전체 초기화 */
  reset: () => void;
}

interface UseExpenseFormStateOptions {
  /** 수정 모드 여부 (expenseId 존재 시 true) */
  isEditMode?: boolean;
  /** 초기 첨부파일 */
  initialAttachments?: UploadedFile[];
}

export function useExpenseFormState(
  options: UseExpenseFormStateOptions = {}
): UseExpenseFormStateResult {
  const { isEditMode = false, initialAttachments = [] } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(isEditMode);
  const [attachments, setAttachments] = useState<UploadedFile[]>(initialAttachments);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setFetchLoading(false);
    setAttachments([]);
  }, []);

  return {
    loading,
    setLoading,
    error,
    setError,
    fetchLoading,
    setFetchLoading,
    attachments,
    setAttachments,
    clearError,
    reset,
  };
}

export default useExpenseFormState;
