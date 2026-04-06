/**
 * 지출결의서 폼 제출 훅
 *
 * 폼 제출 로직을 통합 관리합니다.
 *
 * 오프라인 지원:
 * - 네트워크가 없으면 IndexedDB에 저장
 * - 온라인 복귀 시 자동 동기화 가능
 */

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UploadedFile } from '@/lib/types';
import type { OfflineExpenseFormData, OfflineExpenseItem } from '@/lib/db/types';

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
  /** 오프라인 저장 활성화 여부 (기본값: true) */
  enableOffline?: boolean;
  /** 첨부파일 File 객체 목록 (오프라인 저장용) */
  attachmentFiles?: File[];
}

interface SubmitResult {
  success: boolean;
  id?: string;
  localId?: string;
  isOffline?: boolean;
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
    enableOffline = true,
    attachmentFiles,
  } = options;

  const router = useRouter();

  /**
   * 오프라인 상태에서 IndexedDB에 저장
   */
  const saveOffline = useCallback(
    async <T extends Record<string, unknown>>(data: T): Promise<SubmitResult> => {
      try {
        // 동적 import로 IndexedDB 모듈 로드 (SSR 방지)
        const { createOfflineExpense } = await import('@/lib/db/expense-store');
        const { saveOfflineAttachments } = await import('@/lib/db/attachment-store');
        const { v4: uuidv4 } = await import('uuid');

        // 폼 데이터를 오프라인 형식으로 변환
        const offlineData: OfflineExpenseFormData = {
          committee: data.committee as string | undefined,
          department: data.department as string | undefined,
          expenseDate: data.expenseDate as string | undefined,
          applicantName: data.applicantName as string,
          applicantTitle: data.applicantTitle as string | undefined,
          bankName: data.bankName as string,
          accountNumber: data.accountNumber as string,
          accountHolder: data.accountHolder as string,
          items: ((data.items as Array<Record<string, unknown>>) || []).map(
            (item, index): OfflineExpenseItem => ({
              localId: uuidv4(),
              budgetDetailId: item.budgetDetailId as string | undefined,
              budgetCategory: item.budgetCategory as string | undefined,
              budgetSubcategory: item.budgetSubcategory as string | undefined,
              budgetDetail: item.budgetDetail as string | undefined,
              description: item.description as string,
              unitPrice: item.unitPrice as number,
              quantity: item.quantity as number,
              amount: item.amount as number,
              order: index,
            })
          ),
        };

        // 오프라인 저장 (제출 상태면 pending_sync, 아니면 draft)
        const isSubmit = data.status === 'PENDING';
        const expense = await createOfflineExpense(
          offlineData,
          isSubmit ? 'pending_sync' : 'draft'
        );

        // 첨부파일 저장
        if (attachmentFiles && attachmentFiles.length > 0) {
          await saveOfflineAttachments(expense.localId, attachmentFiles);
        }

        return {
          success: true,
          localId: expense.localId,
          isOffline: true,
        };
      } catch (err) {
        console.error('[useExpenseFormSubmit] 오프라인 저장 실패:', err);
        return {
          success: false,
          isOffline: true,
          error: err instanceof Error ? err.message : '오프라인 저장 실패',
        };
      }
    },
    [attachmentFiles]
  );

  const handleSubmit = useCallback(
    async <T extends Record<string, unknown>>(data: T): Promise<SubmitResult> => {
      setError(null);

      try {
        setLoading(true);

        // 오프라인 체크: 네트워크가 없으면 로컬에 저장
        if (enableOffline && typeof navigator !== 'undefined' && !navigator.onLine) {
          const offlineResult = await saveOffline(data);

          if (offlineResult.success) {
            alert('인터넷 연결이 없습니다. 데이터가 기기에 저장되었으며, 연결 시 자동으로 동기화됩니다.');
            router.push(redirectPath);
          } else {
            setError(offlineResult.error || '오프라인 저장에 실패했습니다.');
          }

          return offlineResult;
        }

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
    [expenseId, apiEndpoint, redirectPath, attachments, setLoading, setError, saveAttachments, router, enableOffline, saveOffline]
  );

  return { handleSubmit };
}

export default useExpenseFormSubmit;
