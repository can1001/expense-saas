/**
 * 지출일자 섹션 컴포넌트
 */

'use client';

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { ExpenseFormData } from '@/lib/schemas/expense-schema';
import { INPUT_BASE, SECTION_CARD, SECTION_TITLE, LABEL_BASE, ERROR_MESSAGE } from '@/lib/constants/styles';

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
  return (
    <div className={SECTION_CARD}>
      <h2 className={SECTION_TITLE}>지출 정보</h2>
      <div>
        <label htmlFor="expenseDate" className={`${LABEL_BASE} mb-2`}>
          지출일자 (선택사항)
        </label>
        <input
          type="date"
          id="expenseDate"
          {...register('expenseDate')}
          disabled={disabled}
          className={INPUT_BASE}
        />
        {errors.expenseDate && (
          <p className={ERROR_MESSAGE}>{errors.expenseDate.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">재정팀에서 입력하는 항목입니다.</p>
      </div>
    </div>
  );
}
