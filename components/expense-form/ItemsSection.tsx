/**
 * 세부 항목 섹션 컴포넌트
 */

'use client';

import { Control, useFieldArray, UseFormRegister, UseFormSetValue, useWatch, FieldErrors } from 'react-hook-form';
import { ExpenseFormData, defaultExpenseItem, calculateAmount } from '@/lib/schemas/expense-schema';
import { INPUT_BASE, SELECT_BASE, BTN_PRIMARY, BTN_SM, SECTION_CARD, SECTION_TITLE } from '@/lib/constants/styles';
import { VoiceInputButton } from '@/components/mobile/VoiceInput';
import LocationPicker from '@/components/mobile/LocationPicker';

interface ItemsSectionProps {
  control: Control<ExpenseFormData>;
  register: UseFormRegister<ExpenseFormData>;
  setValue: UseFormSetValue<ExpenseFormData>;
  errors?: FieldErrors<ExpenseFormData>;
  disabled?: boolean;
  detailOptions?: string[];  // 사용 가능한 세목 목록
}

export default function ItemsSection({
  control,
  register,
  setValue,
  errors,
  disabled = false,
  detailOptions = [],
}: ItemsSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // items 배열 전체를 감시하여 총액 계산
  const items = useWatch({ control, name: 'items' });
  const totalAmount = items?.reduce((sum, item) => sum + (item?.amount || 0), 0) || 0;

  const handleAddItem = () => {
    if (fields.length >= 10) {
      alert('최대 10개까지 항목을 추가할 수 있습니다.');
      return;
    }
    append(defaultExpenseItem);
  };

  const handleRemoveItem = (index: number) => {
    if (fields.length === 1) {
      alert('최소 1개의 항목이 필요합니다.');
      return;
    }
    remove(index);
  };

  const handleUnitPriceOrQuantityChange = (index: number, field: 'unitPrice' | 'quantity', value: string) => {
    const numValue = Number(value);
    setValue(`items.${index}.${field}`, numValue);

    // 금액 자동 계산
    const currentItem = items?.[index];
    if (currentItem) {
      const unitPrice = field === 'unitPrice' ? numValue : currentItem.unitPrice;
      const quantity = field === 'quantity' ? numValue : currentItem.quantity;
      const amount = calculateAmount(unitPrice, quantity);
      setValue(`items.${index}.amount`, amount);
    }
  };

  return (
    <div className={SECTION_CARD}>
      {/* 헤더 - 모바일에서 세로 정렬 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <h2 className={SECTION_TITLE}>세부 항목</h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {fields.length}/10개
          </span>
        </div>
        <button
          type="button"
          onClick={handleAddItem}
          disabled={disabled || fields.length >= 10}
          className={`${BTN_PRIMARY} ${BTN_SM} w-full sm:w-auto`}
        >
          + 항목 추가
        </button>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  예산(세목) <span className="text-red-500">*</span>
                </label>
                {detailOptions.length > 0 ? (
                  <select
                    {...register(`items.${index}.budgetDetail`)}
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

              {/* 적요 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  적요 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    {...register(`items.${index}.description`)}
                    disabled={disabled}
                    placeholder="상세 설명"
                    className={`${INPUT_BASE} flex-1 ${errors?.items?.[index]?.description ? 'border-red-500' : ''}`}
                  />
                  {/* 모바일 음성 입력 버튼 */}
                  <VoiceInputButton
                    onTranscript={(text) => setValue(`items.${index}.description`, text)}
                    disabled={disabled}
                  />
                </div>
                {errors?.items?.[index]?.description && (
                  <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.items[index].description.message}</p>
                )}
                {/* 모바일 위치 입력 - 임시 비활성화
                {index === 0 && (
                  <div className="mt-2">
                    <LocationPicker
                      onLocationSelect={(location) => {
                        const currentDesc = items?.[index]?.description || '';
                        const newDesc = currentDesc ? `${currentDesc} (${location})` : location;
                        setValue(`items.${index}.description`, newDesc);
                      }}
                    />
                  </div>
                )}
                */}
              </div>

              {/* 단가 & 수량 - 모바일에서 2열 그리드 */}
              <div className="grid grid-cols-2 gap-3 md:contents">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    단가 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    {...register(`items.${index}.unitPrice`, {
                      valueAsNumber: true,
                      onChange: (e) => handleUnitPriceOrQuantityChange(index, 'unitPrice', e.target.value),
                    })}
                    disabled={disabled}
                    min="1"
                    placeholder="0"
                    className={`${INPUT_BASE} ${errors?.items?.[index]?.unitPrice ? 'border-red-500' : ''}`}
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
                    type="number"
                    {...register(`items.${index}.quantity`, {
                      valueAsNumber: true,
                      onChange: (e) => handleUnitPriceOrQuantityChange(index, 'quantity', e.target.value),
                    })}
                    disabled={disabled}
                    min="1"
                    placeholder="0"
                    className={`${INPUT_BASE} ${errors?.items?.[index]?.quantity ? 'border-red-500' : ''}`}
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
