/**
 * IndexedDB 설정 (Dexie.js)
 * 오프라인 데이터 저장을 위한 클라이언트 데이터베이스
 */

import Dexie, { type Table } from 'dexie';
import type {
  OfflineExpense,
  OfflineAttachment,
  SyncQueueItem,
  SyncMeta,
} from './types';
import type {
  FavoriteBudget,
  RecentBudgetUsage,
} from './budget-preferences-types';

// 데이터베이스 클래스 정의
class ExpenseDatabase extends Dexie {
  // 테이블 정의
  expenses!: Table<OfflineExpense, string>;
  attachments!: Table<OfflineAttachment, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMeta!: Table<SyncMeta, string>;
  // 예산 세목 즐겨찾기 및 최근 사용
  favoriteBudgets!: Table<FavoriteBudget, string>;
  recentBudgetUsage!: Table<RecentBudgetUsage, string>;

  constructor() {
    super('ExpenseSystemDB');

    // 스키마 버전 1
    this.version(1).stores({
      // 지출결의서: localId를 primary key로, serverId와 status에 인덱스
      expenses: 'localId, serverId, status, updatedAt',

      // 첨부파일: localId를 primary key로, expenseLocalId와 status에 인덱스
      attachments: 'localId, expenseLocalId, status',

      // 동기화 큐: id를 primary key로, status와 priority에 인덱스
      syncQueue: 'id, expenseLocalId, status, priority, createdAt',

      // 동기화 메타데이터: key를 primary key로
      syncMeta: 'key',
    });

    // 스키마 버전 2: 예산 세목 즐겨찾기 및 최근 사용 테이블 추가
    this.version(2).stores({
      // 기존 테이블 (변경 없음)
      expenses: 'localId, serverId, status, updatedAt',
      attachments: 'localId, expenseLocalId, status',
      syncQueue: 'id, expenseLocalId, status, priority, createdAt',
      syncMeta: 'key',

      // 즐겨찾기: id(복합키)를 primary key로, userId와 budgetId에 인덱스
      favoriteBudgets: 'id, userId, budgetId, addedAt',

      // 최근 사용: id(복합키)를 primary key로, userId, usedAt, usageCount에 인덱스
      recentBudgetUsage: 'id, userId, budgetId, usedAt, usageCount',
    });
  }
}

// 싱글톤 인스턴스
let dbInstance: ExpenseDatabase | null = null;

/**
 * 데이터베이스 인스턴스 가져오기
 * 브라우저 환경에서만 동작
 */
export function getDB(): ExpenseDatabase {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB는 브라우저 환경에서만 사용 가능합니다.');
  }

  if (!dbInstance) {
    dbInstance = new ExpenseDatabase();
  }

  return dbInstance;
}

/**
 * 데이터베이스 존재 여부 확인
 */
export async function isDatabaseExists(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const databases = await Dexie.getDatabaseNames();
  return databases.includes('ExpenseSystemDB');
}

/**
 * 데이터베이스 삭제 (테스트/디버깅용)
 */
export async function deleteDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  await Dexie.delete('ExpenseSystemDB');
}

/**
 * 데이터베이스 초기화 및 연결 테스트
 */
export async function initDatabase(): Promise<boolean> {
  try {
    const db = getDB();
    await db.open();
    return true;
  } catch (error) {
    console.error('[IndexedDB] 초기화 실패:', error);
    return false;
  }
}

// 기본 내보내기
export { ExpenseDatabase };
export type { Table };
