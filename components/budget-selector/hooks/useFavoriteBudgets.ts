'use client';

import { useState, useEffect, useCallback } from 'react';
import { BudgetSearchResult } from './useBudgetSearch';

const STORAGE_KEY = 'expense-favorite-budgets';
const MAX_FAVORITE_ITEMS = 20;

export interface FavoriteBudgetItem extends BudgetSearchResult {
  addedAt: number;
}

interface UseFavoriteBudgetsOptions {
  onLimitReached?: () => void;
}

interface UseFavoriteBudgetsReturn {
  favoriteItems: FavoriteBudgetItem[];
  addFavorite: (item: BudgetSearchResult) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (item: BudgetSearchResult) => void;
  isFavorite: (id: string) => boolean;
  clearFavorites: () => void;
  maxItems: number;
}

export function useFavoriteBudgets(options?: UseFavoriteBudgetsOptions): UseFavoriteBudgetsReturn {
  const { onLimitReached } = options || {};
  const [favoriteItems, setFavoriteItems] = useState<FavoriteBudgetItem[]>([]);

  // localStorage에서 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavoriteItems(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load favorite budgets:', err);
    }
  }, []);

  // localStorage에 저장
  const saveToStorage = useCallback((items: FavoriteBudgetItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save favorite budgets:', err);
    }
  }, []);

  // 즐겨찾기 추가
  const addFavorite = useCallback((item: BudgetSearchResult) => {
    setFavoriteItems((prev) => {
      // 이미 존재하면 무시
      if (prev.some((i) => i.id === item.id)) {
        return prev;
      }

      // 최대 개수 체크
      if (prev.length >= MAX_FAVORITE_ITEMS) {
        onLimitReached?.();
        return prev;
      }

      const newItem: FavoriteBudgetItem = {
        ...item,
        addedAt: Date.now(),
      };

      const updated = [...prev, newItem];
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage, onLimitReached]);

  // 즐겨찾기 제거
  const removeFavorite = useCallback((id: string) => {
    setFavoriteItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 즐겨찾기 토글
  const toggleFavorite = useCallback((item: BudgetSearchResult) => {
    setFavoriteItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);

      if (exists) {
        const updated = prev.filter((i) => i.id !== item.id);
        saveToStorage(updated);
        return updated;
      } else {
        if (prev.length >= MAX_FAVORITE_ITEMS) {
          onLimitReached?.();
          return prev;
        }

        const newItem: FavoriteBudgetItem = {
          ...item,
          addedAt: Date.now(),
        };
        const updated = [...prev, newItem];
        saveToStorage(updated);
        return updated;
      }
    });
  }, [saveToStorage, onLimitReached]);

  // 즐겨찾기 여부 확인
  const isFavorite = useCallback((id: string) => {
    return favoriteItems.some((i) => i.id === id);
  }, [favoriteItems]);

  // 전체 삭제
  const clearFavorites = useCallback(() => {
    setFavoriteItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear favorite budgets:', err);
    }
  }, []);

  return {
    favoriteItems,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    clearFavorites,
    maxItems: MAX_FAVORITE_ITEMS,
  };
}
