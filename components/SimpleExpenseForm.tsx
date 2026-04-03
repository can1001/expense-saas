/**
 * 간편 지출결의서 폼 컴포넌트 (Ver.4.1.4)
 *
 * 특징:
 * - 위원회/사역팀 선택 없음
 * - 각 항목별 예산(항/목/세목) 선택
 * - 청구인 1명, 은행정보 기존과 동일
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SimpleExpenseFormData,
  simpleExpenseFormSchema,
  defaultSimpleExpenseFormData,
} from '@/lib/schemas/simple-expense-schema';
import SimpleItemsSection from './simple-expense-form/SimpleItemsSection';
import BankAccountSelector from './expense-form/BankAccountSelector';
import FileUpload from './FileUpload';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_LG,
  SPINNER,
  SPINNER_LG,
  FLEX_CENTER,
  ALERT_ERROR,
  INPUT_BASE,
  LABEL_BASE,
  LABEL_REQUIRED,
  ERROR_MESSAGE,
} from '@/lib/constants/styles';
import {
  useFetchCurrentUser,
  useExpenseFormState,
  useExpenseFormSubmit,
} from '@/lib/hooks';
import { areAllItemsReceiptExempt } from '@/lib/constants/receipt-exempt-details';

interface SimpleExpenseFormProps {
  expenseId?: string;
  initialData?: Record<string, unknown>;
}

export default function SimpleExpenseForm({ expenseId, initialData }: SimpleExpenseFormProps) {
  const router = useRouter();

  // 공통 훅 사용
  const {
    loading,
    setLoading,
    error,
    setError,
    fetchLoading,
    setFetchLoading,
    attachments,
    setAttachments,
  } = useExpenseFormState({ isEditMode: !!expenseId });

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SimpleExpenseFormData>({
    resolver: zodResolver(simpleExpenseFormSchema),
    defaultValues: defaultSimpleExpenseFormData as SimpleExpenseFormData,
  });

  // 은행 정보 watch (BankAccountSelector에 전달용)
  const bankName = watch('bankName');
  const accountNumber = watch('accountNumber');
  const accountHolder = watch('accountHolder');

  // 항목 watch (영수증 예외 세목 확인용)
  const items = watch('items');

  // 제출 모드 상태 (저장 / 제출)
  const [submitMode, setSubmitMode] = useState<'save' | 'submit'>('save');

  // 영수증 미첨부 안내 모달
  const [showNoAttachmentModal, setShowNoAttachmentModal] = useState(false);

  // 첨부파일 영역 ref (스크롤 이동용)
  const attachmentSectionRef = useRef<HTMLDivElement>(null);

  // 폼 제출 훅 - Expense 테이블에 저장 (리다이렉트 /expenses로 변경)
  const { handleSubmit: handleFormSubmit } = useExpenseFormSubmit({
    expenseId,
    apiEndpoint: '/api/simple-expenses',
    redirectPath: '/expenses',
    attachments,
    setLoading,
    setError,
    saveAttachments: async (id, unsavedAttachments) => {
      await Promise.all(
        unsavedAttachments.map((att) =>
          fetch('/api/attachments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expenseId: id,
              expenseType: 'simple',
              ...att,
            }),
          })
        )
      );
    },
  });

  // 로그인한 사용자 정보 자동 채우기 (새 작성 시에만)
  const { user: currentUser } = useFetchCurrentUser({
    skip: !!expenseId || !!initialData,
    onSuccess: (user) => {
      setValue('applicantName', user.username);
    },
  });

  // 수정 모드에서도 현재 사용자 정보 로드 (적요 즐겨찾기용)
  const { user: editModeUser } = useFetchCurrentUser({
    skip: !expenseId && !initialData,
  });

  // 현재 사용자 ID (적요 즐겨찾기용)
  const userId = currentUser?.id || editModeUser?.id;

  // 수정 모드일 때 데이터 로드
  useEffect(() => {
    if (expenseId && !initialData) {
      fetchExpenseData();
    } else if (initialData) {
      loadInitialData(initialData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId, initialData]);

  const fetchExpenseData = async () => {
    try {
      setFetchLoading(true);
      const response = await fetch(`/api/simple-expenses/${expenseId}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const data = await response.json();
      loadInitialData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setFetchLoading(false);
    }
  };

  const loadInitialData = (data: Record<string, unknown>) => {
    // 폼 데이터 로드
    reset({
      expenseDate: data.expenseDate
        ? new Date(data.expenseDate as string).toISOString().split('T')[0]
        : undefined,
      requestDate: new Date(data.requestDate as string).toISOString().split('T')[0],
      applicantName: data.applicantName as string,
      bankName: data.bankName as string,
      accountNumber: data.accountNumber as string,
      accountHolder: data.accountHolder as string,
      items: (data.items as Array<Record<string, unknown>>).map((item) => ({
        budgetCategory: item.budgetCategory as string,
        budgetSubcategory: item.budgetSubcategory as string,
        budgetDetail: item.budgetDetail as string,
        description: item.description as string,
        unitPrice: item.unitPrice as number,
        quantity: item.quantity as number,
        amount: item.amount as number,
      })),
    });

    // 첨부파일 로드
    const attachmentsData = data.attachments as Array<Record<string, unknown>> | undefined;
    if (attachmentsData && attachmentsData.length > 0) {
      setAttachments(
        attachmentsData.map((att) => ({
          id: att.id as string,
          publicId: att.publicId as string,
          url: att.url as string,
          secureUrl: att.secureUrl as string,
          format: att.format as string,
          fileName: att.fileName as string,
          fileSize: att.fileSize as number,
          width: att.width as number | undefined,
          height: att.height as number | undefined,
        }))
      );
    }
  };

  // onSubmit 핸들러 - useExpenseFormSubmit 훅 사용
  const onSubmit = (data: SimpleExpenseFormData) => {
    // submitMode에 따라 status 결정 (저장: DRAFT, 제출: PENDING)
    const status = submitMode === 'submit' ? 'PENDING' : 'DRAFT';
    handleFormSubmit({ ...data, status });
  };

  // 수정 모드 데이터 로딩 중
  if (fetchLoading) {
    return (
      <div className={`${FLEX_CENTER} py-12`}>
        <div className="text-center">
          <div className={`inline-block ${SPINNER_LG}`}></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* 에러 메시지 */}
      {error && <div className={ALERT_ERROR}>{error}</div>}

      {/* Zod 검증 에러 표시 */}
      {Object.keys(errors).length > 0 && (
        <div className={ALERT_ERROR}>
          <p className="font-medium mb-2">다음 항목을 확인해주세요:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {errors.applicantName && <li>{errors.applicantName.message}</li>}
            {errors.bankName && <li>{errors.bankName.message}</li>}
            {errors.accountNumber && <li>{errors.accountNumber.message}</li>}
            {errors.accountHolder && <li>{errors.accountHolder.message}</li>}
            {errors.items && (
              <>
                {errors.items.message && <li>{errors.items.message}</li>}
                {Array.isArray(errors.items) && errors.items.map((itemError, idx) => {
                  if (!itemError) return null;
                  const fieldErrors: string[] = [];
                  if (itemError.budgetCategory) fieldErrors.push(`예산(항): ${itemError.budgetCategory.message}`);
                  if (itemError.budgetSubcategory) fieldErrors.push(`예산(목): ${itemError.budgetSubcategory.message}`);
                  if (itemError.budgetDetail) fieldErrors.push(`세목: ${itemError.budgetDetail.message}`);
                  if (itemError.description) fieldErrors.push(`적요: ${itemError.description.message}`);
                  if (itemError.unitPrice) fieldErrors.push(`단가: ${itemError.unitPrice.message}`);
                  if (itemError.quantity) fieldErrors.push(`수량: ${itemError.quantity.message}`);
                  if (itemError.amount) fieldErrors.push(`금액: ${itemError.amount.message}`);
                  if (fieldErrors.length === 0) return null;
                  return (
                    <li key={idx}>
                      <span className="font-medium">[{idx + 1}행]</span> {fieldErrors.join(', ')}
                    </li>
                  );
                })}
              </>
            )}
          </ul>
        </div>
      )}

      {/* 지출일자 */}
      {/* <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>지출일자</h2>
        <div>
          <label htmlFor="expenseDate" className={LABEL_BASE}>
            지출일자 (선택사항)
          </label>
          <input
            type="date"
            id="expenseDate"
            {...register('expenseDate')}
            disabled={loading || isSubmitting}
            className={INPUT_BASE}
          />
          <p className="mt-1 text-sm text-gray-500">
            재정팀에서 입력합니다. (비워두어도 됩니다)
          </p>
        </div>
      </div> */}

      {/* 세부 항목 (예산 선택 포함) */}
      <SimpleItemsSection
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
        disabled={loading || isSubmitting}
        userId={userId}
      />

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
              disabled={loading || isSubmitting}
              className={INPUT_BASE}
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
              disabled={loading || isSubmitting}
              placeholder="청구인 이름"
              className={INPUT_BASE}
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
        disabled={loading || isSubmitting}
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
          disabled={loading || isSubmitting}
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading || isSubmitting}
          className={`${BTN_OUTLINE} ${BTN_LG} disabled:cursor-not-allowed`}
        >
          취소
        </button>
        {/* 임시저장 버튼 (DRAFT 상태) */}
        <button
          type="button"
          onClick={() => {
            setSubmitMode('save');
            handleSubmit(onSubmit)();
          }}
          disabled={loading || isSubmitting}
          className={`${BTN_OUTLINE} ${BTN_LG} disabled:cursor-not-allowed border-blue-500 text-blue-600 hover:bg-blue-50`}
        >
          {(loading || isSubmitting) && submitMode === 'save' && <div className={SPINNER}></div>}
          {loading || isSubmitting && submitMode === 'save' ? '임시저장 중...' : '임시저장'}
        </button>
        {/* 제출 버튼 (PENDING 상태) */}
        <button
          type="button"
          onClick={() => {
            // 영수증 첨부 여부 확인 (예외 세목은 영수증 없이 제출 가능)
            if (attachments.length === 0 && !areAllItemsReceiptExempt(items || [])) {
              setShowNoAttachmentModal(true);
              return;
            }
            setSubmitMode('submit');
            handleSubmit(onSubmit)();
          }}
          disabled={loading || isSubmitting}
          className={`${BTN_PRIMARY} ${BTN_LG} disabled:cursor-not-allowed`}
        >
          {(loading || isSubmitting) && submitMode === 'submit' && <div className={SPINNER}></div>}
          {loading || isSubmitting && submitMode === 'submit' ? '제출 중...' : '제출'}
        </button>
      </div>

      {/* 영수증 미첨부 안내 모달 */}
      {showNoAttachmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">영수증을 첨부해주세요</h3>
              <p className="text-gray-600 text-sm">
                지출결의서 제출을 위해 영수증 이미지를 첨부해야 합니다.
                <br />
                첨부파일 영역에서 영수증을 업로드해주세요.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowNoAttachmentModal(false)}
                className={`${BTN_OUTLINE} flex-1`}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNoAttachmentModal(false);
                  attachmentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className={`${BTN_PRIMARY} flex-1`}
              >
                첨부하러 가기
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
