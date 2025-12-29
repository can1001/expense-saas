/**
 * 지출결의서 폼 컴포넌트 (리팩토링 버전)
 *
 * react-hook-form + Zod + 섹션 컴포넌트 분리
 * 공통 훅 사용으로 코드 중복 제거
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ExpenseFormData,
  expenseFormSchema,
  defaultExpenseFormData,
} from '@/lib/schemas/expense-schema';
import BudgetSection from './expense-form/BudgetSection';
import ExpenseDateSection from './expense-form/ExpenseDateSection';
import ItemsSection from './expense-form/ItemsSection';
import ApplicantSection from './expense-form/ApplicantSection';
import BankAccountSelector from './expense-form/BankAccountSelector';
import FileUpload from './FileUpload';
import { createAttachment } from '@/lib/services/file-service';
import { SECTION_CARD, SECTION_TITLE, BTN_PRIMARY, BTN_OUTLINE, BTN_SUCCESS, BTN_LG, SPINNER, SPINNER_LG, FLEX_CENTER, ALERT_ERROR } from '@/lib/constants/styles';
import { deriveRequestTeam } from '@/lib/domain/request-team';
import {
  useFetchCurrentUser,
  useExpenseFormState,
  useExpenseFormSubmit,
} from '@/lib/hooks';

interface ExpenseFormProps {
  expenseId?: string;
  initialData?: Record<string, unknown>;
}

export default function ExpenseForm({ expenseId, initialData }: ExpenseFormProps) {
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

  // 세목 옵션 상태 (BudgetSection에서 전달받음)
  const [detailOptions, setDetailOptions] = useState<string[]>([]);

  // 제출 모드 (저장 vs 제출)
  const [submitMode, setSubmitMode] = useState<'save' | 'submit'>('save');

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: defaultExpenseFormData as ExpenseFormData,
  });

  // 은행 정보 감시 (BankAccountSelector에 전달)
  const bankName = watch('bankName');
  const accountNumber = watch('accountNumber');
  const accountHolder = watch('accountHolder');

  // 위원회/사역팀 감시 (청구팀 자동 생성)
  const committee = watch('committee');
  const department = watch('department');

  // 폼 제출 훅
  const { handleSubmit: handleFormSubmit } = useExpenseFormSubmit({
    expenseId,
    apiEndpoint: '/api/expenses',
    redirectPath: '/expenses',
    attachments,
    setLoading,
    setError,
    saveAttachments: async (id, unsavedAttachments) => {
      await Promise.all(
        unsavedAttachments.map((att) => createAttachment(id, att))
      );
    },
  });

  // 청구팀(requestTeam) 자동 설정: "위원회 + 사역팀(부)"
  useEffect(() => {
    const derived = deriveRequestTeam(committee, department);
    // 위원회/사역팀이 아직 선택되지 않았다면 비워둔다
    const current = getValues('requestTeam');
    if (current !== derived) {
      setValue('requestTeam', derived, { shouldValidate: true, shouldDirty: true });
    }
  }, [committee, department, getValues, setValue]);

  // 로그인한 사용자 정보 자동 채우기 (새 작성 시에만)
  useFetchCurrentUser({
    skip: !!expenseId || !!initialData,
    onSuccess: (user) => {
      setValue('applicantName', user.username);
    },
  });

  // 수정 모드일 때 데이터 로드
  useEffect(() => {
    if (expenseId && !initialData) {
      fetchExpenseData();
    } else if (initialData) {
      loadInitialData(initialData);
    }
  }, [expenseId, initialData]);

  const fetchExpenseData = async () => {
    try {
      setFetchLoading(true);
      const response = await fetch(`/api/expenses/${expenseId}`);
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
      committee: data.committee as string,
      department: data.department as string,
      budgetCategory: data.budgetCategory as string,
      budgetSubcategory: data.budgetSubcategory as string,
      expenseDate: data.expenseDate
        ? new Date(data.expenseDate as string).toISOString().split('T')[0]
        : undefined,
      requestDate: new Date(data.requestDate as string).toISOString().split('T')[0],
      // 청구팀은 규칙에 따라 자동 생성 (과거 데이터 호환 포함)
      requestTeam: deriveRequestTeam(data.committee as string, data.department as string),
      applicantName: data.applicantName as string,
      applicantTitle: (data.applicantTitle as string) || undefined,
      bankName: data.bankName as string,
      accountNumber: data.accountNumber as string,
      accountHolder: data.accountHolder as string,
      items: (data.items as Array<Record<string, unknown>>).map((item) => ({
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

  const handleBudgetDetailChange = (detail: string) => {
    // 예산(세목)이 선택되면 첫 번째 항목에 자동 입력
    setValue('items.0.budgetDetail', detail);
  };

  // onSubmit 핸들러 - useExpenseFormSubmit 훅 사용
  const onSubmit = (data: ExpenseFormData) => {
    // submitMode에 따라 status 결정
    const status = submitMode === 'submit' ? 'PENDING' : 'DRAFT';
    handleFormSubmit({ ...data, status });
  };

  // 저장 버튼 클릭 (임시저장)
  const handleSave = () => {
    setSubmitMode('save');
  };

  // 제출 버튼 클릭 (최종제출)
  const handleSubmitClick = () => {
    setSubmitMode('submit');
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
      {error && (
        <div className={ALERT_ERROR}>
          {error}
        </div>
      )}

      {/* Zod 검증 에러 표시 */}
      {Object.keys(errors).length > 0 && (
        <div className={ALERT_ERROR}>
          <p className="font-medium mb-2">다음 항목을 확인해주세요:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {errors.committee && <li>{errors.committee.message}</li>}
            {errors.department && <li>{errors.department.message}</li>}
            {errors.budgetCategory && <li>{errors.budgetCategory.message}</li>}
            {errors.budgetSubcategory && <li>{errors.budgetSubcategory.message}</li>}
            {errors.applicantName && <li>{errors.applicantName.message}</li>}
            {errors.bankName && <li>{errors.bankName.message}</li>}
            {errors.accountNumber && <li>{errors.accountNumber.message}</li>}
            {errors.accountHolder && <li>{errors.accountHolder.message}</li>}
            {errors.items && <li>{errors.items.message}</li>}
          </ul>
        </div>
      )}

      {/* 예산 정보 */}
      <BudgetSection
        control={control}
        disabled={loading || isSubmitting}
        onBudgetDetailChange={handleBudgetDetailChange}
        showDetail={false}
        onDetailsLoaded={setDetailOptions}
      />

      {/* 지출일자 */}
      <ExpenseDateSection
        register={register}
        errors={errors}
        disabled={loading || isSubmitting}
      />

      {/* 세부 항목 */}
      <ItemsSection
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
        disabled={loading || isSubmitting}
        detailOptions={detailOptions}
      />

      {/* 신청 정보 */}
      <ApplicantSection
        register={register}
        errors={errors}
        disabled={loading || isSubmitting}
      />

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
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>첨부파일</h2>
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
        <button
          type="submit"
          onClick={handleSave}
          disabled={loading || isSubmitting}
          className={`${BTN_PRIMARY} ${BTN_LG} disabled:cursor-not-allowed`}
        >
          {(loading || isSubmitting) && submitMode === 'save' && (
            <div className={SPINNER}></div>
          )}
          {(loading || isSubmitting) && submitMode === 'save' ? '저장 중...' : '저장'}
        </button>
        <button
          type="submit"
          onClick={handleSubmitClick}
          disabled={loading || isSubmitting}
          className={`${BTN_SUCCESS} ${BTN_LG} disabled:cursor-not-allowed`}
        >
          {(loading || isSubmitting) && submitMode === 'submit' && (
            <div className={SPINNER}></div>
          )}
          {(loading || isSubmitting) && submitMode === 'submit' ? '제출 중...' : '제출'}
        </button>
      </div>
    </form>
  );
}
