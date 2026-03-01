'use client';

import React, { useState, useCallback } from 'react';
import { Layers, Search, List } from 'lucide-react';
import BudgetSelector from '@/components/BudgetSelector';
import BudgetSearchInput from './BudgetSearchInput';
import QuickBudgetList from './QuickBudgetList';
import { useRecentBudgets } from './hooks/useRecentBudgets';
import { useFavoriteBudgets } from './hooks/useFavoriteBudgets';
import { BudgetSearchResult } from './hooks/useBudgetSearch';

type SelectMode = 'hierarchical' | 'search';

export interface BudgetValue {
  committee?: string;
  department?: string;
  category?: string;
  subcategory?: string;
  detail?: string;
}

interface EnhancedBudgetSelectorProps {
  value: BudgetValue;
  onChange: (value: BudgetValue) => void;
  disabled?: boolean;
  showDetail?: boolean;
  onDetailsLoaded?: (details: string[]) => void;
  showQuickAccess?: boolean;
  departmentId?: string;
}

export default function EnhancedBudgetSelector({
  value,
  onChange,
  disabled = false,
  showDetail = true,
  onDetailsLoaded,
  showQuickAccess = true,
  departmentId,
}: EnhancedBudgetSelectorProps) {
  const [mode, setMode] = useState<SelectMode>('hierarchical');

  const { recentItems, addRecentItem, removeRecentItem } = useRecentBudgets();
  const { favoriteItems, toggleFavorite, isFavorite, removeFavorite } = useFavoriteBudgets();

  // 검색 결과 또는 빠른 선택에서 항목 선택 시
  const handleSearchSelect = useCallback((item: BudgetSearchResult) => {
    // 값 업데이트
    onChange({
      committee: item.hierarchy.committee,
      department: item.hierarchy.department,
      category: item.hierarchy.category,
      subcategory: item.hierarchy.subcategory,
      detail: item.hierarchy.detail,
    });

    // 최근 사용에 추가
    addRecentItem(item);

    // 계층 선택 모드로 전환 (선택 결과 확인용)
    setMode('hierarchical');
  }, [onChange, addRecentItem]);

  // 빠른 선택 항목 선택 시 (최근/즐겨찾기)
  const handleQuickSelect = useCallback((item: BudgetSearchResult) => {
    handleSearchSelect(item);
  }, [handleSearchSelect]);

  return (
    <div className="space-y-4">
      {/* 모드 선택 탭 */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setMode('hierarchical')}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'hierarchical'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Layers className="w-4 h-4" />
          계층 선택
        </button>
        <button
          type="button"
          onClick={() => setMode('search')}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            mode === 'search'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Search className="w-4 h-4" />
          검색
        </button>
      </div>

      {/* 빠른 선택 (즐겨찾기 + 최근 사용) */}
      {showQuickAccess && (
        <QuickBudgetList
          favoriteItems={favoriteItems}
          recentItems={recentItems}
          onSelect={handleQuickSelect}
          onRemoveFavorite={removeFavorite}
          onRemoveRecent={removeRecentItem}
        />
      )}

      {/* 모드별 콘텐츠 */}
      {mode === 'hierarchical' ? (
        <BudgetSelector
          value={value}
          onChange={onChange}
          disabled={disabled}
          showDetail={showDetail}
          onDetailsLoaded={onDetailsLoaded}
        />
      ) : (
        <div className="space-y-3">
          <BudgetSearchInput
            departmentId={departmentId}
            onSelect={handleSearchSelect}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            disabled={disabled}
          />

          {/* 현재 선택된 값 표시 */}
          {value.detail && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <span className="font-medium">선택됨:</span>{' '}
                {value.category} &gt; {value.subcategory} &gt; {value.detail}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {value.committee} / {value.department}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 현재 선택 요약 (계층 선택 모드에서) */}
      {mode === 'hierarchical' && value.detail && (
        <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            <span className="text-gray-400">선택:</span>{' '}
            <span className="font-medium text-gray-900">{value.detail}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const item: BudgetSearchResult = {
                id: `${value.category}-${value.subcategory}-${value.detail}`,
                detail: value.detail || '',
                subcategory: value.subcategory || '',
                category: value.category || '',
                fullPath: `${value.category} > ${value.subcategory} > ${value.detail}`,
                managerId: null,
                managerName: null,
                hierarchy: {
                  committee: value.committee || '',
                  department: value.department || '',
                  category: value.category || '',
                  subcategory: value.subcategory || '',
                  detail: value.detail || '',
                },
              };
              toggleFavorite(item);
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {isFavorite(`${value.category}-${value.subcategory}-${value.detail}`) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          </button>
        </div>
      )}
    </div>
  );
}
