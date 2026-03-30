/**
 * 적요 즐겨찾기 훅 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMemoPreferences } from '../useMemoPreferences';
import type { FavoriteMemo } from '@/lib/db/memo-preferences-types';
import * as store from '@/lib/db/memo-preferences-store';

// Mock the store module
vi.mock('@/lib/db/memo-preferences-store', () => ({
  getUserFavoriteMemos: vi.fn(),
  addFavoriteMemo: vi.fn(),
  removeFavoriteMemo: vi.fn(),
  clearFavoriteMemos: vi.fn(),
}));

describe('useMemoPreferences', () => {
  const mockUserId = 'user-123';
  const mockMemo = '테스트 적요';
  const mockBudgetDetail = '테스트 세목';

  const mockFavoriteMemo: FavoriteMemo = {
    id: `${mockUserId}_abc123`,
    userId: mockUserId,
    memo: mockMemo,
    budgetDetail: mockBudgetDetail,
    addedAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([]);
  });

  describe('Initialization', () => {
    it('should initialize with empty state when userId is undefined', async () => {
      const { result } = renderHook(() => useMemoPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
      expect(store.getUserFavoriteMemos).not.toHaveBeenCalled();
    });

    it('should load data when userId is provided', async () => {
      const mockFavorites = [mockFavoriteMemo];
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue(mockFavorites);

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.favorites).toEqual(mockFavorites);
      expect(store.getUserFavoriteMemos).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle loading errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavoriteMemos).mockRejectedValue(
        new Error('Load failed')
      );

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useMemoPreferences] 데이터 로드 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('isFavorite', () => {
    it('should return true for favorited memo', async () => {
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([
        mockFavoriteMemo,
      ]);

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFavorite(mockMemo)).toBe(true);
    });

    it('should return false for non-favorited memo', async () => {
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([]);

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFavorite('non-existent')).toBe(false);
    });
  });

  describe('addToFavorites', () => {
    it('should add memo to favorites successfully', async () => {
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([]);
      vi.mocked(store.addFavoriteMemo).mockResolvedValue(mockFavoriteMemo);

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockMemo, mockBudgetDetail);

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(1);
        expect(result.current.favorites[0]).toEqual(mockFavoriteMemo);
      });

      expect(store.addFavoriteMemo).toHaveBeenCalledWith(
        mockUserId,
        mockMemo,
        mockBudgetDetail
      );
    });

    it('should add memo without budgetDetail', async () => {
      const memoWithoutBudget = { ...mockFavoriteMemo, budgetDetail: undefined };
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([]);
      vi.mocked(store.addFavoriteMemo).mockResolvedValue(memoWithoutBudget);

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockMemo);

      expect(store.addFavoriteMemo).toHaveBeenCalledWith(
        mockUserId,
        mockMemo,
        undefined
      );
    });

    it('should not add duplicate favorites', async () => {
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([
        mockFavoriteMemo,
      ]);
      vi.mocked(store.addFavoriteMemo).mockResolvedValue(mockFavoriteMemo);

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockMemo, mockBudgetDetail);

      // Should still have only 1 favorite
      expect(result.current.favorites).toHaveLength(1);
    });

    it('should call onFavoriteLimit when limit reached', async () => {
      const onFavoriteLimit = vi.fn();
      const maxFavorites = 2;

      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([
        mockFavoriteMemo,
        { ...mockFavoriteMemo, id: 'fav-2', memo: '다른 적요' },
      ]);

      const { result } = renderHook(() =>
        useMemoPreferences(mockUserId, { maxFavorites, onFavoriteLimit })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites('새 적요');

      expect(onFavoriteLimit).toHaveBeenCalled();
    });

    it('should respect maxFavorites limit', async () => {
      const maxFavorites = 3;
      const existingFavorites = [
        mockFavoriteMemo,
        { ...mockFavoriteMemo, id: 'fav-2', memo: '적요2' },
      ];

      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue(existingFavorites);
      const newFav = { ...mockFavoriteMemo, id: 'fav-3', memo: '적요3' };
      vi.mocked(store.addFavoriteMemo).mockResolvedValue(newFav);

      const { result } = renderHook(() =>
        useMemoPreferences(mockUserId, { maxFavorites })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites('적요3');

      await waitFor(() => {
        // Should have max 3 favorites
        expect(result.current.favorites.length).toBeLessThanOrEqual(maxFavorites);
      });
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([]);
      vi.mocked(store.addFavoriteMemo).mockRejectedValue(
        new Error('Add failed')
      );

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockMemo);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useMemoPreferences] 즐겨찾기 추가 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useMemoPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.addToFavorites(mockMemo);

      expect(store.addFavoriteMemo).not.toHaveBeenCalled();
    });
  });

  describe('removeFromFavorites', () => {
    it('should remove memo from favorites successfully', async () => {
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([
        mockFavoriteMemo,
      ]);
      vi.mocked(store.removeFavoriteMemo).mockResolvedValue();

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeFromFavorites(mockMemo);

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(0);
      });

      expect(store.removeFavoriteMemo).toHaveBeenCalledWith(mockUserId, mockMemo);
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([
        mockFavoriteMemo,
      ]);
      vi.mocked(store.removeFavoriteMemo).mockRejectedValue(
        new Error('Remove failed')
      );

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeFromFavorites(mockMemo);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useMemoPreferences] 즐겨찾기 제거 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useMemoPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeFromFavorites(mockMemo);

      expect(store.removeFavoriteMemo).not.toHaveBeenCalled();
    });
  });

  describe('toggleFavorite', () => {
    it('should remove favorite if it exists', async () => {
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([
        mockFavoriteMemo,
      ]);
      vi.mocked(store.removeFavoriteMemo).mockResolvedValue();

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.toggleFavorite(mockMemo);

      expect(store.removeFavoriteMemo).toHaveBeenCalledWith(mockUserId, mockMemo);
    });

    it('should add favorite if it does not exist', async () => {
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([]);
      vi.mocked(store.addFavoriteMemo).mockResolvedValue(mockFavoriteMemo);

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.toggleFavorite(mockMemo, mockBudgetDetail);

      expect(store.addFavoriteMemo).toHaveBeenCalledWith(
        mockUserId,
        mockMemo,
        mockBudgetDetail
      );
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useMemoPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.toggleFavorite(mockMemo);

      expect(store.addFavoriteMemo).not.toHaveBeenCalled();
      expect(store.removeFavoriteMemo).not.toHaveBeenCalled();
    });
  });

  describe('clearFavorites', () => {
    it('should clear all favorites successfully', async () => {
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([
        mockFavoriteMemo,
      ]);
      vi.mocked(store.clearFavoriteMemos).mockResolvedValue();

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.clearFavorites();

      await waitFor(() => {
        expect(result.current.favorites).toHaveLength(0);
      });

      expect(store.clearFavoriteMemos).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.mocked(store.getUserFavoriteMemos).mockResolvedValue([
        mockFavoriteMemo,
      ]);
      vi.mocked(store.clearFavoriteMemos).mockRejectedValue(
        new Error('Clear failed')
      );

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.clearFavorites();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useMemoPreferences] 즐겨찾기 삭제 실패:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('should do nothing when userId is undefined', async () => {
      const { result } = renderHook(() => useMemoPreferences(undefined));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.clearFavorites();

      expect(store.clearFavoriteMemos).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should reload data successfully', async () => {
      const initialFavorites = [mockFavoriteMemo];
      const updatedFavorites = [
        mockFavoriteMemo,
        { ...mockFavoriteMemo, id: 'new-fav', memo: '새 적요' },
      ];

      vi.mocked(store.getUserFavoriteMemos)
        .mockResolvedValueOnce(initialFavorites)
        .mockResolvedValueOnce(updatedFavorites);

      const { result } = renderHook(() => useMemoPreferences(mockUserId));

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
