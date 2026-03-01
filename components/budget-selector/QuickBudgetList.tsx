'use client';

import React from 'react';
import { Star, Clock, X, ChevronRight } from 'lucide-react';
import { BudgetSearchResult } from './hooks/useBudgetSearch';
import { RecentBudgetItem } from './hooks/useRecentBudgets';
import { FavoriteBudgetItem } from './hooks/useFavoriteBudgets';

interface QuickBudgetListProps {
  favoriteItems: FavoriteBudgetItem[];
  recentItems: RecentBudgetItem[];
  onSelect: (item: BudgetSearchResult) => void;
  onRemoveFavorite?: (id: string) => void;
  onRemoveRecent?: (id: string) => void;
  maxDisplay?: number;
}

export default function QuickBudgetList({
  favoriteItems,
  recentItems,
  onSelect,
  onRemoveFavorite,
  onRemoveRecent,
  maxDisplay = 5,
}: QuickBudgetListProps) {
  const displayFavorites = favoriteItems.slice(0, maxDisplay);
  const displayRecents = recentItems
    .filter((r) => !favoriteItems.some((f) => f.id === r.id))
    .slice(0, maxDisplay);

  if (displayFavorites.length === 0 && displayRecents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-4">
      {/* 즐겨찾기 */}
      {displayFavorites.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-medium text-gray-700">즐겨찾기</span>
            <span className="text-xs text-gray-400">({favoriteItems.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {displayFavorites.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-1 px-3 py-2 min-h-[44px] bg-yellow-50 border border-yellow-200 rounded-full text-sm hover:bg-yellow-100 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="flex items-center gap-1 min-h-[36px]"
                >
                  <span className="font-medium text-yellow-800">{item.detail}</span>
                  <ChevronRight className="w-3 h-3 text-yellow-600" />
                </button>
                {onRemoveFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFavorite(item.id);
                    }}
                    className="p-1 rounded-full hover:bg-yellow-200 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    aria-label={`${item.detail} 즐겨찾기에서 제거`}
                  >
                    <X className="w-4 h-4 text-yellow-600" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 사용 */}
      {displayRecents.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">최근 사용</span>
            <span className="text-xs text-gray-400">({recentItems.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {displayRecents.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-1 px-3 py-2 min-h-[44px] bg-gray-50 border border-gray-200 rounded-full text-sm hover:bg-gray-100 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="flex items-center gap-1 min-h-[36px]"
                >
                  <span className="font-medium text-gray-700">{item.detail}</span>
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                </button>
                {onRemoveRecent && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRecent(item.id);
                    }}
                    className="p-1 rounded-full hover:bg-gray-200 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    aria-label={`${item.detail} 최근 사용에서 제거`}
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
