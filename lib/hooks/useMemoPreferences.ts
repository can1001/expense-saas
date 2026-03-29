/**
 * 적요 즐겨찾기 훅
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FavoriteMemo } from '@/lib/db/memo-preferences-types';
import * as store from '@/lib/db/memo-preferences-store';
import { MEMO_PREFERENCES } from '@/lib/constants/memo-preferences';

interface UseMemoPreferencesOptions {
  /** 최대 즐겨찾기 개수 */
  maxFavorites?: number;
  /** 즐겨찾기 제한 초과시 콜백 */
  onFavoriteLimit?: () => void;
}

interface UseMemoPreferencesReturn {
  // 상태
  favorites: FavoriteMemo[];
  isLoading: boolean;

  // 액션
  addToFavorites: (memo: string, budgetDetail?: string) => Promise<void>;
  removeFromFavorites: (memo: string) => Promise<void>;
  toggleFavorite: (memo: string, budgetDetail?: string) => Promise<void>;
  isFavorite: (memo: string) => boolean;
  clearFavorites: () => Promise<void>;

  // 데이터 갱신
  refresh: () => Promise<void>;
}

export function useMemoPreferences(
  userId: string | undefined,
  options: UseMemoPreferencesOptions = {}
): UseMemoPreferencesReturn {
  const {
    maxFavorites = MEMO_PREFERENCES.MAX_FAVORITES,
    onFavoriteLimit,
  } = options;

  const [favorites, setFavorites] = useState<FavoriteMemo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  const loadData = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }

    try {
      const favs = await store.getUserFavoriteMemos(userId);
      setFavorites(favs);
    } catch (error) {
      console.error('[useMemoPreferences] 데이터 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // 초기 로드
  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  // 즐겨찾기 여부 확인 (동기 - 로컬 상태 기반)
  const isFavorite = useCallback(
    (memo: string): boolean => {
      return favorites.some((f) => f.memo === memo);
    },
    [favorites]
  );

  // 즐겨찾기 추가
  const addToFavorites = useCallback(
    async (memo: string, budgetDetail?: string) => {
      if (!userId) return;

      // 개수 제한 확인
      if (favorites.length >= maxFavorites) {
        onFavoriteLimit?.();
      }

      try {
        const newFav = await store.addFavoriteMemo(userId, memo, budgetDetail);
        setFavorites((prev) => {
          // 중복 방지
          if (prev.some((f) => f.memo === memo)) {
            return prev;
          }
          // 최신 항목을 앞에 추가
          return [newFav, ...prev].slice(0, maxFavorites);
        });
      } catch (error) {
        console.error('[useMemoPreferences] 즐겨찾기 추가 실패:', error);
      }
    },
    [userId, favorites.length, maxFavorites, onFavoriteLimit]
  );

  // 즐겨찾기 제거
  const removeFromFavorites = useCallback(
    async (memo: string) => {
      if (!userId) return;

      try {
        await store.removeFavoriteMemo(userId, memo);
        setFavorites((prev) => prev.filter((f) => f.memo !== memo));
      } catch (error) {
        console.error('[useMemoPreferences] 즐겨찾기 제거 실패:', error);
      }
    },
    [userId]
  );

  // 즐겨찾기 토글
  const toggleFavorite = useCallback(
    async (memo: string, budgetDetail?: string) => {
      if (!userId) return;

      const exists = isFavorite(memo);
      if (exists) {
        await removeFromFavorites(memo);
      } else {
        await addToFavorites(memo, budgetDetail);
      }
    },
    [userId, isFavorite, addToFavorites, removeFromFavorites]
  );

  // 모든 즐겨찾기 삭제
  const clearFavorites = useCallback(async () => {
    if (!userId) return;

    try {
      await store.clearFavoriteMemos(userId);
      setFavorites([]);
    } catch (error) {
      console.error('[useMemoPreferences] 즐겨찾기 삭제 실패:', error);
    }
  }, [userId]);

  // 데이터 갱신
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return useMemo(
    () => ({
      favorites,
      isLoading,
      addToFavorites,
      removeFromFavorites,
      toggleFavorite,
      isFavorite,
      clearFavorites,
      refresh,
    }),
    [
      favorites,
      isLoading,
      addToFavorites,
      removeFromFavorites,
      toggleFavorite,
      isFavorite,
      clearFavorites,
      refresh,
    ]
  );
}
