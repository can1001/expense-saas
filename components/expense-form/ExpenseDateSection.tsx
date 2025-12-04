/**
 * 지출일자 섹션 컴포넌트
 */

'use client';

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { ExpenseFormData } from '@/lib/schemas/expense-schema';

interface ExpenseDateSectionProps {
  register: UseFormRegister<ExpenseFormData>;
  errors: FieldErrors<ExpenseFormData>;
  disabled?: boolean;
}

export default function ExpenseDateSection({
  register,
  errors,
  disabled = false,
}: ExpenseDateSectionProps) {
  const inputClasses =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400';

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">지출 정보</h2>
      <div>
        <label htmlFor="expenseDate" className="block text-sm font-medium text-gray-700 mb-2">
          지출일자 (선택사항)
        </label>
        <input
          type="date"
          id="expenseDate"
          {...register('expenseDate')}
          disabled={disabled}
          className={inputClasses}
        />
        {errors.expenseDate && (
          <p className="mt-1 text-sm text-red-600">{errors.expenseDate.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">재정팀에서 입력하는 항목입니다.</p>
      </div>
    </div>
  );
}
