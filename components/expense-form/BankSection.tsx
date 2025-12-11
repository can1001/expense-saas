/**
 * 은행 정보 섹션 컴포넌트
 */

'use client';

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { ExpenseFormData } from '@/lib/schemas/expense-schema';
import { INPUT_BASE, SECTION_CARD, SECTION_TITLE, LABEL_BASE, LABEL_REQUIRED, ERROR_MESSAGE } from '@/lib/constants/styles';

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
  return (
    <div className={SECTION_CARD}>
      <h2 className={SECTION_TITLE}>은행 정보</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="bankName" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
            은행명
          </label>
          <input
            type="text"
            id="bankName"
            {...register('bankName')}
            disabled={disabled}
            placeholder="예: 국민은행"
            className={INPUT_BASE}
          />
          {errors.bankName && (
            <p className={ERROR_MESSAGE}>{errors.bankName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountNumber" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
            계좌번호
          </label>
          <input
            type="text"
            id="accountNumber"
            {...register('accountNumber')}
            disabled={disabled}
            placeholder="숫자만 입력"
            className={INPUT_BASE}
          />
          {errors.accountNumber && (
            <p className={ERROR_MESSAGE}>{errors.accountNumber.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountHolder" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
            예금주
          </label>
          <input
            type="text"
            id="accountHolder"
            {...register('accountHolder')}
            disabled={disabled}
            placeholder="예금주 이름"
            className={INPUT_BASE}
          />
          {errors.accountHolder && (
            <p className={ERROR_MESSAGE}>{errors.accountHolder.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
