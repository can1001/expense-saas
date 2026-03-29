/**
 * 항목별 예산 선택기 컴포넌트
 * 세목 선택 시 항/목 자동 설정
 * 결재선이 다른 세목은 비활성화 처리
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { SELECT_BASE, INPUT_DISABLED, SPINNER } from '@/lib/constants/styles';

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
    } else {
      onChange({ ...value, detail: detailName, managerId: null });
    }
  };

  // 선택 가능한 세목만 필터링 (첫 번째 항목과 동일 결재선)
  const availableDetails = allDetails.filter((detail) => {
    if (isFirstItem) return true;
    if (!firstItemManagerId) return true;
    return detail.managerId === firstItemManagerId;
  });

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

      {/* 세목 선택 (메인) */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">세목 선택</label>
        <select
          value={value.detail || ''}
          onChange={(e) => handleDetailChange(e.target.value)}
          disabled={disabled || availableDetails.length === 0}
          className={selectClasses}
        >
          <option value="">세목을 선택하세요</option>
          {availableDetails.map((detail) => (
            <option
              key={`${detail.category}-${detail.subcategory}-${detail.name}`}
              value={detail.name}
            >
              {detail.name}
            </option>
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
