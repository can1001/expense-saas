/**
 * 세부 항목 섹션 컴포넌트
 */

'use client';

import { Control, useFieldArray, UseFormRegister, UseFormSetValue, useWatch } from 'react-hook-form';
import { ExpenseFormData, defaultExpenseItem, calculateAmount } from '@/lib/schemas/expense-schema';

interface ItemsSectionProps {
  control: Control<ExpenseFormData>;
  register: UseFormRegister<ExpenseFormData>;
  setValue: UseFormSetValue<ExpenseFormData>;
  disabled?: boolean;
}

export default function ItemsSection({
  control,
  register,
  setValue,
  disabled = false,
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

  const inputClasses =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400';

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">세부 항목</h2>
        <button
          type="button"
          onClick={handleAddItem}
          disabled={disabled || fields.length >= 10}
          className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          + 항목 추가
        </button>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  예산(세목) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register(`items.${index}.budgetDetail`)}
                  disabled={disabled}
                  placeholder="예: 교육자료비"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  적요 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register(`items.${index}.description`)}
                  disabled={disabled}
                  placeholder="상세 설명"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  단가 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  {...register(`items.${index}.unitPrice`, {
                    onChange: (e) => handleUnitPriceOrQuantityChange(index, 'unitPrice', e.target.value),
                  })}
                  disabled={disabled}
                  min="0"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  인원(수량) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  {...register(`items.${index}.quantity`, {
                    onChange: (e) => handleUnitPriceOrQuantityChange(index, 'quantity', e.target.value),
                  })}
                  disabled={disabled}
                  min="1"
                  className={inputClasses}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  금액 (자동 계산)
                </label>
                <div className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-semibold">
                  {(items?.[index]?.amount || 0).toLocaleString('ko-KR')}원
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

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
