/**
 * 빠른 세목 접근 컴포넌트
 * 즐겨찾기 및 최근 사용 세목을 표시
 */

'use client';

import { Star, Clock, X } from 'lucide-react';
import type { FavoriteBudget, RecentBudgetUsage, StoredBudgetDetail } from '@/lib/db/budget-preferences-types';

interface QuickBudgetAccessProps {
  favorites: FavoriteBudget[];
  recentItems: RecentBudgetUsage[];
  onSelect: (budget: StoredBudgetDetail) => void;
  onToggleFavorite: (budget: StoredBudgetDetail) => void;
  onRemoveRecent: (budgetId: string) => void;
  isFavorite: (budgetId: string) => boolean;
  /** 결재선 필터용 담당자 ID (null이면 모두 허용) */
  availableManagerId?: string | null;
  disabled?: boolean;
}

export default function QuickBudgetAccess({
  favorites,
  recentItems,
  onSelect,
  onToggleFavorite,
  onRemoveRecent,
  isFavorite,
  availableManagerId,
  disabled = false,
}: QuickBudgetAccessProps) {
  // 결재선 필터 적용
  const filteredFavorites = availableManagerId
    ? favorites.filter((f) => f.budget.managerId === availableManagerId)
    : favorites;

  const filteredRecents = availableManagerId
    ? recentItems.filter((r) => r.budget.managerId === availableManagerId)
    : recentItems;

  // 표시할 항목이 없으면 렌더링 안함
  if (filteredFavorites.length === 0 && filteredRecents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-3">
      {/* 즐겨찾기 섹션 */}
      {filteredFavorites.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs text-yellow-700 mb-1.5">
            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
            <span>즐겨찾기</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filteredFavorites.map((fav) => (
              <BudgetChip
                key={fav.id}
                budget={fav.budget}
                variant="favorite"
                isFavorite={true}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* 최근 사용 섹션 */}
      {filteredRecents.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5">
            <Clock className="w-3 h-3" />
            <span>최근 사용</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filteredRecents.map((recent) => (
              <BudgetChip
                key={recent.id}
                budget={recent.budget}
                variant="recent"
                isFavorite={isFavorite(recent.budgetId)}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
                onRemove={() => onRemoveRecent(recent.budgetId)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface BudgetChipProps {
  budget: StoredBudgetDetail;
  variant: 'favorite' | 'recent';
  isFavorite: boolean;
  onSelect: (budget: StoredBudgetDetail) => void;
  onToggleFavorite: (budget: StoredBudgetDetail) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

function BudgetChip({
  budget,
  variant,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onRemove,
  disabled,
}: BudgetChipProps) {
  const baseClasses = 'group relative flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors min-h-[32px]';
  const variantClasses = variant === 'favorite'
    ? 'bg-yellow-50 border border-yellow-200 hover:bg-yellow-100'
    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return (
    <div className={`${baseClasses} ${variantClasses} ${disabledClasses}`}>
      {/* 메인 클릭 영역 */}
      <button
        type="button"
        onClick={() => !disabled && onSelect(budget)}
        disabled={disabled}
        className="flex-1 text-left flex flex-col"
      >
        <span className="font-medium text-gray-900 truncate max-w-[150px]">
          {budget.name}
        </span>
        <span className="text-[10px] text-gray-500 truncate max-w-[150px]">
          {budget.category} &gt; {budget.subcategory}
        </span>
      </button>

      {/* 액션 버튼들 */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* 즐겨찾기 토글 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onToggleFavorite(budget);
          }}
          disabled={disabled}
          className="p-0.5 hover:bg-white/50 rounded"
          title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          <Star
            className={`w-3 h-3 ${
              isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'
            }`}
          />
        </button>

        {/* 제거 버튼 (최근 사용만) */}
        {variant === 'recent' && onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onRemove();
            }}
            disabled={disabled}
            className="p-0.5 hover:bg-white/50 rounded"
            title="최근 사용에서 제거"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}
