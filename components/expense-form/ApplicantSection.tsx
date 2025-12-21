/**
 * 신청 정보 섹션 컴포넌트
 */

'use client';

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { ExpenseFormData } from '@/lib/schemas/expense-schema';
import { INPUT_BASE, SECTION_CARD, SECTION_TITLE, LABEL_BASE, LABEL_REQUIRED, ERROR_MESSAGE } from '@/lib/constants/styles';

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
  return (
    <div className={SECTION_CARD}>
      <h2 className={SECTION_TITLE}>신청 정보</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="requestDate" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
            청구 일자
          </label>
          <input
            type="date"
            id="requestDate"
            {...register('requestDate')}
            disabled={disabled}
            className={INPUT_BASE}
          />
          {errors.requestDate && (
            <p className={ERROR_MESSAGE}>{errors.requestDate.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="requestTeam" className={LABEL_BASE}>
            청구팀
          </label>
          <input
            type="text"
            id="requestTeam"
            {...register('requestTeam')}
            disabled={disabled}
            readOnly
            aria-readonly="true"
            title="청구팀은 위원회/사역팀 선택에 따라 자동으로 설정됩니다."
            className={INPUT_BASE}
          />
          {errors.requestTeam && (
            <p className={ERROR_MESSAGE}>{errors.requestTeam.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="applicantName" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
            청구인
          </label>
          <input
            type="text"
            id="applicantName"
            {...register('applicantName')}
            disabled={disabled}
            placeholder="이름"
            className={INPUT_BASE}
          />
          {errors.applicantName && (
            <p className={ERROR_MESSAGE}>{errors.applicantName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="applicantTitle" className={LABEL_BASE}>
            직책 (선택사항)
          </label>
          <input
            type="text"
            id="applicantTitle"
            {...register('applicantTitle')}
            disabled={disabled}
            placeholder="직책"
            className={INPUT_BASE}
          />
          {errors.applicantTitle && (
            <p className={ERROR_MESSAGE}>{errors.applicantTitle.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
