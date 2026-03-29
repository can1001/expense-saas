/**
 * 항목별 예산 선택기 컴포넌트
 * 세목 선택 시 항/목 자동 설정
 * 결재선이 다른 세목은 비활성화 처리
 * 즐겨찾기 및 최근 사용 세목 지원
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import { SELECT_BASE, INPUT_BASE, INPUT_DISABLED, SPINNER } from '@/lib/constants/styles';
import { useFetchCurrentUser, useBudgetPreferences } from '@/lib/hooks';
import { createStoredBudgetDetail } from '@/lib/db/budget-preferences-types';
import QuickBudgetAccess from './QuickBudgetAccess';

interface BudgetDetailInfo {
  name: string;
  category: string;
  subcategory: string;
  managerId: string | null;
  managerName: string | null;
}

interface BudgetValue {
  category: string;
  subcategory: string;
  detail: string;
  managerId?: string | null;
}

interface ItemBudgetSelectorProps {
  value: {
    category: string;
    subcategory: string;
    detail: string;
  };
  onChange: (value: BudgetValue) => void;
  disabled?: boolean;
  /** 첫 번째 항목의 담당자 ID (결재선 비교용) */
  firstItemManagerId?: string | null;
  /** 첫 번째 항목 여부 */
  isFirstItem?: boolean;
}

export default function ItemBudgetSelector({
  value,
  onChange,
  disabled = false,
  firstItemManagerId,
  isFirstItem = false,
}: ItemBudgetSelectorProps) {
  const [allDetails, setAllDetails] = useState<BudgetDetailInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 현재 사용자 정보 (즐겨찾기/최근사용용)
  const { user } = useFetchCurrentUser();

  // 즐겨찾기 및 최근 사용 훅
  const {
    favorites,
    recentItems,
    isFavorite,
    toggleFavorite,
    recordUsage,
    removeFromRecent,
  } = useBudgetPreferences(user?.id);

  // 모든 세목 목록 로드 (부모 정보 포함)
  const fetchAllDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/budget/simple/all-details');
      if (!response.ok) throw new Error('Failed to fetch details');
      const data = await response.json();
      setAllDetails(data.details || []);
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchAllDetails();
  }, [fetchAllDetails]);

  // 세목 선택 시 항/목 자동 설정 (담당자 정보 포함)
  const handleDetailChange = (detailName: string) => {
    if (!detailName) {
      onChange({ category: '', subcategory: '', detail: '', managerId: null });
      return;
    }

    // 선택한 세목의 부모 정보 찾기
    const selectedDetail = allDetails.find((d) => d.name === detailName);
    if (selectedDetail) {
      onChange({
        category: selectedDetail.category,
        subcategory: selectedDetail.subcategory,
        detail: detailName,
        managerId: selectedDetail.managerId,
      });

      // 사용 기록 저장
      const storedDetail = createStoredBudgetDetail(
        selectedDetail.name,
        selectedDetail.category,
        selectedDetail.subcategory,
        selectedDetail.managerId,
        selectedDetail.managerName
      );
      recordUsage(storedDetail);
    } else {
      onChange({ ...value, detail: detailName, managerId: null });
    }
  };

  // 빠른 접근에서 세목 선택
  const handleQuickSelect = (budget: { name: string; category: string; subcategory: string; managerId: string | null }) => {
    onChange({
      category: budget.category,
      subcategory: budget.subcategory,
      detail: budget.name,
      managerId: budget.managerId,
    });
  };

  // 현재 선택된 세목의 StoredBudgetDetail 생성
  const currentSelectedDetail = value.detail
    ? allDetails.find((d) => d.name === value.detail)
    : null;

  const currentStoredDetail = currentSelectedDetail
    ? createStoredBudgetDetail(
        currentSelectedDetail.name,
        currentSelectedDetail.category,
        currentSelectedDetail.subcategory,
        currentSelectedDetail.managerId,
        currentSelectedDetail.managerName
      )
    : null;

  // 선택 가능한 세목만 필터링 (첫 번째 항목과 동일 결재선)
  const availableDetails = allDetails.filter((detail) => {
    if (isFirstItem) return true;
    if (!firstItemManagerId) return true;
    return detail.managerId === firstItemManagerId;
  });

  // 검색어로 필터링 (세목명, 항, 목 모두 검색)
  const filteredDetails = availableDetails.filter((detail) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      detail.name.toLowerCase().includes(term) ||
      detail.category.toLowerCase().includes(term) ||
      detail.subcategory.toLowerCase().includes(term)
    );
  });

  // 항/목 기준 그룹화
  const groupedDetails = filteredDetails.reduce((acc, detail) => {
    const groupKey = `${detail.category} > ${detail.subcategory}`;
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(detail);
    return acc;
  }, {} as Record<string, BudgetDetailInfo[]>);

  const selectClasses = `${SELECT_BASE} ${disabled ? INPUT_DISABLED : ''} text-sm py-1.5`;
  const readonlyClasses = `${SELECT_BASE} text-sm py-1.5 bg-gray-100 text-gray-700`;

  return (
    <div className="space-y-2">
      {/* 항/목 자동 표시 (읽기 전용) - 세목 위에 표시 */}
      {value.detail && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">예산(항)</label>
            <div className={readonlyClasses}>{value.category || '-'}</div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">예산(목)</label>
            <div className={readonlyClasses}>{value.subcategory || '-'}</div>
          </div>
        </div>
      )}

      {/* 선택된 세목 즐겨찾기 토글 */}
      {value.detail && currentStoredDetail && (
        <div className="flex items-center justify-between bg-gray-50 px-2 py-1.5 rounded">
          <span className="text-sm text-gray-700">{value.detail}</span>
          <button
            type="button"
            onClick={() => toggleFavorite(currentStoredDetail)}
            disabled={disabled}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title={isFavorite(currentStoredDetail.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            <Star
              className={`w-4 h-4 ${
                isFavorite(currentStoredDetail.id)
                  ? 'fill-yellow-500 text-yellow-500'
                  : 'text-gray-400'
              }`}
            />
          </button>
        </div>
      )}

      {/* 빠른 접근 (즐겨찾기 + 최근 사용) */}
      {!disabled && (
        <QuickBudgetAccess
          favorites={favorites}
          recentItems={recentItems}
          onSelect={handleQuickSelect}
          onToggleFavorite={toggleFavorite}
          onRemoveRecent={removeFromRecent}
          isFavorite={isFavorite}
          availableManagerId={isFirstItem ? null : firstItemManagerId}
          disabled={disabled}
        />
      )}

      {/* 세목 검색 */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">세목 검색</label>
        <input
          type="text"
          placeholder="세목명, 항, 목으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled}
          className={`${INPUT_BASE} text-sm py-1.5`}
        />
      </div>

      {/* 세목 선택 (메인) */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          세목 선택 {searchTerm && `(${filteredDetails.length}건)`}
        </label>
        <select
          value={value.detail || ''}
          onChange={(e) => handleDetailChange(e.target.value)}
          disabled={disabled || filteredDetails.length === 0}
          className={selectClasses}
        >
          <option value="">세목을 선택하세요</option>
          {Object.entries(groupedDetails).map(([groupLabel, details]) => (
            <optgroup key={groupLabel} label={groupLabel}>
              {details.map((detail) => (
                <option
                  key={`${detail.category}-${detail.subcategory}-${detail.name}`}
                  value={detail.name}
                >
                  {detail.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <div className={`${SPINNER} w-3 h-3`}></div>
          <span>로딩 중...</span>
        </div>
      )}
    </div>
  );
}
