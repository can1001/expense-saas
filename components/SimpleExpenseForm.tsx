/**
 * 간편 지출결의서 폼 컴포넌트 (Ver.4.1.4)
 *
 * 특징:
 * - 위원회/사역팀 선택 없음
 * - 각 항목별 예산(항/목/세목) 선택
 * - 청구인 1명, 은행정보 기존과 동일
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SimpleExpenseFormData,
  simpleExpenseFormSchema,
  defaultSimpleExpenseFormData,
} from '@/lib/schemas/simple-expense-schema';
import SimpleItemsSection from './simple-expense-form/SimpleItemsSection';
import FileUpload, { UploadedFile } from './FileUpload';
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

interface SimpleExpenseFormProps {
  expenseId?: string;
  initialData?: Record<string, unknown>;
}

export default function SimpleExpenseForm({ expenseId, initialData }: SimpleExpenseFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(!!expenseId);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SimpleExpenseFormData>({
    resolver: zodResolver(simpleExpenseFormSchema),
    defaultValues: defaultSimpleExpenseFormData as SimpleExpenseFormData,
  });

  // 로그인한 사용자 정보 자동 채우기 (새 작성 시에만)
  useEffect(() => {
    const fetchCurrentUser = async () => {
      // 수정 모드가 아닌 경우에만 자동 채우기
      if (expenseId || initialData) return;

      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            // 청구인에 로그인 사용자 이름 자동 입력
            setValue('applicantName', data.user.username);
          }
        }
      } catch {
        // 로그인되지 않은 경우 무시
      }
    };

    fetchCurrentUser();
  }, [expenseId, initialData, setValue]);

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

  const onSubmit = async (data: SimpleExpenseFormData) => {
    setError(null);

    try {
      setLoading(true);

      const url = expenseId ? `/api/simple-expenses/${expenseId}` : '/api/simple-expenses';
      const method = expenseId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          expenseDate: data.expenseDate || null,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        let errorMsg = '저장에 실패했습니다.';
        try {
          const errorData = JSON.parse(responseText);
          errorMsg = errorData.details
            ? `${errorData.error}: ${errorData.details}`
            : errorData.error || '저장에 실패했습니다.';
        } catch {
          errorMsg = `서버 오류 (${response.status}): ${responseText || '응답 없음'}`;
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();

      // 새 지출결의서 생성 시 첨부파일을 DB에 저장
      if (!expenseId && attachments.length > 0) {
        const unsavedAttachments = attachments.filter((att) => !att.id);
        if (unsavedAttachments.length > 0) {
          try {
            await Promise.all(
              unsavedAttachments.map((att) =>
                fetch('/api/attachments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    expenseId: result.id,
                    expenseType: 'simple',
                    ...att,
                  }),
                })
              )
            );
          } catch (attachmentError) {
            console.error('첨부파일 저장 오류:', attachmentError);
          }
        }
      }

      alert(
        expenseId
          ? '지출결의서가 성공적으로 수정되었습니다.'
          : '지출결의서가 성공적으로 등록되었습니다.'
      );
      router.push(`/expenses/simple/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
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
            {errors.items && <li>{errors.items.message}</li>}
          </ul>
        </div>
      )}

      {/* 지출일자 */}
      <div className={SECTION_CARD}>
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
      </div>

      {/* 세부 항목 (예산 선택 포함) */}
      <SimpleItemsSection
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
        disabled={loading || isSubmitting}
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
              disabled={loading || isSubmitting}
              placeholder="예: 국민은행"
              className={INPUT_BASE}
            />
            {errors.bankName && <p className={ERROR_MESSAGE}>{errors.bankName.message}</p>}
          </div>

          <div>
            <label htmlFor="accountNumber" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
              계좌번호
            </label>
            <input
              type="text"
              id="accountNumber"
              {...register('accountNumber')}
              disabled={loading || isSubmitting}
              placeholder="숫자와 - 만 입력"
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
              disabled={loading || isSubmitting}
              placeholder="예금주 이름"
              className={INPUT_BASE}
            />
            {errors.accountHolder && (
              <p className={ERROR_MESSAGE}>{errors.accountHolder.message}</p>
            )}
          </div>
        </div>
      </div>

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
          disabled={loading || isSubmitting}
          className={`${BTN_PRIMARY} ${BTN_LG} disabled:cursor-not-allowed`}
        >
          {(loading || isSubmitting) && <div className={SPINNER}></div>}
          {loading || isSubmitting ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
