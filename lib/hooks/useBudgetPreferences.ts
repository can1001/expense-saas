/**
 * 예산 세목 즐겨찾기 및 최근 사용 훅
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  StoredBudgetDetail,
  FavoriteBudget,
  RecentBudgetUsage,
} from '@/lib/db/budget-preferences-types';
import * as store from '@/lib/db/budget-preferences-store';
import { BUDGET_PREFERENCES } from '@/lib/constants/budget-preferences';

interface UseBudgetPreferencesOptions {
  /** 최대 즐겨찾기 개수 */
  maxFavorites?: number;
  /** 화면에 표시할 최근 항목 개수 */
  maxRecentDisplay?: number;
  /** 즐겨찾기 제한 초과시 콜백 */
  onFavoriteLimit?: () => void;
}

interface UseBudgetPreferencesReturn {
  // 상태
  favorites: FavoriteBudget[];
  recentItems: RecentBudgetUsage[];
  isLoading: boolean;

  // 즐겨찾기 액션
  addToFavorites: (budget: StoredBudgetDetail) => Promise<void>;
  removeFromFavorites: (budgetId: string) => Promise<void>;
  toggleFavorite: (budget: StoredBudgetDetail) => Promise<void>;
  isFavorite: (budgetId: string) => boolean;

  // 최근 사용 액션
  recordUsage: (budget: StoredBudgetDetail) => Promise<void>;
  removeFromRecent: (budgetId: string) => Promise<void>;
  clearRecent: () => Promise<void>;

  // 데이터 갱신
  refresh: () => Promise<void>;
}

export function useBudgetPreferences(
  userId: string | undefined,
  options: UseBudgetPreferencesOptions = {}
): UseBudgetPreferencesReturn {
  const {
    maxFavorites = BUDGET_PREFERENCES.MAX_FAVORITES,
    maxRecentDisplay = BUDGET_PREFERENCES.MAX_RECENT_DISPLAY,
    onFavoriteLimit,
  } = options;

  const [favorites, setFavorites] = useState<FavoriteBudget[]>([]);
  const [recentItems, setRecentItems] = useState<RecentBudgetUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  const loadData = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      setRecentItems([]);
      setIsLoading(false);
      return;
    }

    try {
      const [favs, recents] = await Promise.all([
        store.getUserFavorites(userId),
        store.getRecentBudgets(userId, maxRecentDisplay),
      ]);

      setFavorites(favs);
      setRecentItems(recents);
    } catch (error) {
      console.error('[useBudgetPreferences] 데이터 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, maxRecentDisplay]);

  // 초기 로드
  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  // 즐겨찾기 여부 확인 (동기 - 로컬 상태 기반)
  const isFavorite = useCallback(
    (budgetId: string): boolean => {
      return favorites.some((f) => f.budgetId === budgetId);
    },
    [favorites]
  );

  // 즐겨찾기 추가
  const addToFavorites = useCallback(
    async (budget: StoredBudgetDetail) => {
      if (!userId) return;

      // 개수 제한 확인
      if (favorites.length >= maxFavorites) {
        onFavoriteLimit?.();
      }

      try {
        const newFav = await store.addFavorite(userId, budget);
        setFavorites((prev) => {
          // 중복 방지
          if (prev.some((f) => f.budgetId === budget.id)) {
            return prev;
          }
          // 최신 항목을 앞에 추가
          return [newFav, ...prev].slice(0, maxFavorites);
        });
      } catch (error) {
        console.error('[useBudgetPreferences] 즐겨찾기 추가 실패:', error);
      }
    },
    [userId, favorites.length, maxFavorites, onFavoriteLimit]
  );

  // 즐겨찾기 제거
  const removeFromFavorites = useCallback(
    async (budgetId: string) => {
      if (!userId) return;

      try {
        await store.removeFavorite(userId, budgetId);
        setFavorites((prev) => prev.filter((f) => f.budgetId !== budgetId));
      } catch (error) {
        console.error('[useBudgetPreferences] 즐겨찾기 제거 실패:', error);
      }
    },
    [userId]
  );

  // 즐겨찾기 토글
  const toggleFavorite = useCallback(
    async (budget: StoredBudgetDetail) => {
      if (!userId) return;

      const exists = isFavorite(budget.id);
      if (exists) {
        await removeFromFavorites(budget.id);
      } else {
        await addToFavorites(budget);
      }
    },
    [userId, isFavorite, addToFavorites, removeFromFavorites]
  );

  // 사용 기록
  const recordUsage = useCallback(
    async (budget: StoredBudgetDetail) => {
      if (!userId) return;

      try {
        const usage = await store.recordBudgetUsage(userId, budget);
        setRecentItems((prev) => {
          // 기존 항목 제거 후 앞에 추가
          const filtered = prev.filter((r) => r.budgetId !== budget.id);
          return [usage, ...filtered].slice(0, maxRecentDisplay);
        });
      } catch (error) {
        console.error('[useBudgetPreferences] 사용 기록 실패:', error);
      }
    },
    [userId, maxRecentDisplay]
  );

  // 최근 사용에서 제거
  const removeFromRecent = useCallback(
    async (budgetId: string) => {
      if (!userId) return;

      try {
        await store.removeRecentBudget(userId, budgetId);
        setRecentItems((prev) => prev.filter((r) => r.budgetId !== budgetId));
      } catch (error) {
        console.error('[useBudgetPreferences] 최근 사용 제거 실패:', error);
      }
    },
    [userId]
  );

  // 최근 사용 전체 삭제
  const clearRecent = useCallback(async () => {
    if (!userId) return;

    try {
      await store.clearRecentBudgets(userId);
      setRecentItems([]);
    } catch (error) {
      console.error('[useBudgetPreferences] 최근 사용 삭제 실패:', error);
    }
  }, [userId]);

  // 데이터 갱신
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return useMemo(
    () => ({
      favorites,
      recentItems,
      isLoading,
      addToFavorites,
      removeFromFavorites,
      toggleFavorite,
      isFavorite,
      recordUsage,
      removeFromRecent,
      clearRecent,
      refresh,
    }),
    [
      favorites,
      recentItems,
      isLoading,
      addToFavorites,
      removeFromFavorites,
      toggleFavorite,
      isFavorite,
      recordUsage,
      removeFromRecent,
      clearRecent,
      refresh,
    ]
  );
}
