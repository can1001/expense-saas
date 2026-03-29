/**
 * 적요 즐겨찾기 저장소
 * IndexedDB CRUD 작업
 */

import { getDB } from './index';
import type { FavoriteMemo } from './memo-preferences-types';
import { createMemoCompositeId } from './memo-preferences-types';
import { MEMO_PREFERENCES } from '@/lib/constants/memo-preferences';

/**
 * 사용자의 즐겨찾기 적요 목록 조회 (최신순)
 */
export async function getUserFavoriteMemos(userId: string): Promise<FavoriteMemo[]> {
  const db = getDB();
  return db.favoriteMemos
    .where('userId')
    .equals(userId)
    .reverse()
    .sortBy('addedAt');
}

/**
 * 즐겨찾기 적요 추가
 */
export async function addFavoriteMemo(
  userId: string,
  memo: string,
  budgetDetail?: string
): Promise<FavoriteMemo> {
  const db = getDB();
  const now = Date.now();
  const compositeId = createMemoCompositeId(userId, memo);

  // 기존 항목이 있는지 확인
  const existing = await db.favoriteMemos.get(compositeId);
  if (existing) {
    return existing;
  }

  // 즐겨찾기 개수 제한 확인
  const count = await db.favoriteMemos.where('userId').equals(userId).count();
  if (count >= MEMO_PREFERENCES.MAX_FAVORITES) {
    // 가장 오래된 항목 삭제
    const oldest = await db.favoriteMemos
      .where('userId')
      .equals(userId)
      .sortBy('addedAt');
    if (oldest.length > 0) {
      await db.favoriteMemos.delete(oldest[0].id);
    }
  }

  const favorite: FavoriteMemo = {
    id: compositeId,
    userId,
    memo,
    budgetDetail,
    addedAt: now,
  };

  await db.favoriteMemos.add(favorite);
  return favorite;
}

/**
 * 즐겨찾기 적요 제거
 */
export async function removeFavoriteMemo(
  userId: string,
  memo: string
): Promise<boolean> {
  const db = getDB();
  const compositeId = createMemoCompositeId(userId, memo);
  await db.favoriteMemos.delete(compositeId);
  return true;
}

/**
 * 즐겨찾기 여부 확인
 */
export async function isFavoriteMemo(
  userId: string,
  memo: string
): Promise<boolean> {
  const db = getDB();
  const compositeId = createMemoCompositeId(userId, memo);
  const item = await db.favoriteMemos.get(compositeId);
  return !!item;
}

/**
 * 즐겨찾기 토글 (추가/제거)
 */
export async function toggleFavoriteMemo(
  userId: string,
  memo: string,
  budgetDetail?: string
): Promise<{ added: boolean }> {
  const exists = await isFavoriteMemo(userId, memo);

  if (exists) {
    await removeFavoriteMemo(userId, memo);
    return { added: false };
  } else {
    await addFavoriteMemo(userId, memo, budgetDetail);
    return { added: true };
  }
}

/**
 * 사용자의 즐겨찾기 개수 조회
 */
export async function getFavoriteMemosCount(userId: string): Promise<number> {
  const db = getDB();
  return db.favoriteMemos.where('userId').equals(userId).count();
}

/**
 * 사용자의 모든 즐겨찾기 적요 삭제
 */
export async function clearFavoriteMemos(userId: string): Promise<void> {
  const db = getDB();
  await db.favoriteMemos.where('userId').equals(userId).delete();
}
