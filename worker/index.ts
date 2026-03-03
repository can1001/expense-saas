/**
 * 커스텀 Service Worker
 *
 * next-pwa가 자동으로 이 파일을 병합합니다.
 * 백그라운드 동기화와 푸시 알림 처리를 담당합니다.
 */

declare let self: ServiceWorkerGlobalScope;

// 동기화 태그 상수
const SYNC_TAG_EXPENSES = 'sync-expenses';
const SYNC_TAG_ATTACHMENTS = 'sync-attachments';

/**
 * Service Worker 설치 이벤트
 */
self.addEventListener('install', (event) => {
  console.log('[SW] 설치됨');
  // 즉시 활성화
  self.skipWaiting();
});

/**
 * Service Worker 활성화 이벤트
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화됨');
  // 모든 클라이언트 즉시 제어
  event.waitUntil(self.clients.claim());
});

/**
 * 백그라운드 동기화 이벤트
 * 오프라인에서 온라인으로 복귀할 때 자동으로 트리거됩니다.
 */
self.addEventListener('sync', (event: SyncEvent) => {
  console.log('[SW] 동기화 이벤트:', event.tag);

  if (event.tag === SYNC_TAG_EXPENSES) {
    event.waitUntil(syncExpenses());
  } else if (event.tag === SYNC_TAG_ATTACHMENTS) {
    event.waitUntil(syncAttachments());
  }
});

/**
 * 푸시 알림 수신 이벤트
 */
self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] 푸시 알림 수신');

  if (!event.data) {
    console.warn('[SW] 푸시 데이터 없음');
    return;
  }

  try {
    const data = event.data.json() as PushNotificationData;

    const options: NotificationOptions = {
      body: data.body,
      icon: data.icon || '/logo.png',
      badge: '/logo.png',
      tag: data.tag || 'expense-notification',
      data: {
        url: data.url || '/',
        expenseId: data.expenseId,
      },
      actions: data.actions || [
        { action: 'open', title: '열기' },
        { action: 'close', title: '닫기' },
      ],
      vibrate: [200, 100, 200],
      requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (error) {
    console.error('[SW] 푸시 알림 처리 오류:', error);
  }
});

/**
 * 알림 클릭 이벤트
 */
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] 알림 클릭:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const url = (event.notification.data as { url?: string })?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // 이미 열린 창이 있으면 해당 창으로 포커스
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      // 열린 창이 없으면 새 창 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

/**
 * 메시지 이벤트 (클라이언트와 통신)
 */
self.addEventListener('message', (event) => {
  console.log('[SW] 메시지 수신:', event.data);

  const { type, payload } = event.data as {
    type: string;
    payload?: unknown;
  };

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'REQUEST_SYNC':
      // 백그라운드 동기화 등록
      if ('sync' in self.registration) {
        self.registration.sync
          .register(SYNC_TAG_EXPENSES)
          .then(() => {
            console.log('[SW] 동기화 등록 완료');
            notifyClients({ type: 'SYNC_REGISTERED' });
          })
          .catch((error) => {
            console.error('[SW] 동기화 등록 실패:', error);
          });
      } else {
        // Background Sync 미지원 브라우저
        console.warn('[SW] Background Sync 미지원');
        // 즉시 동기화 시도
        syncExpenses().then(() => {
          notifyClients({ type: 'SYNC_COMPLETED' });
        });
      }
      break;

    case 'GET_PENDING_COUNT':
      // 대기 중인 동기화 항목 수 조회
      getPendingSyncCount().then((count) => {
        notifyClients({ type: 'PENDING_COUNT', payload: { count } });
      });
      break;
  }
});

/**
 * 지출결의서 동기화 실행
 */
