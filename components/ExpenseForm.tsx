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
import ApprovalLinePreview from './expense-form/ApprovalLinePreview';
import { SignatureSelector } from './signature/SignatureSelector';
import { createAttachment } from '@/lib/services/file-service';
import { SECTION_CARD, SECTION_TITLE, BTN_PRIMARY, BTN_OUTLINE, BTN_SUCCESS, BTN_LG, SPINNER, SPINNER_LG, FLEX_CENTER, ALERT_ERROR } from '@/lib/constants/styles';
import { deriveRequestTeam } from '@/lib/domain/request-team';
import {
  useFetchCurrentUser,
  useExpenseFormState,
  useExpenseFormSubmit,
} from '@/lib/hooks';

interface SignatureData {
  type: 'signature' | 'stamp' | 'realtime';
  data?: string;
  signatureId?: string;
}

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

  // 서명 모달 관련 상태
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // 서명 미등록 안내 모달
  const [showNoSignatureModal, setShowNoSignatureModal] = useState(false);

  // 파일 업로드 상태 (업로드 중 폼 제출 방지용)
  const [isUploading, setIsUploading] = useState(false);

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

  // 결재선 미리보기용 감시 (항/목은 첫 번째 항목에서)
  const items = watch('items');
  const budgetCategory = items?.[0]?.budgetCategory || '';
  const budgetSubcategory = items?.[0]?.budgetSubcategory || '';
  const requestDate = watch('requestDate');

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
    // 계좌번호가 마스킹되어 있는지 확인 (다른 사람의 지출결의서인 경우)
    const accountNumber = data.accountNumber as string;
    const isMaskedAccount = accountNumber?.startsWith('****');

    // 폼 데이터 로드 (항/목은 items에서 가져옴)
    // 마스킹된 계좌번호인 경우 은행 정보를 비움 (사용자가 직접 선택하도록)
    reset({
      committee: data.committee as string,
      department: data.department as string,
      expenseDate: data.expenseDate
        ? new Date(data.expenseDate as string).toISOString().split('T')[0]
        : undefined,
      requestDate: new Date(data.requestDate as string).toISOString().split('T')[0],
      // 청구팀은 규칙에 따라 자동 생성 (과거 데이터 호환 포함)
      requestTeam: deriveRequestTeam(data.committee as string, data.department as string),
      applicantName: data.applicantName as string,
      applicantTitle: (data.applicantTitle as string) || undefined,
      bankName: isMaskedAccount ? '' : (data.bankName as string),
      accountNumber: isMaskedAccount ? '' : accountNumber,
      accountHolder: isMaskedAccount ? '' : (data.accountHolder as string),
      items: (data.items as Array<Record<string, unknown>>).map((item) => ({
        budgetCategory: (item.budgetCategory as string) || '',
        budgetSubcategory: (item.budgetSubcategory as string) || '',
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
  const onSubmit = async (data: ExpenseFormData) => {
    // 저장 모드: 기존 로직 사용
    if (submitMode === 'save') {
      handleFormSubmit({ ...data, status: 'DRAFT' });
      return;
    }

    // 제출 모드 (수정 모드): 저장 후 기본 서명으로 자동 제출
    if (expenseId) {
      try {
        setLoading(true);
        // 먼저 저장 (PUT - DRAFT 상태로)
        const saveResponse = await fetch(`/api/expenses/${expenseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            status: 'DRAFT',
            expenseDate: data.expenseDate || null,
          }),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => ({}));
          throw new Error(errorData.error || '저장에 실패했습니다.');
        }

        // 기본 서명 확인
        const defaultSignature = await fetchDefaultSignature();

        if (defaultSignature) {
          // 기본 서명이 있으면 자동 제출
          setLoading(false);
          await submitWithSignature(defaultSignature);
        } else {
          // 서명이 없으면 안내 모달 표시
          setLoading(false);
          setShowNoSignatureModal(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        setLoading(false);
      }
      return;
    }

    // 신규 생성 + 제출: 기존 로직 사용 (신규는 상세 페이지에서 제출)
    handleFormSubmit({ ...data, status: 'PENDING' });
  };

  // 서명 선택 후 제출 확정
  const handleSignatureConfirm = async () => {
    if (!signatureData || !expenseId) {
      alert('서명 또는 도장을 선택해주세요.');
      return;
    }

    try {
      setSubmitLoading(true);
      const submitResponse = await fetch(`/api/expenses/${expenseId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: signatureData }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json().catch(() => ({}));
        throw new Error(errorData.error || '제출에 실패했습니다.');
      }

      setShowSignatureModal(false);
      alert('지출결의서가 성공적으로 제출되었습니다.');
      router.push(`/expenses/${expenseId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '제출에 실패했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // 사용자의 기본 서명/도장 조회
  const fetchDefaultSignature = async (): Promise<SignatureData | null> => {
    try {
      const response = await fetch('/api/users/me/signatures');
      if (!response.ok) return null;

      const data = await response.json();
      const defaultSig = data.signatures?.find((s: { isDefault: boolean }) => s.isDefault);

      if (defaultSig) {
        return {
          type: defaultSig.type as 'signature' | 'stamp',
          signatureId: defaultSig.id,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // 서명 데이터로 제출 처리
  const submitWithSignature = async (signature: SignatureData) => {
    if (!expenseId) return;

    try {
      setSubmitLoading(true);
      const submitResponse = await fetch(`/api/expenses/${expenseId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json().catch(() => ({}));
        throw new Error(errorData.error || '제출에 실패했습니다.');
      }

      alert('지출결의서가 성공적으로 제출되었습니다.');
      router.push(`/expenses/${expenseId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '제출에 실패했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // 업로드 중 엔터키 제출 방지
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && isUploading) {
      e.preventDefault();
    }
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
    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleFormKeyDown} className="space-y-6 sm:space-y-8 pb-24 sm:pb-0">
      {/* 에러 메시지 */}
      {error && (
        <div className={`${ALERT_ERROR} text-sm sm:text-base`}>
          {error}
        </div>
      )}

      {/* Zod 검증 에러 표시 */}
      {Object.keys(errors).length > 0 && (
        <div className={`${ALERT_ERROR} text-sm sm:text-base`}>
          <p className="font-medium mb-2">다음 항목을 확인해주세요:</p>
          <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm">
            {errors.committee && <li>{errors.committee.message}</li>}
            {errors.department && <li>{errors.department.message}</li>}
            {errors.applicantName && <li>{errors.applicantName.message}</li>}
            {errors.bankName && <li>{errors.bankName.message}</li>}
            {errors.accountNumber && <li>{errors.accountNumber.message}</li>}
            {errors.accountHolder && <li>{errors.accountHolder.message}</li>}
            {errors.items && (
              <>
                {/* 배열 전체 에러 (예: 최소 1개 필요) */}
                {errors.items.message && <li>{errors.items.message}</li>}
                {/* 개별 항목 에러 */}
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

      {/* 예산 정보 */}
      <BudgetSection
        control={control}
        disabled={loading || isSubmitting}
        onBudgetDetailChange={handleBudgetDetailChange}
        showDetail={false}
        onDetailsLoaded={setDetailOptions}
      />

      {/* 지출일자 - 수정 모드에서만 표시 (등록 시 숨김) */}
      {expenseId && (
        <ExpenseDateSection
          register={register}
          errors={errors}
          disabled={loading || isSubmitting}
        />
      )}

      {/* 세부 항목 */}
      <ItemsSection
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
        disabled={loading || isSubmitting}
        detailOptions={detailOptions}
        userId={userId}
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
          onUploadingChange={setIsUploading}
          maxFiles={10}
          disabled={loading || isSubmitting}
        />
      </div>

      {/* 결재선 미리보기 */}
      <ApprovalLinePreview
        budgetCategory={budgetCategory}
        budgetSubcategory={budgetSubcategory}
        budgetDetail={items?.[0]?.budgetDetail}
        requestDate={requestDate}
        requestAmount={items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0}
      />

      {/* 데스크톱 버튼 */}
      <div className="hidden sm:flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading || isSubmitting || isUploading}
          className={`${BTN_OUTLINE} ${BTN_LG} disabled:cursor-not-allowed`}
        >
          취소
        </button>
        <button
          type="submit"
          onClick={handleSave}
          disabled={loading || isSubmitting || isUploading}
          className={`${BTN_PRIMARY} ${BTN_LG} disabled:cursor-not-allowed`}
        >
          {(loading || isSubmitting) && submitMode === 'save' && (
            <div className={SPINNER}></div>
          )}
          {(loading || isSubmitting) && submitMode === 'save' ? '저장 중...' : isUploading ? '업로드 중...' : '저장'}
        </button>
        <button
          type="submit"
          onClick={handleSubmitClick}
          disabled={loading || isSubmitting || isUploading}
          className={`${BTN_SUCCESS} ${BTN_LG} disabled:cursor-not-allowed`}
        >
          {(loading || isSubmitting) && submitMode === 'submit' && (
            <div className={SPINNER}></div>
          )}
          {(loading || isSubmitting) && submitMode === 'submit' ? '제출 중...' : isUploading ? '업로드 중...' : '제출'}
        </button>
      </div>

      {/* 모바일 하단 고정 버튼 - safe-area 패딩 적용 */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 z-30 shadow-lg"
        style={{ paddingBottom: 'calc(16px + var(--bottom-safe-area, 0px))' }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          disabled={loading || isSubmitting || isUploading}
          className={`${BTN_OUTLINE} flex-1 min-h-[48px] disabled:cursor-not-allowed`}
        >
          취소
        </button>
        <button
          type="submit"
          onClick={handleSave}
          disabled={loading || isSubmitting || isUploading}
          className={`${BTN_PRIMARY} flex-1 min-h-[48px] disabled:cursor-not-allowed flex items-center justify-center gap-2`}
        >
          {(loading || isSubmitting) && submitMode === 'save' && (
            <div className={SPINNER}></div>
          )}
          {(loading || isSubmitting) && submitMode === 'save' ? '저장 중...' : isUploading ? '업로드 중...' : '저장'}
        </button>
        <button
          type="submit"
          onClick={handleSubmitClick}
          disabled={loading || isSubmitting || isUploading}
          className={`${BTN_SUCCESS} flex-1 min-h-[48px] disabled:cursor-not-allowed flex items-center justify-center gap-2`}
        >
          {(loading || isSubmitting) && submitMode === 'submit' && (
            <div className={SPINNER}></div>
          )}
          {(loading || isSubmitting) && submitMode === 'submit' ? '제출 중...' : isUploading ? '업로드 중...' : '제출'}
        </button>
      </div>

      {/* 서명 선택 모달 (수동 서명 선택 시 사용) */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">지출결의서 제출</h3>
            <p className="text-sm text-gray-600 mb-4">
              제출 후에는 수정할 수 없습니다. 청구인 서명/도장을 선택해주세요.
            </p>
            <SignatureSelector
              onSelect={setSignatureData}
              selectedData={signatureData}
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowSignatureModal(false);
                  setSignatureData(null);
                }}
                disabled={submitLoading}
                className={`${BTN_OUTLINE} flex-1`}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSignatureConfirm}
                disabled={!signatureData || submitLoading}
                className={`${BTN_SUCCESS} flex-1 flex items-center justify-center gap-2`}
              >
                {submitLoading && <div className={SPINNER}></div>}
                {submitLoading ? '제출 중...' : '제출'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 서명 미등록 안내 모달 */}
      {showNoSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">서명 등록이 필요합니다</h3>
              <p className="text-gray-600 text-sm">
                지출결의서 제출을 위해 먼저 서명 또는 도장을 등록해주세요.
                <br />
                마이페이지에서 등록 후 다시 시도해주세요.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowNoSignatureModal(false)}
                className={`${BTN_OUTLINE} flex-1`}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => router.push('/mypage/signatures')}
                className={`${BTN_PRIMARY} flex-1`}
              >
                서명 등록하러 가기
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
