/**
 * 템플릿 선택 컴포넌트
 *
 * 자주 사용하는 템플릿을 칩 형태로 표시합니다.
 * 클릭 시 폼에 템플릿 데이터를 채웁니다.
 */

'use client';

import { useState } from 'react';
import { useTemplates, ExpenseTemplate } from '@/lib/hooks';

/** 템플릿 선택 시 전달되는 데이터 */
export interface TemplateSelectData {
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail: string;
  description?: string;
  defaultAmount?: number;
}

interface TemplateSelectorProps {
  /** 템플릿 선택 시 콜백 */
  onSelect: (data: TemplateSelectData) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/** 칩에 표시할 최대 템플릿 수 */
const MAX_VISIBLE_CHIPS = 6;

export default function TemplateSelector({ onSelect, disabled = false }: TemplateSelectorProps) {
  const { templates, loading, applyTemplate } = useTemplates();
  const [showAllModal, setShowAllModal] = useState(false);

  // 템플릿이 없으면 표시하지 않음
  if (loading || templates.length === 0) {
    return null;
  }

  const visibleTemplates = templates.slice(0, MAX_VISIBLE_CHIPS);
  const hasMore = templates.length > MAX_VISIBLE_CHIPS;

  /** 템플릿 선택 처리 */
  const handleSelect = async (template: ExpenseTemplate) => {
    // usageCount 증가
    await applyTemplate(template.id);

    // 폼에 데이터 전달
    onSelect({
      budgetCategory: template.budgetCategory,
      budgetSubcategory: template.budgetSubcategory,
      budgetDetail: template.budgetDetail,
      description: template.description || undefined,
      defaultAmount: template.defaultAmount || undefined,
    });

    setShowAllModal(false);
  };

  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-gray-700 mb-2">
        자주 사용하는 템플릿
      </div>

      {/* 칩 목록 */}
      <div className="flex flex-wrap gap-2">
        {visibleTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => handleSelect(template)}
            disabled={disabled}
            className="px-4 py-2 min-h-[48px] bg-brand-50 text-brand-700 border border-brand-100 rounded-full text-sm font-medium hover:bg-brand-100 hover:border-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="truncate max-w-[150px]">{template.name}</span>
            {template.usageCount > 0 && (
              <span className="text-xs text-brand-500">({template.usageCount})</span>
            )}
          </button>
        ))}

        {/* 더보기 버튼 */}
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAllModal(true)}
            disabled={disabled}
            className="px-4 py-2 min-h-[48px] bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            더보기 (+{templates.length - MAX_VISIBLE_CHIPS})
          </button>
        )}
      </div>

      {/* 전체 템플릿 모달 */}
      {showAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowAllModal(false)}>
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                템플릿 선택
              </h3>
              <button
                type="button"
                onClick={() => setShowAllModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 템플릿 목록 */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleSelect(template)}
                    disabled={disabled}
                    className="w-full text-left p-4 min-h-[56px] bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {template.name}
                        </div>
                        <div className="text-sm text-gray-500 truncate mt-1">
                          {template.budgetCategory} &gt; {template.budgetSubcategory} &gt; {template.budgetDetail}
                        </div>
                        {template.description && (
                          <div className="text-sm text-gray-400 truncate mt-1">
                            적요: {template.description}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                        {template.usageCount}회 사용
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 안내 문구 */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                사용 횟수가 많은 순서로 정렬됩니다
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