async function syncExpenses(): Promise<void> {
  console.log('[SW] 지출결의서 동기화 시작');

  try {
    // IndexedDB에서 대기 중인 항목 조회
    const pendingExpenses = await getPendingExpensesFromDB();

    if (pendingExpenses.length === 0) {
      console.log('[SW] 동기화할 항목 없음');
      return;
    }

    console.log(`[SW] ${pendingExpenses.length}개 항목 동기화 중...`);

    let successCount = 0;
    let failCount = 0;

    for (const expense of pendingExpenses) {
      try {
        // API 호출
        const response = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...expense.data,
            status: 'PENDING',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          // 동기화 성공 처리
          await markExpenseAsSynced(expense.localId, result.id);
          successCount++;
        } else {
          const errorData = await response.json();
          await markExpenseAsFailed(expense.localId, errorData.error);
          failCount++;
        }
      } catch (error) {
        console.error(`[SW] 항목 동기화 실패:`, error);
        await markExpenseAsFailed(
          expense.localId,
          error instanceof Error ? error.message : '알 수 없는 오류'
        );
        failCount++;
      }

      // API 부하 방지를 위한 딜레이
      await delay(500);
    }

    console.log(`[SW] 동기화 완료: 성공 ${successCount}, 실패 ${failCount}`);

    // 클라이언트에 결과 알림
    notifyClients({
      type: 'SYNC_COMPLETED',
      payload: { successCount, failCount },
    });
  } catch (error) {
    console.error('[SW] 동기화 오류:', error);
    notifyClients({
      type: 'SYNC_ERROR',
      payload: { error: error instanceof Error ? error.message : '동기화 실패' },
    });
  }
}

/**
 * 첨부파일 동기화 실행
 */
async function syncAttachments(): Promise<void> {
  console.log('[SW] 첨부파일 동기화 시작');
  // TODO: 첨부파일 업로드 로직 구현
}

/**
 * IndexedDB에서 대기 중인 지출결의서 조회
 */
async function getPendingExpensesFromDB(): Promise<PendingExpense[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ExpenseSystemDB', 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('expenses')) {
        resolve([]);
        return;
      }

      const transaction = db.transaction('expenses', 'readonly');
      const store = transaction.objectStore('expenses');
      const index = store.index('status');
      const getRequest = index.getAll('pending_sync');

      getRequest.onsuccess = () => resolve(getRequest.result || []);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

/**
 * 지출결의서를 동기화 완료로 표시
 */
async function markExpenseAsSynced(
  localId: string,
  serverId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ExpenseSystemDB', 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('expenses', 'readwrite');
      const store = transaction.objectStore('expenses');

      const getRequest = store.get(localId);

      getRequest.onsuccess = () => {
        const expense = getRequest.result;
        if (expense) {
          expense.status = 'synced';
          expense.serverId = serverId;
          expense.syncMeta.lastAttemptAt = Date.now();
          expense.updatedAt = Date.now();

          const putRequest = store.put(expense);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
    };
  });
}

/**
 * 지출결의서를 동기화 실패로 표시
 */
async function markExpenseAsFailed(
  localId: string,
  error: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ExpenseSystemDB', 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('expenses', 'readwrite');
      const store = transaction.objectStore('expenses');

      const getRequest = store.get(localId);

      getRequest.onsuccess = () => {
        const expense = getRequest.result;
        if (expense) {
          expense.status = 'failed';
          expense.syncMeta.attempts += 1;
          expense.syncMeta.lastAttemptAt = Date.now();
          expense.syncMeta.lastError = error;
          expense.updatedAt = Date.now();

          const putRequest = store.put(expense);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
    };
  });
}

/**
 * 대기 중인 동기화 항목 수 조회
 */
async function getPendingSyncCount(): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ExpenseSystemDB', 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('expenses')) {
        resolve(0);
        return;
      }

      const transaction = db.transaction('expenses', 'readonly');
      const store = transaction.objectStore('expenses');
      const index = store.index('status');
      const countRequest = index.count('pending_sync');

      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    };
  });
}

/**
 * 모든 클라이언트에 메시지 전송
 */
async function notifyClients(message: { type: string; payload?: unknown }) {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => client.postMessage(message));
}

/**
 * 딜레이 유틸리티
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 타입 정의
interface SyncEvent extends ExtendableEvent {
  tag: string;
}

interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
  expenseId?: string;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
}

interface PendingExpense {
  localId: string;
  serverId?: string;
  data: Record<string, unknown>;
  status: string;
  syncMeta: {
    attempts: number;
    lastAttemptAt?: number;
    lastError?: string;
  };
}

// ServiceWorkerGlobalScope 타입 확장
declare global {
  interface ServiceWorkerRegistration {
    sync: {
      register(tag: string): Promise<void>;
      getTags(): Promise<string[]>;
    };
  }
}

export {};
