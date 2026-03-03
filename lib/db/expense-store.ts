/**
 * 오프라인 지출결의서 저장소
 * IndexedDB CRUD 작업
 */

import { v4 as uuidv4 } from 'uuid';
import { getDB } from './index';
import type {
  OfflineExpense,
  OfflineExpenseFormData,
  OfflineExpenseStatus,
  SyncQueueItem,
  SyncAction,
} from './types';

/**
 * 새 오프라인 지출결의서 생성
 */
export async function createOfflineExpense(
  data: OfflineExpenseFormData,
  status: OfflineExpenseStatus = 'draft'
): Promise<OfflineExpense> {
  const db = getDB();
  const now = Date.now();

  const expense: OfflineExpense = {
    localId: uuidv4(),
    data,
    status,
    syncMeta: {
      attempts: 0,
    },
    localVersion: 1,
    createdAt: now,
    updatedAt: now,
  };

  await db.expenses.add(expense);

  // 동기화 대기 상태면 큐에 추가
  if (status === 'pending_sync') {
    await addToSyncQueue(expense.localId, 'create');
  }

  return expense;
}

/**
 * 오프라인 지출결의서 업데이트
 */
export async function updateOfflineExpense(
  localId: string,
  data: Partial<OfflineExpenseFormData>,
  markForSync: boolean = false
): Promise<OfflineExpense | undefined> {
  const db = getDB();
  const existing = await db.expenses.get(localId);

  if (!existing) {
    console.warn(`[OfflineStore] 지출결의서를 찾을 수 없음: ${localId}`);
    return undefined;
  }

  const now = Date.now();
  const updated: OfflineExpense = {
    ...existing,
    data: { ...existing.data, ...data },
    status: markForSync ? 'pending_sync' : existing.status,
    localVersion: existing.localVersion + 1,
    updatedAt: now,
  };

  await db.expenses.put(updated);

  // 동기화 대기 상태로 변경되면 큐에 추가
  if (markForSync && existing.status !== 'pending_sync') {
    const action: SyncAction = existing.serverId ? 'update' : 'create';
    await addToSyncQueue(localId, action);
  }

  return updated;
}

/**
 * 오프라인 지출결의서 삭제
 */
export async function deleteOfflineExpense(localId: string): Promise<boolean> {
  const db = getDB();

  // 연결된 첨부파일도 삭제
  await db.attachments.where('expenseLocalId').equals(localId).delete();

  // 관련 동기화 큐 항목 삭제
  await db.syncQueue.where('expenseLocalId').equals(localId).delete();

  // 지출결의서 삭제
  await db.expenses.delete(localId);

  return true;
}

/**
 * localId로 지출결의서 조회
 */
export async function getOfflineExpense(
  localId: string
): Promise<OfflineExpense | undefined> {
  const db = getDB();
  return db.expenses.get(localId);
}

/**
 * serverId로 지출결의서 조회
 */
export async function getOfflineExpenseByServerId(
  serverId: string
): Promise<OfflineExpense | undefined> {
  const db = getDB();
  return db.expenses.where('serverId').equals(serverId).first();
}

/**
 * 상태별 지출결의서 목록 조회
 */
export async function getOfflineExpensesByStatus(
  status: OfflineExpenseStatus
): Promise<OfflineExpense[]> {
  const db = getDB();
  return db.expenses.where('status').equals(status).toArray();
}

/**
 * 모든 임시저장(draft) 지출결의서 조회
 */
export async function getDraftExpenses(): Promise<OfflineExpense[]> {
  return getOfflineExpensesByStatus('draft');
}

/**
 * 동기화 대기 중인 지출결의서 조회
 */
export async function getPendingSyncExpenses(): Promise<OfflineExpense[]> {
  return getOfflineExpensesByStatus('pending_sync');
}

/**
 * 모든 오프라인 지출결의서 조회
 */
export async function getAllOfflineExpenses(): Promise<OfflineExpense[]> {
  const db = getDB();
  return db.expenses.orderBy('updatedAt').reverse().toArray();
}

/**
 * 오프라인 지출결의서 개수 조회
 */
export async function getOfflineExpenseCount(): Promise<number> {
  const db = getDB();
  return db.expenses.count();
}

/**
 * 동기화 대기 중인 항목 개수 조회
 */
export async function getPendingSyncCount(): Promise<number> {
  const db = getDB();
  return db.expenses.where('status').equals('pending_sync').count();
}

/**
 * 동기화 상태 업데이트
 */
export async function updateSyncStatus(
  localId: string,
  status: OfflineExpenseStatus,
  serverId?: string,
  error?: string
): Promise<void> {
  const db = getDB();
  const existing = await db.expenses.get(localId);

  if (!existing) return;

  const now = Date.now();
  const updated: OfflineExpense = {
    ...existing,
    status,
    serverId: serverId || existing.serverId,
    syncMeta: {
      ...existing.syncMeta,
      attempts: existing.syncMeta.attempts + 1,
      lastAttemptAt: now,
      lastError: error,
    },
    updatedAt: now,
  };

  await db.expenses.put(updated);
}

/**
 * 동기화 완료 처리
 */
export async function markAsSynced(
  localId: string,
  serverId: string,
  serverVersion?: string
): Promise<void> {
  const db = getDB();
  const existing = await db.expenses.get(localId);

  if (!existing) return;

  const now = Date.now();
  const updated: OfflineExpense = {
    ...existing,
    status: 'synced',
    serverId,
    syncMeta: {
      ...existing.syncMeta,
      lastAttemptAt: now,
      lastError: undefined,
      serverVersion,
    },
    updatedAt: now,
  };

  await db.expenses.put(updated);

  // 관련 동기화 큐 항목 완료 처리
  await db.syncQueue
    .where('expenseLocalId')
    .equals(localId)
    .modify({ status: 'completed', processedAt: now });
}

/**
 * 동기화 큐에 항목 추가
 */
async function addToSyncQueue(
  expenseLocalId: string,
  action: SyncAction
): Promise<void> {
  const db = getDB();
  const now = Date.now();

  // 이미 대기 중인 항목이 있는지 확인
  const existing = await db.syncQueue
    .where('expenseLocalId')
    .equals(expenseLocalId)
    .and((item) => item.status === 'pending')
    .first();

  if (existing) {
    // 기존 항목 업데이트
    await db.syncQueue.update(existing.id, {
      action,
      createdAt: now,
    });
  } else {
    // 새 항목 추가
    const queueItem: SyncQueueItem = {
      id: uuidv4(),
      expenseLocalId,
      action,
      status: 'pending',
      priority: action === 'create' ? 1 : action === 'update' ? 2 : 3,
      retryCount: 0,
      maxRetries: 5,
      createdAt: now,
    };

    await db.syncQueue.add(queueItem);
  }
}

/**
 * 오래된 동기화 완료 데이터 정리 (30일 이상)
 */
export async function cleanupOldSyncedExpenses(
  daysToKeep: number = 30
): Promise<number> {
  const db = getDB();
  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  const oldExpenses = await db.expenses
    .where('status')
    .equals('synced')
    .and((expense) => expense.updatedAt < cutoffTime)
    .toArray();

  for (const expense of oldExpenses) {
    await deleteOfflineExpense(expense.localId);
  }

  return oldExpenses.length;
}
