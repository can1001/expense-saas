/**
 * 지출결의서 폼 컴포넌트 (리팩토링 버전)
 *
 * react-hook-form + Zod + 섹션 컴포넌트 분리
 */

'use client';

import { useState, useEffect } from 'react';
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
import BankSection from './expense-form/BankSection';
import FileUpload, { UploadedFile } from './FileUpload';

interface ExpenseFormProps {
  expenseId?: string;
  initialData?: any;
}

export default function ExpenseForm({ expenseId, initialData }: ExpenseFormProps) {
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
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: defaultExpenseFormData as ExpenseFormData,
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

  const loadInitialData = (data: any) => {
    // 폼 데이터 로드
    reset({
      committee: data.committee,
      department: data.department,
      budgetCategory: data.budgetCategory,
      budgetSubcategory: data.budgetSubcategory,
      expenseDate: data.expenseDate
        ? new Date(data.expenseDate).toISOString().split('T')[0]
        : undefined,
      requestDate: new Date(data.requestDate).toISOString().split('T')[0],
      requestTeam: data.requestTeam,
      applicantName: data.applicantName,
      applicantTitle: data.applicantTitle || undefined,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountHolder: data.accountHolder,
      items: data.items.map((item: any) => ({
        budgetDetail: item.budgetDetail,
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        amount: item.amount,
      })),
    });

    // 첨부파일 로드
    if (data.attachments && data.attachments.length > 0) {
      setAttachments(
        data.attachments.map((att: any) => ({
          id: att.id,
          publicId: att.publicId,
          url: att.url,
          secureUrl: att.secureUrl,
          format: att.format,
          fileName: att.fileName,
          fileSize: att.fileSize,
          width: att.width,
          height: att.height,
        }))
      );
    }
  };

  const handleBudgetDetailChange = (detail: string) => {
    // 예산(세목)이 선택되면 첫 번째 항목에 자동 입력
    setValue('items.0.budgetDetail', detail);
  };

  const onSubmit = async (data: ExpenseFormData) => {
    setError(null);

    try {
      setLoading(true);

      const url = expenseId ? `/api/expenses/${expenseId}` : '/api/expenses';
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
        } catch (e) {
          errorMsg = `서버 오류 (${response.status}): ${responseText || '응답 없음'}`;
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();

      alert(
        expenseId
          ? '지출결의서가 성공적으로 수정되었습니다.'
          : '지출결의서가 성공적으로 등록되었습니다.'
      );
      router.push(`/expenses/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 수정 모드 데이터 로딩 중
  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Zod 검증 에러 표시 */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
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
        disabled={loading || isSubmitting}
      />

      {/* 신청 정보 */}
      <ApplicantSection
        register={register}
        errors={errors}
        disabled={loading || isSubmitting}
      />

      {/* 은행 정보 */}
      <BankSection register={register} errors={errors} disabled={loading || isSubmitting} />

      {/* 첨부파일 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">첨부파일</h2>
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
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading || isSubmitting}
          className="px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {(loading || isSubmitting) && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          )}
          {loading || isSubmitting ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
