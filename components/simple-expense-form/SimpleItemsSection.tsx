/**
 * 간편 지출결의서 세부 항목 섹션
 * 각 항목별 예산(항/목/세목) 선택 기능 포함
 * 첫 번째 항목과 동일한 담당자의 세목만 선택 가능
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Control, useFieldArray, UseFormRegister, UseFormSetValue, useWatch, FieldErrors } from 'react-hook-form';
import {
  SimpleExpenseFormData,
  defaultSimpleExpenseItem,
  calculateAmount,
} from '@/lib/schemas/simple-expense-schema';
import ItemBudgetSelector from './ItemBudgetSelector';
import MemoTooltip from '../expense-form/MemoTooltip';
import { INPUT_BASE, BTN_PRIMARY, BTN_SM, SECTION_CARD, SECTION_TITLE } from '@/lib/constants/styles';
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

interface SimpleItemsSectionProps {
  control: Control<SimpleExpenseFormData>;
  register: UseFormRegister<SimpleExpenseFormData>;
  setValue: UseFormSetValue<SimpleExpenseFormData>;
  errors?: FieldErrors<SimpleExpenseFormData>;
  disabled?: boolean;
  userId?: string;  // 적요 즐겨찾기용 사용자 ID
}

export default function SimpleItemsSection({
  control,
  register,
  setValue,
  errors,
  disabled = false,
  userId,
}: SimpleItemsSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // 첫 번째 항목의 담당자 ID (결재선 비교용)
  const [firstItemManagerId, setFirstItemManagerId] = useState<string | null>(null);

  // 적요 예제 관련 상태
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

  // items 배열 전체를 감시하여 총액 계산
  const items = useWatch({ control, name: 'items' });
  const totalAmount = items?.reduce((sum, item) => sum + (item?.amount || 0), 0) || 0;

  const handleAddItem = () => {
    if (fields.length >= 16) {
      alert('최대 16개까지 항목을 추가할 수 있습니다.');
      return;
    }
    append(defaultSimpleExpenseItem);
  };

  const handleRemoveItem = useCallback((index: number) => {
    if (fields.length === 1) {
      alert('최소 1개의 항목이 필요합니다.');
      return;
    }
    remove(index);

    // 첫 번째 항목이 삭제된 경우, 새로운 첫 번째 항목의 담당자로 업데이트 필요
    // (API에서 담당자 정보를 다시 가져올 때 자동 업데이트됨)
    if (index === 0) {
      setFirstItemManagerId(null);
    }
  }, [fields.length, remove]);

  const handleBudgetChange = useCallback((
    index: number,
    value: { category: string; subcategory: string; detail: string; managerId?: string | null }
  ) => {
    setValue(`items.${index}.budgetCategory`, value.category);
    setValue(`items.${index}.budgetSubcategory`, value.subcategory);
    setValue(`items.${index}.budgetDetail`, value.detail);

    // 첫 번째 항목인 경우 담당자 ID 저장
    if (index === 0) {
      setFirstItemManagerId(value.managerId || null);

      // 첫 번째 항목 세목이 변경되면 이후 항목들의 세목 초기화
      // (결재선이 달라질 수 있으므로)
      for (let i = 1; i < fields.length; i++) {
        setValue(`items.${i}.budgetCategory`, '');
        setValue(`items.${i}.budgetSubcategory`, '');
        setValue(`items.${i}.budgetDetail`, '');
      }
    }
  }, [setValue, fields.length]);

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

  // 적요 필드 블러
  const handleDescriptionBlur = (index: number) => {
    setTimeout(() => {
      setTooltipOpen((prev) => ({ ...prev, [index]: false }));
    }, 150);
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
      <div className="mb-4">
        <h2 className={SECTION_TITLE}>세부 항목</h2>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        예산항목: 하단 예산항목 참조 - 각 항목별로 예산(항/목/세목)을 선택하세요
      </p>

      <div className="space-y-4">
        {fields.map((field, index) => {
          const currentItem = items?.[index];
          return (
            <div key={field.id} className="border border-gray-200 rounded-lg p-4 relative">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium text-gray-900">항목 {index + 1}</h3>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={disabled}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    삭제
                  </button>
                )}
              </div>

              {/* 예산 선택 (항/목/세목) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  예산항목 <span className="text-red-500">*</span>
                  {index > 0 && firstItemManagerId && (
                    <span className="text-xs text-gray-500 ml-2">
                      (첫 번째 항목과 동일 결재선만 선택 가능)
                    </span>
                  )}
                </label>
                <ItemBudgetSelector
                  value={{
                    category: currentItem?.budgetCategory || '',
                    subcategory: currentItem?.budgetSubcategory || '',
                    detail: currentItem?.budgetDetail || '',
                  }}
                  onChange={(value) => handleBudgetChange(index, value)}
                  disabled={disabled}
                  firstItemManagerId={firstItemManagerId}
                  isFirstItem={index === 0}
                />
                {(errors?.items?.[index]?.budgetCategory ||
                  errors?.items?.[index]?.budgetSubcategory ||
                  errors?.items?.[index]?.budgetDetail) && (
                  <p className="mt-1 text-sm text-red-500">예산항목을 모두 선택해주세요</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    적요 <span className="text-red-500">*</span>
                    {currentItem?.budgetDetail && (
                      <span className="text-xs text-gray-400 ml-2">(클릭하면 예제 표시)</span>
                    )}
                  </label>
                  {(() => {
                    const { ref: registerRef, ...rest } = register(`items.${index}.description`);
                    return (
                      <input
                        type="text"
                        {...rest}
                        ref={(el) => {
                          registerRef(el);
                          descriptionRefs.current[index] = el;
                        }}
                        disabled={disabled}
                        placeholder="예: 11월분 식대"
                        onFocus={() => handleDescriptionFocus(index)}
                        onBlur={() => handleDescriptionBlur(index)}
                        className={`${INPUT_BASE} ${errors?.items?.[index]?.description ? 'border-red-500' : ''}`}
                      />
                    );
                  })()}
                  <MemoTooltip
                    examples={memoExamples[index] || []}
                    favorites={memoFavorites.map((f) => f.memo)}
                    currentValue={currentItem?.description || ''}
                    isOpen={tooltipOpen[index] || false}
                    onSelect={(example) => handleMemoSelect(index, example)}
                    onClose={() => setTooltipOpen((prev) => ({ ...prev, [index]: false }))}
                    onToggleFavorite={(memo) => toggleMemoFavorite(memo, currentItem?.budgetDetail)}
                    isFavorite={isMemoFavorite}
                    inputRef={{ current: descriptionRefs.current[index] }}
                    loading={memoLoading[index] || false}
                  />
                  {errors?.items?.[index]?.description && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.items[index].description?.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    단가 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumber(currentItem?.unitPrice)}
                    onChange={(e) => setValue(`items.${index}.unitPrice`, parseNumber(e.target.value))}
                    disabled={disabled}
                    placeholder="0"
                    className={`${INPUT_BASE} min-h-[48px] ${errors?.items?.[index]?.unitPrice ? 'border-red-500' : ''}`}
                  />
                  {errors?.items?.[index]?.unitPrice && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.items[index].unitPrice?.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    인원(수량) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    disabled={disabled}
                    min="1"
                    className={`${INPUT_BASE} min-h-[48px] ${errors?.items?.[index]?.quantity ? 'border-red-500' : ''}`}
                  />
                  {errors?.items?.[index]?.quantity && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.items[index].quantity?.message}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    금액 (자동 계산)
                  </label>
                  <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-semibold">
                    {(currentItem?.amount || 0).toLocaleString('ko-KR')}원
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 항목 추가 버튼 - 목록 아래에 배치 */}
      {fields.length < 16 && (
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

      {/* 총액 */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900">총 청구금액</span>
          <span className="text-2xl font-bold text-blue-500">
            {totalAmount.toLocaleString('ko-KR')}원
          </span>
        </div>
      </div>
    </div>
  );
}
