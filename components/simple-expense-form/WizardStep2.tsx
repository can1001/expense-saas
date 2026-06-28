/**
 * 마법사 Step 2: 청구 정보 + 은행 계좌 + 첨부파일
 */

'use client';

import { RefObject } from 'react';
import { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { SimpleExpenseFormData } from '@/lib/schemas/simple-expense-schema';
import BankAccountSelector from '@/components/expense-form/BankAccountSelector';
import FileUpload from '@/components/FileUpload';
import {
  SECTION_CARD,
  SECTION_TITLE,
  INPUT_BASE,
  LABEL_BASE,
  LABEL_REQUIRED,
  ERROR_MESSAGE,
} from '@/lib/constants/styles';

interface AttachmentInfo {
  id?: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
}

interface WizardStep2Props {
  register: UseFormRegister<SimpleExpenseFormData>;
  setValue: UseFormSetValue<SimpleExpenseFormData>;
  errors: FieldErrors<SimpleExpenseFormData>;
  disabled?: boolean;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  attachments: AttachmentInfo[];
  setAttachments: (attachments: AttachmentInfo[]) => void;
  expenseId?: string;
  attachmentSectionRef?: RefObject<HTMLDivElement | null>;
}

export default function WizardStep2({
  register,
  setValue,
  errors,
  disabled = false,
  bankName,
  accountNumber,
  accountHolder,
  attachments,
  setAttachments,
  expenseId,
  attachmentSectionRef,
}: WizardStep2Props) {
  return (
    <div className="space-y-6">
      {/* 안내 문구 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-1">청구 정보 입력</h3>
        <p className="text-sm text-blue-700">
          청구일자와 은행 정보를 입력하고 영수증을 첨부하세요.
        </p>
      </div>

      {/* 청구 정보 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>청구 정보</h2>
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
              className={`${INPUT_BASE} min-h-[48px]`}
            />
            {errors.requestDate && (
              <p className={ERROR_MESSAGE}>{errors.requestDate.message}</p>
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
              placeholder="청구인 이름"
              className={`${INPUT_BASE} min-h-[48px]`}
            />
            {errors.applicantName && (
              <p className={ERROR_MESSAGE}>{errors.applicantName.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* 은행 정보 */}
      <BankAccountSelector
        register={register}
        setValue={setValue}
        errors={errors}
        disabled={disabled}
        defaultBankName={bankName}
        defaultAccountNumber={accountNumber}
        defaultAccountHolder={accountHolder}
      />

      {/* 첨부파일 */}
      <div className={SECTION_CARD} ref={attachmentSectionRef}>
        <h2 className={SECTION_TITLE}>
          첨부파일
          <span className="text-sm font-normal text-gray-500 ml-2">(제출 시 필수)</span>
        </h2>
        <FileUpload
          expenseId={expenseId}
          initialFiles={attachments}
          onChange={setAttachments}
          maxFiles={10}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
