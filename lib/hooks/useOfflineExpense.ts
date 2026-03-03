'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  createOfflineExpense,
  updateOfflineExpense,
  deleteOfflineExpense,
  getOfflineExpense,
  getDraftExpenses,
  getPendingSyncExpenses,
  getPendingSyncCount,
  markAsSynced,
  updateSyncStatus,
  getAllOfflineExpenses,
} from '@/lib/db/expense-store';
import {
  saveOfflineAttachments,
  getAttachmentsByExpense,
  deleteAttachmentsByExpense,
  attachmentToFile,
} from '@/lib/db/attachment-store';
import { initDatabase } from '@/lib/db';
import type {
  OfflineExpense,
  OfflineExpenseFormData,
  OfflineAttachment,
  SyncResult,
} from '@/lib/db/types';

interface UseOfflineExpenseReturn {
  /** 데이터베이스 초기화 완료 여부 */
  isReady: boolean;

  /** 동기화 중 여부 */
  isSyncing: boolean;

  /** 동기화 대기 중인 항목 수 */
  pendingCount: number;

  /** 마지막 동기화 시간 */
  lastSyncAt: Date | null;

  /** 임시저장으로 저장 */
  saveDraft: (
    data: OfflineExpenseFormData,
    files?: File[]
  ) => Promise<string>;

  /** 동기화 대기 상태로 저장 */
  saveForSync: (
    data: OfflineExpenseFormData,
    files?: File[]
  ) => Promise<string>;

  /** 기존 오프라인 데이터 업데이트 */
  updateDraft: (
    localId: string,
    data: Partial<OfflineExpenseFormData>
  ) => Promise<boolean>;

  /** 오프라인 데이터 삭제 */
  deleteDraft: (localId: string) => Promise<boolean>;

  /** localId로 조회 */
  getByLocalId: (localId: string) => Promise<OfflineExpense | undefined>;

  /** 모든 임시저장 목록 조회 */
  getDrafts: () => Promise<OfflineExpense[]>;

  /** 동기화 대기 목록 조회 */
  getPendingSync: () => Promise<OfflineExpense[]>;

  /** 첨부파일 목록 조회 */
  getAttachments: (localId: string) => Promise<OfflineAttachment[]>;

  /** 단일 항목 동기화 */
  syncOne: (localId: string) => Promise<SyncResult>;

  /** 모든 대기 항목 동기화 */
  syncAll: () => Promise<SyncResult[]>;

  /** 동기화 대기 수 새로고침 */
  refreshPendingCount: () => Promise<void>;
}

/**
 * 오프라인 지출결의서 관리 훅
 *
 * @example
 * const {
 *   isReady,
 *   pendingCount,
 *   saveDraft,
 *   saveForSync,
 *   syncAll,
 * } = useOfflineExpense();
 *
 * // 임시저장
 * const localId = await saveDraft(formData, attachmentFiles);
 *
 * // 동기화용 저장 (오프라인일 때)
 * const localId = await saveForSync(formData, attachmentFiles);
 *
 * // 온라인 복귀 시 동기화
 * const results = await syncAll();
 */
