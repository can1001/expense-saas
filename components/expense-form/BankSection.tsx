/**
 * 은행 정보 섹션 컴포넌트
 */

'use client';

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { ExpenseFormData } from '@/lib/schemas/expense-schema';

interface BankSectionProps {
  register: UseFormRegister<ExpenseFormData>;
  errors: FieldErrors<ExpenseFormData>;
  disabled?: boolean;
}

export default function BankSection({
  register,
  errors,
  disabled = false,
}: BankSectionProps) {
  const inputClasses =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400';

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">은행 정보</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-2">
            은행명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="bankName"
            {...register('bankName')}
            disabled={disabled}
            placeholder="예: 국민은행"
            className={inputClasses}
          />
          {errors.bankName && (
            <p className="mt-1 text-sm text-red-600">{errors.bankName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-2">
            계좌번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="accountNumber"
            {...register('accountNumber')}
            disabled={disabled}
            placeholder="숫자만 입력"
            className={inputClasses}
          />
          {errors.accountNumber && (
            <p className="mt-1 text-sm text-red-600">{errors.accountNumber.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700 mb-2">
            예금주 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="accountHolder"
            {...register('accountHolder')}
            disabled={disabled}
            placeholder="예금주 이름"
            className={inputClasses}
          />
          {errors.accountHolder && (
            <p className="mt-1 text-sm text-red-600">{errors.accountHolder.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
