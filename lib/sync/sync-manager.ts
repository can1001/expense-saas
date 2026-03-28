/**
 * 동기화 매니저
 *
 * 오프라인 데이터와 서버 간의 동기화를 관리합니다.
 */

'use client';

import {
  getPendingSyncExpenses,
  markAsSynced,
  updateSyncStatus,
} from '@/lib/db/expense-store';
import {
  getAttachmentsByExpense,
  updateAttachmentStatus,
  attachmentToFile,
} from '@/lib/db/attachment-store';
import type { OfflineExpense, SyncResult } from '@/lib/db/types';

// 동기화 설정
const SYNC_CONFIG = {
  maxRetries: 5,
  retryDelayMs: 1000,
  batchSize: 5,
  requestDelayMs: 500,
};

/**
 * 동기화 매니저 클래스
 */
export class SyncManager {
  private isSyncing: boolean = false;
  private listeners: Set<(event: SyncEvent) => void> = new Set();

  /**
   * 동기화 이벤트 리스너 등록
   */
  addListener(callback: (event: SyncEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * 이벤트 발생
   */
  private emit(event: SyncEvent): void {
    this.listeners.forEach((callback) => callback(event));
  }

  /**
   * 동기화 중 여부
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * 백그라운드 동기화 등록
   */
  async registerBackgroundSync(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      if ('sync' in registration) {
        await (registration as ServiceWorkerRegistrationWithSync).sync.register(
          'sync-expenses'
        );
        console.log('[SyncManager] 백그라운드 동기화 등록됨');
        return true;
      }
    } catch (error) {
      console.error('[SyncManager] 백그라운드 동기화 등록 실패:', error);
    }

    return false;
  }

  /**
   * 모든 대기 항목 동기화
   */
  async syncAll(): Promise<SyncResult[]> {
    if (this.isSyncing) {
      console.log('[SyncManager] 이미 동기화 중');
      return [];
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[SyncManager] 오프라인 상태');
      return [];
    }

    this.isSyncing = true;
    this.emit({ type: 'sync_started' });

    const results: SyncResult[] = [];

    try {
      const pendingExpenses = await getPendingSyncExpenses();

      if (pendingExpenses.length === 0) {
        console.log('[SyncManager] 동기화할 항목 없음');
        return results;
      }

      console.log(`[SyncManager] ${pendingExpenses.length}개 항목 동기화 시작`);

      for (let i = 0; i < pendingExpenses.length; i++) {
        const expense = pendingExpenses[i];

        this.emit({
          type: 'sync_progress',
          payload: {
            current: i + 1,
            total: pendingExpenses.length,
            localId: expense.localId,
          },
        });

        const result = await this.syncOne(expense);
        results.push(result);

        // 요청 간 딜레이
        if (i < pendingExpenses.length - 1) {
          await this.delay(SYNC_CONFIG.requestDelayMs);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      this.emit({
        type: 'sync_completed',
        payload: { successCount, failCount, results },
      });

      console.log(
        `[SyncManager] 동기화 완료: 성공 ${successCount}, 실패 ${failCount}`
      );
    } catch (error) {
      console.error('[SyncManager] 동기화 오류:', error);
      this.emit({
        type: 'sync_error',
        payload: {
          error: error instanceof Error ? error.message : '동기화 실패',
        },
      });
    } finally {
      this.isSyncing = false;
    }

    return results;
  }

  /**
   * 단일 항목 동기화
   */
  async syncOne(expense: OfflineExpense): Promise<SyncResult> {
    const { localId, serverId, data, syncMeta } = expense;

    // 최대 재시도 횟수 초과 확인
    if (syncMeta.attempts >= SYNC_CONFIG.maxRetries) {
      return {
        success: false,
        localId,
        action: serverId ? 'update' : 'create',
        error: '최대 재시도 횟수 초과',
      };
    }

    try {
      await updateSyncStatus(localId, 'syncing');

      // 1. 첨부파일 업로드
      const attachments = await getAttachmentsByExpense(localId);
      const uploadedFiles: Array<{ id: string; url: string }> = [];

      for (const att of attachments) {
        if (att.status === 'pending') {
          try {
            const file = attachmentToFile(att);
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (response.ok) {
              const result = await response.json();
              uploadedFiles.push({ id: result.id, url: result.url });
              await updateAttachmentStatus(att.localId, 'uploaded', result);
            } else {
              await updateAttachmentStatus(att.localId, 'failed');
            }
          } catch (error) {
            console.error('[SyncManager] 첨부파일 업로드 실패:', error);
            await updateAttachmentStatus(
              att.localId,
              'failed',
              undefined,
              error instanceof Error ? error.message : '업로드 실패'
            );
          }
        } else if (att.uploadResult) {
          uploadedFiles.push(att.uploadResult);
        }
      }

      // 2. 지출결의서 생성/수정
      const isUpdate = !!serverId;
      const url = isUpdate ? `/api/expenses/${serverId}` : '/api/expenses';
      const method = isUpdate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          attachments: uploadedFiles,
          status: 'PENDING',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '서버 오류');
      }

      const result = await response.json();

      // 3. 동기화 완료 처리
      await markAsSynced(localId, result.id);

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
        action: serverId ? 'update' : 'create',
        error: errorMessage,
      };
    }
  }

  /**
   * Service Worker 메시지 수신 설정
   */
  setupServiceWorkerListener(): () => void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return () => {};
    }

    const handler = (event: MessageEvent) => {
      const { type, payload } = event.data as {
        type: string;
        payload?: unknown;
      };

      switch (type) {
        case 'SYNC_COMPLETED':
          this.emit({ type: 'sync_completed', payload: payload as SyncCompletedPayload });
          break;
        case 'SYNC_ERROR':
          this.emit({ type: 'sync_error', payload: payload as SyncErrorPayload });
          break;
        case 'PENDING_COUNT':
          this.emit({ type: 'pending_count_updated', payload: payload as { count: number } });
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handler);
    };
  }

  /**
   * Service Worker에 메시지 전송
   */
  async postMessageToSW(message: { type: string; payload?: unknown }): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage(message);
  }

  /**
   * 딜레이 유틸리티
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 타입 정의
interface SyncCompletedPayload {
  successCount: number;
  failCount: number;
  results?: SyncResult[];
}

interface SyncErrorPayload {
  error: string;
}

type SyncEvent =
  | { type: 'sync_started' }
  | { type: 'sync_progress'; payload: { current: number; total: number; localId: string } }
  | { type: 'sync_completed'; payload: SyncCompletedPayload }
  | { type: 'sync_error'; payload: SyncErrorPayload }
  | { type: 'pending_count_updated'; payload: { count: number } };

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
  sync: {
    register(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
  };
}

// 싱글톤 인스턴스
export const syncManager = new SyncManager();