export function useOfflineExpense(): UseOfflineExpenseReturn {
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // 데이터베이스 초기화
  useEffect(() => {
    if (typeof window === 'undefined') return;

    initDatabase()
      .then((success) => {
        setIsReady(success);
        if (success) {
          refreshPendingCount();
        }
      })
      .catch((error) => {
        console.error('[useOfflineExpense] 초기화 실패:', error);
      });
  }, []);

  // 동기화 대기 수 새로고침
  const refreshPendingCount = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch (error) {
      console.error('[useOfflineExpense] 대기 수 조회 실패:', error);
    }
  }, []);

  // 임시저장
  const saveDraft = useCallback(
    async (data: OfflineExpenseFormData, files?: File[]): Promise<string> => {
      const expense = await createOfflineExpense(data, 'draft');

      // 첨부파일 저장
      if (files && files.length > 0) {
        await saveOfflineAttachments(expense.localId, files);
      }

      return expense.localId;
    },
    []
  );

  // 동기화 대기 상태로 저장
  const saveForSync = useCallback(
    async (data: OfflineExpenseFormData, files?: File[]): Promise<string> => {
      const expense = await createOfflineExpense(data, 'pending_sync');

      // 첨부파일 저장
      if (files && files.length > 0) {
        await saveOfflineAttachments(expense.localId, files);
      }

      await refreshPendingCount();
      return expense.localId;
    },
    [refreshPendingCount]
  );

  // 기존 데이터 업데이트
  const updateDraft = useCallback(
    async (
      localId: string,
      data: Partial<OfflineExpenseFormData>
    ): Promise<boolean> => {
      const updated = await updateOfflineExpense(localId, data);
      return !!updated;
    },
    []
  );

  // 삭제
  const deleteDraft = useCallback(
    async (localId: string): Promise<boolean> => {
      const result = await deleteOfflineExpense(localId);
      await refreshPendingCount();
      return result;
    },
    [refreshPendingCount]
  );

  // localId로 조회
  const getByLocalId = useCallback(
    async (localId: string): Promise<OfflineExpense | undefined> => {
      return getOfflineExpense(localId);
    },
    []
  );

  // 임시저장 목록 조회
  const getDrafts = useCallback(async (): Promise<OfflineExpense[]> => {
    return getDraftExpenses();
  }, []);

  // 동기화 대기 목록 조회
  const getPendingSync = useCallback(async (): Promise<OfflineExpense[]> => {
    return getPendingSyncExpenses();
  }, []);

  // 첨부파일 목록 조회
  const getAttachments = useCallback(
    async (localId: string): Promise<OfflineAttachment[]> => {
      return getAttachmentsByExpense(localId);
    },
    []
  );

  // 단일 항목 동기화
  const syncOne = useCallback(
    async (localId: string): Promise<SyncResult> => {
      const expense = await getOfflineExpense(localId);

      if (!expense) {
        return {
          success: false,
          localId,
          action: 'create',
          error: '오프라인 데이터를 찾을 수 없습니다.',
        };
      }

      try {
        await updateSyncStatus(localId, 'syncing');

        // 첨부파일 업로드
        const attachments = await getAttachmentsByExpense(localId);
        const uploadedFiles: { id: string; url: string }[] = [];

        for (const att of attachments) {
          if (att.status === 'pending') {
            const file = attachmentToFile(att);
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (response.ok) {
              const result = await response.json();
              uploadedFiles.push(result);
            }
          } else if (att.uploadResult) {
            uploadedFiles.push(att.uploadResult);
          }
        }

        // 지출결의서 생성/수정
        const isUpdate = !!expense.serverId;
        const url = isUpdate
          ? `/api/expenses/${expense.serverId}`
          : '/api/expenses';
        const method = isUpdate ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...expense.data,
            attachments: uploadedFiles,
            status: 'PENDING',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '동기화 실패');
        }

        const result = await response.json();
        await markAsSynced(localId, result.id);
        await refreshPendingCount();

        return {
          success: true,
          localId,
          serverId: result.id,
          action: isUpdate ? 'update' : 'create',
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '알 수 없는 오류';
        await updateSyncStatus(localId, 'failed', undefined, errorMessage);

        return {
          success: false,
          localId,
          action: expense.serverId ? 'update' : 'create',
          error: errorMessage,
        };
      }
    },
    [refreshPendingCount]
  );

  // 모든 대기 항목 동기화
  const syncAll = useCallback(async (): Promise<SyncResult[]> => {
    if (isSyncing) {
      return [];
    }

    setIsSyncing(true);
    const results: SyncResult[] = [];

    try {
      const pendingExpenses = await getPendingSyncExpenses();

      for (const expense of pendingExpenses) {
        const result = await syncOne(expense.localId);
        results.push(result);

        // 연속 요청 방지를 위한 딜레이
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setLastSyncAt(new Date());
    } catch (error) {
      console.error('[useOfflineExpense] 전체 동기화 실패:', error);
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }

    return results;
  }, [isSyncing, syncOne, refreshPendingCount]);

  return {
    isReady,
    isSyncing,
    pendingCount,
    lastSyncAt,
    saveDraft,
    saveForSync,
    updateDraft,
    deleteDraft,
    getByLocalId,
    getDrafts,
    getPendingSync,
    getAttachments,
    syncOne,
    syncAll,
    refreshPendingCount,
  };
}

export default useOfflineExpense;
