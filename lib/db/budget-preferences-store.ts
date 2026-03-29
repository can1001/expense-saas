/**
 * 예산 세목 즐겨찾기 및 최근 사용 저장소
 * IndexedDB CRUD 작업
 */

import { getDB } from './index';
import type {
  StoredBudgetDetail,
  FavoriteBudget,
  RecentBudgetUsage,
} from './budget-preferences-types';
import { createCompositeId } from './budget-preferences-types';
import { BUDGET_PREFERENCES } from '@/lib/constants/budget-preferences';

// ========== 즐겨찾기 (FAVORITES) ==========

/**
 * 사용자의 즐겨찾기 목록 조회
 */
export async function getUserFavorites(userId: string): Promise<FavoriteBudget[]> {
  const db = getDB();
  return db.favoriteBudgets
    .where('userId')
    .equals(userId)
    .reverse()
    .sortBy('addedAt');
}

/**
 * 즐겨찾기 추가
 */
export async function addFavorite(
  userId: string,
  budget: StoredBudgetDetail
): Promise<FavoriteBudget> {
  const db = getDB();
  const now = Date.now();
  const compositeId = createCompositeId(userId, budget.id);

  // 기존 항목이 있는지 확인
  const existing = await db.favoriteBudgets.get(compositeId);
  if (existing) {
    return existing;
  }

  // 즐겨찾기 개수 제한 확인
  const count = await db.favoriteBudgets.where('userId').equals(userId).count();
  if (count >= BUDGET_PREFERENCES.MAX_FAVORITES) {
    // 가장 오래된 항목 삭제
    const oldest = await db.favoriteBudgets
      .where('userId')
      .equals(userId)
      .sortBy('addedAt');
    if (oldest.length > 0) {
      await db.favoriteBudgets.delete(oldest[0].id);
    }
  }

  const favorite: FavoriteBudget = {
    id: compositeId,
    userId,
    budgetId: budget.id,
    budget,
    addedAt: now,
  };

  await db.favoriteBudgets.add(favorite);
  return favorite;
}

/**
 * 즐겨찾기 제거
 */
export async function removeFavorite(
  userId: string,
  budgetId: string
): Promise<boolean> {
  const db = getDB();
  const compositeId = createCompositeId(userId, budgetId);
  await db.favoriteBudgets.delete(compositeId);
  return true;
}

/**
 * 즐겨찾기 여부 확인
 */
export async function isFavorite(
  userId: string,
  budgetId: string
): Promise<boolean> {
  const db = getDB();
  const compositeId = createCompositeId(userId, budgetId);
  const item = await db.favoriteBudgets.get(compositeId);
  return !!item;
}

/**
 * 즐겨찾기 토글 (추가/제거)
 */
export async function toggleFavorite(
  userId: string,
  budget: StoredBudgetDetail
): Promise<{ added: boolean }> {
  const exists = await isFavorite(userId, budget.id);

  if (exists) {
    await removeFavorite(userId, budget.id);
    return { added: false };
  } else {
    await addFavorite(userId, budget);
    return { added: true };
  }
}

/**
 * 사용자의 즐겨찾기 개수 조회
 */
export async function getFavoritesCount(userId: string): Promise<number> {
  const db = getDB();
  return db.favoriteBudgets.where('userId').equals(userId).count();
}

/**
 * 사용자의 모든 즐겨찾기 삭제
 */
export async function clearFavorites(userId: string): Promise<void> {
  const db = getDB();
  await db.favoriteBudgets.where('userId').equals(userId).delete();
}

// ========== 최근 사용 (RECENT USAGE) ==========

/**
 * 사용자의 최근 사용 세목 조회 (최신순)
 */
export async function getRecentBudgets(
  userId: string,
  limit: number = BUDGET_PREFERENCES.MAX_RECENT_DISPLAY
): Promise<RecentBudgetUsage[]> {
  const db = getDB();
  const all = await db.recentBudgetUsage
    .where('userId')
    .equals(userId)
    .reverse()
    .sortBy('usedAt');

  return all.slice(0, limit);
}

/**
 * 세목 사용 기록 (기존 항목이 있으면 업데이트)
 */
export async function recordBudgetUsage(
  userId: string,
  budget: StoredBudgetDetail
): Promise<RecentBudgetUsage> {
  const db = getDB();
  const now = Date.now();
  const compositeId = createCompositeId(userId, budget.id);

  // 기존 항목 확인
  const existing = await db.recentBudgetUsage.get(compositeId);

  if (existing) {
    // 기존 항목 업데이트
    const updated: RecentBudgetUsage = {
      ...existing,
      budget,
      usedAt: now,
      usageCount: existing.usageCount + 1,
    };
    await db.recentBudgetUsage.put(updated);
    return updated;
  }

  // 저장 개수 제한 확인
  const count = await db.recentBudgetUsage.where('userId').equals(userId).count();
  if (count >= BUDGET_PREFERENCES.MAX_RECENT_STORAGE) {
    // 가장 오래된 항목 삭제
    const oldest = await db.recentBudgetUsage
      .where('userId')
      .equals(userId)
      .sortBy('usedAt');
    if (oldest.length > 0) {
      await db.recentBudgetUsage.delete(oldest[0].id);
    }
  }

  // 새 항목 추가
  const usage: RecentBudgetUsage = {
    id: compositeId,
    userId,
    budgetId: budget.id,
    budget,
    usedAt: now,
    usageCount: 1,
  };

  await db.recentBudgetUsage.add(usage);
  return usage;
}

/**
 * 자주 사용하는 세목 조회 (사용 횟수순)
 */
export async function getFrequentBudgets(
  userId: string,
  limit: number = BUDGET_PREFERENCES.MAX_RECENT_DISPLAY
): Promise<RecentBudgetUsage[]> {
  const db = getDB();
  const all = await db.recentBudgetUsage
    .where('userId')
    .equals(userId)
    .toArray();

  // 사용 횟수로 정렬
  return all
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}

/**
 * 최근 사용에서 특정 항목 제거
 */
export async function removeRecentBudget(
  userId: string,
  budgetId: string
): Promise<boolean> {
  const db = getDB();
  const compositeId = createCompositeId(userId, budgetId);
  await db.recentBudgetUsage.delete(compositeId);
  return true;
}

/**
 * 사용자의 모든 최근 사용 기록 삭제
 */
export async function clearRecentBudgets(userId: string): Promise<void> {
  const db = getDB();
  await db.recentBudgetUsage.where('userId').equals(userId).delete();
}

/**
 * 오래된 사용 기록 정리
 */
export async function cleanupOldUsage(
  userId: string,
  daysToKeep: number = BUDGET_PREFERENCES.CLEANUP_DAYS
): Promise<number> {
  const db = getDB();
  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  const oldItems = await db.recentBudgetUsage
    .where('userId')
    .equals(userId)
    .and((item) => item.usedAt < cutoffTime)
    .toArray();

  for (const item of oldItems) {
    await db.recentBudgetUsage.delete(item.id);
  }

  return oldItems.length;
}
