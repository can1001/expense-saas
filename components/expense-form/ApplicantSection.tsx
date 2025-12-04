/**
 * 신청 정보 섹션 컴포넌트
 */

'use client';

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { ExpenseFormData } from '@/lib/schemas/expense-schema';

interface ApplicantSectionProps {
  register: UseFormRegister<ExpenseFormData>;
  errors: FieldErrors<ExpenseFormData>;
  disabled?: boolean;
}

export default function ApplicantSection({
  register,
  errors,
  disabled = false,
}: ApplicantSectionProps) {
  const inputClasses =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 bg-white placeholder-gray-400';

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">신청 정보</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="requestDate" className="block text-sm font-medium text-gray-700 mb-2">
            청구 일자 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="requestDate"
            {...register('requestDate')}
            disabled={disabled}
            className={inputClasses}
          />
          {errors.requestDate && (
            <p className="mt-1 text-sm text-red-600">{errors.requestDate.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="requestTeam" className="block text-sm font-medium text-gray-700 mb-2">
            청구팀
          </label>
          <input
            type="text"
            id="requestTeam"
            {...register('requestTeam')}
            disabled={disabled}
            className={inputClasses}
          />
          {errors.requestTeam && (
            <p className="mt-1 text-sm text-red-600">{errors.requestTeam.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="applicantName" className="block text-sm font-medium text-gray-700 mb-2">
            청구인 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="applicantName"
            {...register('applicantName')}
            disabled={disabled}
            placeholder="이름"
            className={inputClasses}
          />
          {errors.applicantName && (
            <p className="mt-1 text-sm text-red-600">{errors.applicantName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="applicantTitle" className="block text-sm font-medium text-gray-700 mb-2">
            직책 (선택사항)
          </label>
          <input
            type="text"
            id="applicantTitle"
            {...register('applicantTitle')}
            disabled={disabled}
            placeholder="직책"
            className={inputClasses}
          />
          {errors.applicantTitle && (
            <p className="mt-1 text-sm text-red-600">{errors.applicantTitle.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
