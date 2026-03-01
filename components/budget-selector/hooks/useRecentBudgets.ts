'use client';

import { useState, useEffect, useCallback } from 'react';
import { BudgetSearchResult } from './useBudgetSearch';

const STORAGE_KEY = 'expense-recent-budgets';
const MAX_RECENT_ITEMS = 10;

export interface RecentBudgetItem extends BudgetSearchResult {
  usedAt: number;
}

interface UseRecentBudgetsReturn {
  recentItems: RecentBudgetItem[];
  addRecentItem: (item: BudgetSearchResult) => void;
  removeRecentItem: (id: string) => void;
  clearRecent: () => void;
}

export function useRecentBudgets(): UseRecentBudgetsReturn {
  const [recentItems, setRecentItems] = useState<RecentBudgetItem[]>([]);

  // localStorage에서 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentItems(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load recent budgets:', err);
    }
  }, []);

  // localStorage에 저장
  const saveToStorage = useCallback((items: RecentBudgetItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save recent budgets:', err);
    }
  }, []);

  // 항목 추가 (사용시마다 호출)
  const addRecentItem = useCallback((item: BudgetSearchResult) => {
    setRecentItems((prev) => {
      // 이미 존재하면 제거 (맨 앞으로 이동하기 위해)
      const filtered = prev.filter((i) => i.id !== item.id);

      // 새 항목 추가
      const newItem: RecentBudgetItem = {
        ...item,
        usedAt: Date.now(),
      };

      // 맨 앞에 추가하고 최대 개수 유지
      const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS);

      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 항목 제거
  const removeRecentItem = useCallback((id: string) => {
    setRecentItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // 전체 삭제
  const clearRecent = useCallback(() => {
    setRecentItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear recent budgets:', err);
    }
  }, []);

  return {
    recentItems,
    addRecentItem,
    removeRecentItem,
    clearRecent,
  };
}
