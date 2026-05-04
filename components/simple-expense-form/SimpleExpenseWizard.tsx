/**
 * 간편 지출결의서 2단계 마법사 컴포넌트
 *
 * Step 1: 예산 항목 + 금액 + 적요
 * Step 2: 청구 정보 + 은행 계좌 + 첨부파일
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSwipeable } from 'react-swipeable';
import {
  SimpleExpenseFormData,
  simpleExpenseFormSchema,
  defaultSimpleExpenseFormData,
} from '@/lib/schemas/simple-expense-schema';
import WizardStep1 from './WizardStep1';
import WizardStep2 from './WizardStep2';
import WizardNavigation from './WizardNavigation';
import {
  FLEX_CENTER,
  SPINNER_LG,
  ALERT_ERROR,
} from '@/lib/constants/styles';
import {
  useFetchCurrentUser,
  useExpenseFormState,
  useExpenseFormSubmit,
} from '@/lib/hooks';
import { areAllItemsReceiptExempt } from '@/lib/constants/receipt-exempt-details';

interface SimpleExpenseWizardProps {
  expenseId?: string;
  initialData?: Record<string, unknown>;
}

const TOTAL_STEPS = 2;

export default function SimpleExpenseWizard({
  expenseId,
  initialData,
}: SimpleExpenseWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitMode, setSubmitMode] = useState<'save' | 'submit'>('save');
  const [showNoAttachmentModal, setShowNoAttachmentModal] = useState(false);
  const attachmentSectionRef = useRef<HTMLDivElement>(null);

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
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<SimpleExpenseFormData>({
    resolver: zodResolver(simpleExpenseFormSchema),
    defaultValues: defaultSimpleExpenseFormData as SimpleExpenseFormData,
  });

  // 은행 정보 watch
  const bankName = watch('bankName');
  const accountNumber = watch('accountNumber');
  const accountHolder = watch('accountHolder');
  const items = watch('items');

  // 폼 제출 훅
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

  // 현재 사용자 정보
  const { user: currentUser } = useFetchCurrentUser({
    skip: !!expenseId || !!initialData,
    onSuccess: (user) => {
      setValue('applicantName', user.username);
    },
  });

  const { user: editModeUser } = useFetchCurrentUser({
    skip: !expenseId && !initialData,
  });

  const userId = currentUser?.id || editModeUser?.id;

  // 스텝 1 유효성 검증 필드
  const step1Fields = ['items'] as const;

  // 다음 단계로 이동
  const goToNextStep = useCallback(async () => {
    if (currentStep >= TOTAL_STEPS) return;

    // 현재 스텝 유효성 검증
    const isValid = await trigger(step1Fields);
    if (!isValid) return;

    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }, [currentStep, trigger]);

  // 이전 단계로 이동
  const goToPrevStep = useCallback(() => {
    if (currentStep <= 1) return;
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, [currentStep]);

  // 스와이프 핸들러
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => goToNextStep(),
    onSwipedRight: () => goToPrevStep(),
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
  });

  // 제출 핸들러
  const onSubmit = (data: SimpleExpenseFormData) => {
    const status = submitMode === 'submit' ? 'PENDING' : 'DRAFT';
    handleFormSubmit({ ...data, status });
  };

  // 제출 버튼 클릭
  const handleSubmitClick = async () => {
    // 영수증 첨부 여부 확인
    if (attachments.length === 0 && !areAllItemsReceiptExempt(items || [])) {
      setShowNoAttachmentModal(true);
      return;
    }
    setSubmitMode('submit');
    handleSubmit(onSubmit)();
  };

  // 임시저장 클릭
  const handleSaveClick = () => {
    setSubmitMode('save');
    handleSubmit(onSubmit)();
  };

  // 수정 모드 데이터 로드
  const fetchExpenseData = useCallback(async () => {
    if (!expenseId) return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId]);

  const loadInitialData = (data: Record<string, unknown>) => {
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

  // 초기 데이터 로드
  useEffect(() => {
    if (expenseId && !initialData) {
      fetchExpenseData();
    } else if (initialData) {
      loadInitialData(initialData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId]);

  // 로딩 중
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 에러 메시지 */}
      {error && <div className={ALERT_ERROR}>{error}</div>}

      {/* 스텝 인디케이터 */}
      <WizardNavigation
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        stepTitles={['예산 및 금액', '청구 정보']}
      />

      {/* 스와이프 가능한 컨텐츠 영역 */}
      <div {...swipeHandlers} className="min-h-[400px]">
        {/* Step 1: 예산 + 금액 + 적요 */}
        {currentStep === 1 && (
          <WizardStep1
            control={control}
            register={register}
            setValue={setValue}
            errors={errors}
            disabled={loading || isSubmitting}
            userId={userId}
          />
        )}

        {/* Step 2: 청구 정보 + 은행 + 첨부파일 */}
        {currentStep === 2 && (
          <WizardStep2
            register={register}
            setValue={setValue}
            errors={errors}
            disabled={loading || isSubmitting}
            bankName={bankName}
            accountNumber={accountNumber}
            accountHolder={accountHolder}
            attachments={attachments}
            setAttachments={setAttachments}
            expenseId={expenseId}
            attachmentSectionRef={attachmentSectionRef}
          />
        )}
      </div>

      {/* 하단 고정 네비게이션 버튼 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 py-4 px-4 -mx-4 md:relative md:border-0 md:py-0 md:px-0 md:mx-0">
        <div className="flex justify-between gap-4">
          {/* 이전 버튼 */}
          <button
            type="button"
            onClick={currentStep === 1 ? () => router.back() : goToPrevStep}
            disabled={loading || isSubmitting}
            className="flex-1 md:flex-none px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
          >
            {currentStep === 1 ? '취소' : '이전'}
          </button>

          {/* 다음/제출 버튼 */}
          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goToNextStep}
              disabled={loading || isSubmitting}
              className="flex-1 md:flex-none px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
            >
              다음 ({currentStep}/{TOTAL_STEPS})
            </button>
          ) : (
            <div className="flex gap-2 flex-1 md:flex-none">
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={loading || isSubmitting}
                className="flex-1 px-4 py-3 border border-blue-500 text-blue-600 rounded-lg font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
              >
                {loading && submitMode === 'save' ? '저장 중...' : '임시저장'}
              </button>
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={loading || isSubmitting}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
              >
                {loading && submitMode === 'submit' ? '제출 중...' : '제출'}
              </button>
            </div>
          )}
        </div>
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
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowNoAttachmentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNoAttachmentModal(false);
                  attachmentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
