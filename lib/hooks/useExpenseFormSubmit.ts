/**
 * 지출결의서 폼 제출 훅
 *
 * 폼 제출 로직을 통합 관리합니다.
 * ExpenseForm과 SimpleExpenseForm에서 공통으로 사용합니다.
 */

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UploadedFile } from '@/lib/types';

interface UseExpenseFormSubmitOptions {
  /** 수정 모드용 expense ID */
  expenseId?: string;
  /** API 엔드포인트 베이스 (예: '/api/expenses', '/api/simple-expenses') */
  apiEndpoint: string;
  /** 성공 후 리다이렉트 경로 베이스 (예: '/expenses', '/expenses/simple') */
  redirectPath: string;
  /** 첨부파일 목록 */
  attachments: UploadedFile[];
  /** 로딩 상태 설정 */
  setLoading: (loading: boolean) => void;
  /** 에러 상태 설정 */
  setError: (error: string | null) => void;
  /** 첨부파일 저장 함수 (선택적, 커스텀 로직용) */
  saveAttachments?: (expenseId: string, attachments: UploadedFile[]) => Promise<void>;
}

interface SubmitResult {
  success: boolean;
  id?: string;
  error?: string;
}

export function useExpenseFormSubmit(options: UseExpenseFormSubmitOptions) {
  const {
    expenseId,
    apiEndpoint,
    redirectPath,
    attachments,
    setLoading,
    setError,
    saveAttachments,
  } = options;

  const router = useRouter();

  const handleSubmit = useCallback(
    async <T extends Record<string, unknown>>(data: T): Promise<SubmitResult> => {
      setError(null);

      try {
        setLoading(true);

        const isEditMode = !!expenseId;
        const isSubmit = data.status === 'PENDING';

        // 수정 모드 + 제출: 2단계 호출 (PUT으로 저장 → submit API로 결재선 생성)
        if (isEditMode && isSubmit) {
          // Step 1: PUT으로 데이터 저장 (status: DRAFT)
          const saveResponse = await fetch(`${apiEndpoint}/${expenseId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...data,
              status: 'DRAFT', // 저장만 먼저
              expenseDate: (data.expenseDate as string | null) || null,
            }),
          });

          if (!saveResponse.ok) {
            const responseText = await saveResponse.text();
            let errorMsg = '저장에 실패했습니다.';
            try {
              const errorData = JSON.parse(responseText);
              errorMsg = errorData.details
                ? `${errorData.error}: ${errorData.details}`
                : errorData.error || '저장에 실패했습니다.';
            } catch {
              errorMsg = `서버 오류 (${saveResponse.status}): ${responseText || '응답 없음'}`;
            }
            throw new Error(errorMsg);
          }

          // Step 2: submit API 호출로 결재선 생성
          const submitResponse = await fetch(`${apiEndpoint}/${expenseId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!submitResponse.ok) {
            const responseText = await submitResponse.text();
            let errorMsg = '제출에 실패했습니다.';
            try {
              const errorData = JSON.parse(responseText);
              errorMsg = errorData.details
                ? `${errorData.error}: ${errorData.details}`
                : errorData.error || '제출에 실패했습니다.';
            } catch {
              errorMsg = `서버 오류 (${submitResponse.status}): ${responseText || '응답 없음'}`;
            }
            throw new Error(errorMsg);
          }

          alert('지출결의서가 성공적으로 제출되었습니다.');
          router.push(`${redirectPath}/${expenseId}`);
          return { success: true, id: expenseId };
        }

        // 기존 로직: 신규 생성 또는 저장
        const url = expenseId ? `${apiEndpoint}/${expenseId}` : apiEndpoint;
        const method = expenseId ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            expenseDate: (data.expenseDate as string | null) || null,
          }),
        });

        if (!response.ok) {
          const responseText = await response.text();
          let errorMsg = '저장에 실패했습니다.';
          try {
            const errorData = JSON.parse(responseText);
            errorMsg = errorData.details
              ? `${errorData.error}: ${errorData.details}`
              : errorData.error || '저장에 실패했습니다.';
          } catch {
            errorMsg = `서버 오류 (${response.status}): ${responseText || '응답 없음'}`;
          }
          throw new Error(errorMsg);
        }

        const result = await response.json();

        // 새 지출결의서 생성 시 첨부파일 저장
        if (!expenseId && attachments.length > 0) {
          const unsavedAttachments = attachments.filter((att) => !att.id);
          if (unsavedAttachments.length > 0) {
            try {
              if (saveAttachments) {
                await saveAttachments(result.id, unsavedAttachments);
              } else {
                // 기본 첨부파일 저장 로직
                await Promise.all(
                  unsavedAttachments.map((att) =>
                    fetch('/api/attachments', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        expenseId: result.id,
                        ...att,
                      }),
                    })
                  )
                );
              }
            } catch (attachmentError) {
              console.error('첨부파일 저장 오류:', attachmentError);
              // 첨부파일 저장 실패해도 지출결의서는 이미 생성됨
            }
          }
        }

        alert(
          isSubmit
            ? '지출결의서가 성공적으로 제출되었습니다.'
            : expenseId
              ? '지출결의서가 성공적으로 수정되었습니다.'
              : '지출결의서가 성공적으로 등록되었습니다.'
        );

        router.push(`${redirectPath}/${result.id}`);

        return { success: true, id: result.id };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [expenseId, apiEndpoint, redirectPath, attachments, setLoading, setError, saveAttachments, router]
  );

  return { handleSubmit };
}

export default useExpenseFormSubmit;
