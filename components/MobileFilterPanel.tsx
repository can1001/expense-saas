'use client';

import { useEffect } from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';

interface FilterState {
  committee: string;
  department: string;
  budgetCategory: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  paymentStatus: string;
  approvedStartDate: string;
  approvedEndDate: string;
}

interface MobileFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFilterChange: (field: string, value: string) => void;
  onClearFilters: () => void;
  uniqueCommittees: string[];
  uniqueDepartments: string[];
  uniqueCategories: string[];
}

export default function MobileFilterPanel({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onClearFilters,
  uniqueCommittees,
  uniqueDepartments,
  uniqueCategories,
}: MobileFilterPanelProps) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // 활성화된 필터 개수 계산
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const selectClasses = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 min-h-[48px]";
  const inputClasses = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 min-h-[48px]";
  const labelClasses = "block text-sm font-medium text-gray-700 mb-2";

  return (
    <>
      {/* 오버레이 */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 바텀시트 패널 */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl transform transition-transform duration-300 ease-out max-h-[85vh] flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">필터</h2>
            {activeFilterCount > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="닫기"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 필터 내용 - 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* 위원회 */}
          <div>
            <label className={labelClasses}>위원회</label>
            <select
              value={filters.committee}
              onChange={(e) => onFilterChange('committee', e.target.value)}
              className={selectClasses}
            >
              <option value="">전체</option>
              {uniqueCommittees.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 사역팀 */}
          <div>
            <label className={labelClasses}>사역팀(부)</label>
            <select
              value={filters.department}
              onChange={(e) => onFilterChange('department', e.target.value)}
              className={selectClasses}
            >
              <option value="">전체</option>
              {uniqueDepartments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* 예산(항) */}
          <div>
            <label className={labelClasses}>예산(항)</label>
            <select
              value={filters.budgetCategory}
              onChange={(e) => onFilterChange('budgetCategory', e.target.value)}
              className={selectClasses}
            >
              <option value="">전체</option>
              {uniqueCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 지급 상태 */}
          <div>
            <label className={labelClasses}>지급 상태</label>
            <select
              value={filters.paymentStatus}
              onChange={(e) => onFilterChange('paymentStatus', e.target.value)}
              className={selectClasses}
            >
              <option value="">전체</option>
              <option value="PENDING">지급대기</option>
              <option value="HOLD">지급보류</option>
              <option value="CANCELLED">지급취소</option>
              <option value="COMPLETED">지급완료</option>
            </select>
          </div>

          {/* 날짜 범위 */}
          <div>
            <label className={labelClasses}>날짜 범위</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => onFilterChange('startDate', e.target.value)}
                className={`flex-1 ${inputClasses}`}
              />
              <span className="text-gray-500 flex-shrink-0">~</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => onFilterChange('endDate', e.target.value)}
                className={`flex-1 ${inputClasses}`}
              />
            </div>
          </div>

          {/* 금액 범위 */}
          <div>
            <label className={labelClasses}>금액 범위 (원)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={filters.minAmount}
                onChange={(e) => onFilterChange('minAmount', e.target.value)}
                placeholder="최소"
                className={`flex-1 ${inputClasses}`}
              />
              <span className="text-gray-500 flex-shrink-0">~</span>
              <input
                type="number"
                value={filters.maxAmount}
                onChange={(e) => onFilterChange('maxAmount', e.target.value)}
                placeholder="최대"
                className={`flex-1 ${inputClasses}`}
              />
            </div>
          </div>

          {/* 최종승인일 범위 */}
          <div>
            <label className={labelClasses}>최종승인일 범위</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.approvedStartDate}
                onChange={(e) => onFilterChange('approvedStartDate', e.target.value)}
                className={`flex-1 ${inputClasses}`}
              />
              <span className="text-gray-500 flex-shrink-0">~</span>
              <input
                type="date"
                value={filters.approvedEndDate}
                onChange={(e) => onFilterChange('approvedEndDate', e.target.value)}
                className={`flex-1 ${inputClasses}`}
              />
            </div>
          </div>
        </div>

        {/* 하단 버튼 영역 - safe-area 패딩 적용 */}
        <div
          className="flex gap-3 p-4 border-t border-gray-200 bg-white"
          style={{ paddingBottom: 'calc(16px + var(--bottom-safe-area, 0px))' }}
        >
          <button
            onClick={onClearFilters}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px] font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[48px] font-medium"
          >
            적용하기
          </button>
        </div>
      </div>
    </>
  );
}

// 필터 버튼 컴포넌트 (헤더에서 사용)
export function MobileFilterButton({
  onClick,
  activeCount,
}: {
  onClick: () => void;
  activeCount: number;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
    >
      <Filter className="w-5 h-5" />
      <span className="sm:inline hidden">필터</span>
      {activeCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}
