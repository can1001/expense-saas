/**
 * 예산 세목 즐겨찾기 및 최근 사용 훅 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBudgetPreferences } from '../useBudgetPreferences';
import type {
  StoredBudgetDetail,
  FavoriteBudget,
  RecentBudgetUsage,
} from '@/lib/db/budget-preferences-types';
import * as store from '@/lib/db/budget-preferences-store';

// Mock the store module
vi.mock('@/lib/db/budget-preferences-store', () => ({
  getUserFavorites: vi.fn(),
  getRecentBudgets: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  recordBudgetUsage: vi.fn(),
  removeRecentBudget: vi.fn(),
  clearRecentBudgets: vi.fn(),
}));

describe('useBudgetPreferences', () => {
  const mockUserId = 'user-123';
  const mockBudgetDetail: StoredBudgetDetail = {
    id: 'cat-sub-name',
    name: '테스트 세목',
    category: '항1',
    subcategory: '목1',
    managerId: 'manager-1',
    managerName: '담당자1',
  };

  const mockFavorite: FavoriteBudget = {
    id: `${mockUserId}_${mockBudgetDetail.id}`,
    userId: mockUserId,
    budgetId: mockBudgetDetail.id,
    budget: mockBudgetDetail,
    addedAt: Date.now(),
  };

  const mockRecentUsage: RecentBudgetUsage = {
    id: `${mockUserId}_${mockBudgetDetail.id}`,
    userId: mockUserId,
    budgetId: mockBudgetDetail.id,
    budget: mockBudgetDetail,
    usedAt: Date.now(),
    usageCount: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(store.getUserFavorites).mockResolvedValue([]);
    vi.mocked(store.getRecentBudgets).mockResolvedValue([]);
  });

  describe('Initialization', () => {
    it('should initialize with empty state when userId is undefined', async () => {
      const { result } = renderHook(() => useBudgetPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
      expect(result.current.recentItems).toEqual([]);
      expect(store.getUserFavorites).not.toHaveBeenCalled();
      expect(store.getRecentBudgets).not.toHaveBeenCalled();
    });

    it('should load data when userId is provided', async () => {
      const mockFavorites = [mockFavorite];
      const mockRecents = [mockRecentUsage];

      vi.mocked(store.getUserFavorites).mockResolvedValue(mockFavorites);
      vi.mocked(store.getRecentBudgets).mockResolvedValue(mockRecents);

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual(mockFavorites);
      expect(result.current.recentItems).toEqual(mockRecents);
      expect(store.getUserFavorites).toHaveBeenCalledWith(mockUserId);
      expect(store.getRecentBudgets).toHaveBeenCalledWith(mockUserId, 5);
    });

    it('should handle loading errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavorites).mockRejectedValue(
        new Error('Load failed')
      );

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useBudgetPreferences] 데이터 로드 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should use custom maxRecentDisplay option', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.getRecentBudgets).mockResolvedValue([]);

      renderHook(() =>
        useBudgetPreferences(mockUserId, { maxRecentDisplay: 10 })
      );

      await waitFor(() => {
        expect(store.getRecentBudgets).toHaveBeenCalledWith(mockUserId, 10);
      });
    });
  });

  describe('isFavorite', () => {
    it('should return true for favorited budget', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([mockFavorite]);

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFavorite(mockBudgetDetail.id)).toBe(true);
    });

    it('should return false for non-favorited budget', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFavorite('non-existent-id')).toBe(false);
    });
  });

  describe('addToFavorites', () => {
    it('should add budget to favorites successfully', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.addFavorite).mockResolvedValue(mockFavorite);

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockBudgetDetail);

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(1);
        expect(result.current.favorites[0]).toEqual(mockFavorite);
      });

      expect(store.addFavorite).toHaveBeenCalledWith(
        mockUserId,
        mockBudgetDetail
      );
    });

    it('should not add duplicate favorites', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([mockFavorite]);
      vi.mocked(store.addFavorite).mockResolvedValue(mockFavorite);

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockBudgetDetail);

      // Should still have only 1 favorite
      expect(result.current.favorites).toHaveLength(1);
    });

    it('should call onFavoriteLimit when limit reached', async () => {
      const onFavoriteLimit = vi.fn();
      const maxFavorites = 2;

      vi.mocked(store.getUserFavorites).mockResolvedValue([
        mockFavorite,
        { ...mockFavorite, id: 'fav-2', budgetId: 'budget-2' },
      ]);

      const { result } = renderHook(() =>
        useBudgetPreferences(mockUserId, { maxFavorites, onFavoriteLimit })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockBudgetDetail);

      expect(onFavoriteLimit).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.addFavorite).mockRejectedValue(new Error('Add failed'));

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockBudgetDetail);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useBudgetPreferences] 즐겨찾기 추가 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useBudgetPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockBudgetDetail);

      expect(store.addFavorite).not.toHaveBeenCalled();
    });
  });

  describe('removeFromFavorites', () => {
    it('should remove budget from favorites successfully', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([mockFavorite]);
      vi.mocked(store.removeFavorite).mockResolvedValue();

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeFromFavorites(mockBudgetDetail.id);

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(0);
      });

      expect(store.removeFavorite).toHaveBeenCalledWith(
        mockUserId,
        mockBudgetDetail.id
      );
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavorites).mockResolvedValue([mockFavorite]);
      vi.mocked(store.removeFavorite).mockRejectedValue(
        new Error('Remove failed')
      );

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeFromFavorites(mockBudgetDetail.id);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useBudgetPreferences] 즐겨찾기 제거 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useBudgetPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeFromFavorites('some-id');

      expect(store.removeFavorite).not.toHaveBeenCalled();
    });
  });

  describe('toggleFavorite', () => {
    it('should remove favorite if it exists', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([mockFavorite]);
      vi.mocked(store.removeFavorite).mockResolvedValue();

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.toggleFavorite(mockBudgetDetail);

      expect(store.removeFavorite).toHaveBeenCalledWith(
        mockUserId,
        mockBudgetDetail.id
      );
    });

    it('should add favorite if it does not exist', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.addFavorite).mockResolvedValue(mockFavorite);

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.toggleFavorite(mockBudgetDetail);

      expect(store.addFavorite).toHaveBeenCalledWith(
        mockUserId,
        mockBudgetDetail
      );
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useBudgetPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.toggleFavorite(mockBudgetDetail);

      expect(store.addFavorite).not.toHaveBeenCalled();
      expect(store.removeFavorite).not.toHaveBeenCalled();
    });
  });

  describe('recordUsage', () => {
    it('should record budget usage successfully', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.getRecentBudgets).mockResolvedValue([]);
      vi.mocked(store.recordBudgetUsage).mockResolvedValue(mockRecentUsage);

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.recordUsage(mockBudgetDetail);

      await waitFor(() => {
        expect(result.current.recentItems).toHaveLength(1);
        expect(result.current.recentItems[0]).toEqual(mockRecentUsage);
      });

      expect(store.recordBudgetUsage).toHaveBeenCalledWith(
        mockUserId,
        mockBudgetDetail
      );
    });

    it('should move existing item to front when recording usage', async () => {
      const existingUsage = { ...mockRecentUsage, usageCount: 3 };
      const updatedUsage = { ...mockRecentUsage, usageCount: 4 };

      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.getRecentBudgets).mockResolvedValue([existingUsage]);
      vi.mocked(store.recordBudgetUsage).mockResolvedValue(updatedUsage);

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.recordUsage(mockBudgetDetail);

      await waitFor(() => {
        expect(result.current.recentItems).toHaveLength(1);
        expect(result.current.recentItems[0].usageCount).toBe(4);
      });
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.getRecentBudgets).mockResolvedValue([]);
      vi.mocked(store.recordBudgetUsage).mockRejectedValue(
        new Error('Record failed')
      );

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.recordUsage(mockBudgetDetail);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useBudgetPreferences] 사용 기록 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useBudgetPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.recordUsage(mockBudgetDetail);

      expect(store.recordBudgetUsage).not.toHaveBeenCalled();
    });
  });

  describe('removeFromRecent', () => {
    it('should remove budget from recent items successfully', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.getRecentBudgets).mockResolvedValue([mockRecentUsage]);
      vi.mocked(store.removeRecentBudget).mockResolvedValue();

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeFromRecent(mockBudgetDetail.id);

      await waitFor(() => {
        expect(result.current.recentItems).toHaveLength(0);
      });

      expect(store.removeRecentBudget).toHaveBeenCalledWith(
        mockUserId,
        mockBudgetDetail.id
      );
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.getRecentBudgets).mockResolvedValue([mockRecentUsage]);
      vi.mocked(store.removeRecentBudget).mockRejectedValue(
        new Error('Remove failed')
      );

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeFromRecent(mockBudgetDetail.id);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useBudgetPreferences] 최근 사용 제거 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useBudgetPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeFromRecent('some-id');

      expect(store.removeRecentBudget).not.toHaveBeenCalled();
    });
  });

  describe('clearRecent', () => {
    it('should clear all recent items successfully', async () => {
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.getRecentBudgets).mockResolvedValue([mockRecentUsage]);
      vi.mocked(store.clearRecentBudgets).mockResolvedValue();

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.clearRecent();

      await waitFor(() => {
        expect(result.current.recentItems).toHaveLength(0);
      });

      expect(store.clearRecentBudgets).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavorites).mockResolvedValue([]);
      vi.mocked(store.getRecentBudgets).mockResolvedValue([mockRecentUsage]);
      vi.mocked(store.clearRecentBudgets).mockRejectedValue(
        new Error('Clear failed')
      );

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.clearRecent();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useBudgetPreferences] 최근 사용 삭제 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useBudgetPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.clearRecent();

      expect(store.clearRecentBudgets).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should reload data successfully', async () => {
      const initialFavorites = [mockFavorite];
      const updatedFavorites = [
        mockFavorite,
        { ...mockFavorite, id: 'new-fav', budgetId: 'new-budget' },
      ];

      vi.mocked(store.getUserFavorites)
        .mockResolvedValueOnce(initialFavorites)
        .mockResolvedValueOnce(updatedFavorites);
      vi.mocked(store.getRecentBudgets).mockResolvedValue([]);

      const { result } = renderHook(() => useBudgetPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(1);
      });

      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(2);
      });
    });
  });
});
