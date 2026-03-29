/**
 * 세부 항목 섹션 컴포넌트
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Control, useFieldArray, UseFormRegister, UseFormSetValue, useWatch, FieldErrors } from 'react-hook-form';
import { ExpenseFormData, defaultExpenseItem, calculateAmount } from '@/lib/schemas/expense-schema';
import { INPUT_BASE, SELECT_BASE, BTN_PRIMARY, BTN_SM, SECTION_CARD, SECTION_TITLE } from '@/lib/constants/styles';
import { VoiceInputButton } from '@/components/mobile/VoiceInput';
import MemoTooltip from './MemoTooltip';
import { useMemoPreferences } from '@/lib/hooks/useMemoPreferences';

// 천 단위 구분 포맷 함수
const formatNumber = (value: number | undefined): string => {
  if (value === undefined || value === 0) return '';
  return value.toLocaleString('ko-KR');
};

// 문자열에서 숫자만 추출
const parseNumber = (value: string): number => {
  const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
};

interface ItemsSectionProps {
  control: Control<ExpenseFormData>;
  register: UseFormRegister<ExpenseFormData>;
  setValue: UseFormSetValue<ExpenseFormData>;
  errors?: FieldErrors<ExpenseFormData>;
  disabled?: boolean;
  detailOptions?: string[];  // 사용 가능한 세목 목록
  userId?: string;  // 적요 즐겨찾기용 사용자 ID
}

export default function ItemsSection({
  control,
  register,
  setValue,
  errors,
  disabled = false,
  detailOptions = [],
  userId,
}: ItemsSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // items 배열 전체를 감시하여 총액 계산
  const items = useWatch({ control, name: 'items' });
  const totalAmount = items?.reduce((sum, item) => sum + (item?.amount || 0), 0) || 0;

  // 적요 예제 툴팁 상태
  const [memoExamples, setMemoExamples] = useState<Record<number, string[]>>({});
  const [tooltipOpen, setTooltipOpen] = useState<Record<number, boolean>>({});
  const [memoLoading, setMemoLoading] = useState<Record<number, boolean>>({});
  const descriptionRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 적요 즐겨찾기 훅
  const {
    favorites: memoFavorites,
    toggleFavorite: toggleMemoFavorite,
    isFavorite: isMemoFavorite,
  } = useMemoPreferences(userId);

  // 적요 예제 로드
  const loadMemoExamples = useCallback(async (index: number, budgetDetailName: string) => {
    if (!budgetDetailName) {
      setMemoExamples((prev) => ({ ...prev, [index]: [] }));
      return;
    }

    setMemoLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(`/api/budget/memo-examples?budgetDetailName=${encodeURIComponent(budgetDetailName)}`);
      if (res.ok) {
        const data = await res.json();
        setMemoExamples((prev) => ({ ...prev, [index]: data.examples || [] }));
      }
    } catch (error) {
      console.error('적요 예제 로드 실패:', error);
    } finally {
      setMemoLoading((prev) => ({ ...prev, [index]: false }));
    }
  }, []);

  // 적요 예제 선택
  const handleMemoSelect = (index: number, example: string) => {
    setValue(`items.${index}.description`, example);
    setTooltipOpen((prev) => ({ ...prev, [index]: false }));
    descriptionRefs.current[index]?.focus();
  };

  // 적요 필드 포커스
  const handleDescriptionFocus = (index: number) => {
    const budgetDetail = items?.[index]?.budgetDetail;
    if (budgetDetail && !memoExamples[index]) {
      loadMemoExamples(index, budgetDetail);
    }
    setTooltipOpen((prev) => ({ ...prev, [index]: true }));
  };

  // 적요 필드 블러 (약간의 딜레이 후 닫기 - 클릭 이벤트 처리를 위해)
  const handleDescriptionBlur = (index: number) => {
    setTimeout(() => {
      setTooltipOpen((prev) => ({ ...prev, [index]: false }));
    }, 150);
  };

  // 적요 필드에서 Enter 키 입력 시 폼 제출 방지
  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const handleAddItem = () => {
    if (fields.length >= 10) {
      alert('최대 10개까지 항목을 추가할 수 있습니다.');
      return;
    }

    // 첫 번째 항목의 예산 정보를 복사 (일반 지출결의서는 모든 항목이 동일 예산 계층 사용)
    const firstItem = items?.[0];
    const newItem = {
      ...defaultExpenseItem,
      budgetCategory: firstItem?.budgetCategory || '',
      budgetSubcategory: firstItem?.budgetSubcategory || '',
      budgetDetail: firstItem?.budgetDetail || '',
    };

    append(newItem);
  };

  const handleRemoveItem = (index: number) => {
    if (fields.length === 1) {
      alert('최소 1개의 항목이 필요합니다.');
      return;
    }
    remove(index);
  };

  // 단가/수량 변경 시 금액 자동 계산 (useEffect로 분리하여 register와 충돌 방지)
  useEffect(() => {
    items?.forEach((item, index) => {
      if (item) {
        const calculatedAmount = calculateAmount(item.unitPrice || 0, item.quantity || 0);
        if (item.amount !== calculatedAmount) {
          setValue(`items.${index}.amount`, calculatedAmount);
        }
      }
    });
  }, [items, setValue]);

  return (
    <div className={SECTION_CARD}>
      {/* 헤더 */}
      <div className="flex items-center justify-between sm:justify-start gap-3 mb-4">
        <h2 className={SECTION_TITLE}>세부 항목</h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {fields.length}/10개
        </span>
      </div>

      {/* 예산(목) 미선택 안내 */}
      {detailOptions.length === 0 && (
        <div className="mb-4 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
          예산(목)을 먼저 선택하면 세목을 드롭다운에서 선택할 수 있습니다.
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 relative bg-white">
            {/* 항목 헤더 - 터치 친화적 삭제 버튼 */}
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </span>
                <span className="hidden sm:inline">항목</span>
              </h3>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  disabled={disabled}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                >
                  <span className="hidden sm:inline">삭제</span>
                  <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* 예산(세목) */}
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  예산(세목) <span className="text-red-500">*</span>
                </label>
                {detailOptions.length > 0 ? (
                  <select
                    {...register(`items.${index}.budgetDetail`, {
                      onChange: (e) => {
                        const newValue = e.target.value;
                        if (newValue) {
                          loadMemoExamples(index, newValue);
                        } else {
                          setMemoExamples((prev) => ({ ...prev, [index]: [] }));
                        }
                      },
                    })}
                    disabled={disabled}
                    className={`${SELECT_BASE} ${errors?.items?.[index]?.budgetDetail ? 'border-red-500' : ''}`}
                  >
                    <option value="">세목 선택</option>
                    {detailOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    {...register(`items.${index}.budgetDetail`)}
                    disabled={disabled}
                    placeholder="예산(목)을 먼저 선택하세요"
                    className={`${INPUT_BASE} ${errors?.items?.[index]?.budgetDetail ? 'border-red-500' : ''}`}
                  />
                )}
                {errors?.items?.[index]?.budgetDetail && (
                  <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.items[index].budgetDetail.message}</p>
                )}
              </div>

              {/* 적요 - 한 행 전체 너비 */}
              <div className="relative md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  적요 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 relative">
                  <input
                    type="text"
                    {...register(`items.${index}.description`)}
                    ref={(el) => {
                      descriptionRefs.current[index] = el;
                      register(`items.${index}.description`).ref(el);
                    }}
                    disabled={disabled}
                    placeholder="상세 설명"
                    onFocus={() => handleDescriptionFocus(index)}
                    onBlur={() => handleDescriptionBlur(index)}
                    onKeyDown={handleDescriptionKeyDown}
                    className={`${INPUT_BASE} flex-1 ${errors?.items?.[index]?.description ? 'border-red-500' : ''}`}
                  />
                  {/* 모바일 음성 입력 버튼 */}
                  <VoiceInputButton
                    onTranscript={(text) => setValue(`items.${index}.description`, text)}
                    disabled={disabled}
                  />
                  {/* 적요 예제 툴팁 */}
                  <MemoTooltip
                    examples={memoExamples[index] || []}
                    favorites={memoFavorites.map((f) => f.memo)}
                    currentValue={items?.[index]?.description || ''}
                    isOpen={tooltipOpen[index] && (memoExamples[index]?.length > 0 || memoFavorites.length > 0 || memoLoading[index])}
                    onSelect={(example) => handleMemoSelect(index, example)}
                    onClose={() => setTooltipOpen((prev) => ({ ...prev, [index]: false }))}
                    onToggleFavorite={(memo) => toggleMemoFavorite(memo, items?.[index]?.budgetDetail)}
                    isFavorite={isMemoFavorite}
                    inputRef={{ current: descriptionRefs.current[index] }}
                    loading={memoLoading[index]}
                  />
                </div>
                {errors?.items?.[index]?.description && (
                  <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.items[index].description.message}</p>
                )}
              </div>

              {/* 단가 & 수량 - 모바일에서 2열 그리드 */}
              <div className="grid grid-cols-2 gap-3 md:contents">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    단가 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(items?.[index]?.unitPrice)}
                    onChange={(e) => setValue(`items.${index}.unitPrice`, parseNumber(e.target.value))}
                    disabled={disabled}
                    placeholder="0"
                    className={`${INPUT_BASE} text-right ${errors?.items?.[index]?.unitPrice ? 'border-red-500' : ''}`}
                  />
                  {errors?.items?.[index]?.unitPrice && (
                    <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.items[index].unitPrice.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    수량 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(items?.[index]?.quantity)}
                    onChange={(e) => setValue(`items.${index}.quantity`, parseNumber(e.target.value))}
                    disabled={disabled}
                    placeholder="0"
                    className={`${INPUT_BASE} text-right ${errors?.items?.[index]?.quantity ? 'border-red-500' : ''}`}
                  />
                  {errors?.items?.[index]?.quantity && (
                    <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.items[index].quantity.message}</p>
                  )}
                </div>
              </div>

              {/* 금액 (자동 계산) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  금액 (자동 계산)
                </label>
                <div className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 font-semibold text-right min-h-[44px] flex items-center justify-end">
                  {(items?.[index]?.amount || 0).toLocaleString('ko-KR')}원
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 항목 추가 버튼 - 목록 아래에 배치 */}
      {fields.length < 10 && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleAddItem}
            disabled={disabled}
            className={`${BTN_PRIMARY} ${BTN_SM}`}
          >
            + 항목 추가
          </button>
        </div>
      )}

      {/* 총액 - 모바일에서 눈에 띄게 */}
      <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t-2 border-gray-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
          <span className="text-base sm:text-lg font-semibold text-gray-900">총 청구금액</span>
          <span className="text-2xl sm:text-3xl font-bold text-blue-600">
            {totalAmount.toLocaleString('ko-KR')}원
          </span>
        </div>
      </div>
    </div>
  );
}
