'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import BudgetSelector from '@/components/BudgetSelector';
import { FrequencySelector } from './FrequencySelector';
import { DayOfMonthInput } from './DayOfMonthInput';
import {
  INPUT_BASE,
  SECTION_CARD,
  SECTION_TITLE,
  LABEL_BASE,
  LABEL_REQUIRED,
  ERROR_MESSAGE,
  BTN_PRIMARY,
  ALERT_ERROR,
  SPINNER,
  GRID_2_COLS,
  GRID_3_COLS,
} from '@/lib/constants/styles';

/**
 * 자동이체 폼 스키마 (클라이언트용)
 */
const recurringExpenseFormSchema = z.object({
  name: z.string().min(1, '자동이체 이름을 입력해주세요'),
  description: z.string().optional(),
  committee: z.string().min(1, '위원회를 선택해주세요'),
  department: z.string().min(1, '사역팀/부를 선택해주세요'),
  budgetCategory: z.string().min(1, '예산(항)을 선택해주세요'),
  budgetSubcategory: z.string().min(1, '예산(목)을 선택해주세요'),
  budgetDetail: z.string().optional(),
  recipientName: z.string().min(1, '수취인명을 입력해주세요'),
  bankName: z.string().min(1, '은행명을 입력해주세요'),
  accountNumber: z.string().min(1, '계좌번호를 입력해주세요'),
  baseAmount: z.number().int().min(0, '기본 금액은 0 이상이어야 합니다'),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL']),
  dayOfMonth: z.number().int().min(1).max(28),
  startDate: z.string().min(1, '시작일을 입력해주세요'),
  endDate: z.string().optional(),
  advanceDays: z.number().int().min(0).max(30),
});

type FormData = z.infer<typeof recurringExpenseFormSchema>;

interface RecurringExpenseFormProps {
  initialData?: {
    id?: string;
    name: string;
    description?: string;
    committee: string;
    department: string;
    budgetCategory: string;
    budgetSubcategory: string;
    budgetDetail?: string;
    recipientName: string;
    bankName: string;
    accountNumber: string;
    baseAmount: number;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
    dayOfMonth: number;
    startDate: Date | string;
    endDate?: Date | string;
    advanceDays?: number;
  };
}

/**
 * 금액을 콤마 포맷으로 변환
 */
function formatAmount(value: string | number): string {
  const numStr = String(value).replace(/[^\d]/g, '');
  if (!numStr) return '';
  return Number(numStr).toLocaleString('ko-KR');
}

/**
 * 콤마 포맷에서 숫자로 변환
 */
function parseAmount(value: string): number {
  return Number(value.replace(/[^\d]/g, '')) || 0;
}

/**
 * Date를 YYYY-MM-DD 형식 문자열로 변환
 */
function formatDateToString(date: Date | string | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function RecurringExpenseForm({ initialData }: RecurringExpenseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountDisplay, setAmountDisplay] = useState(
    initialData?.baseAmount ? formatAmount(initialData.baseAmount) : ''
  );

  const isEditMode = !!initialData?.id;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(recurringExpenseFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      committee: initialData?.committee || '',
      department: initialData?.department || '',
      budgetCategory: initialData?.budgetCategory || '',
      budgetSubcategory: initialData?.budgetSubcategory || '',
      budgetDetail: initialData?.budgetDetail || '',
      recipientName: initialData?.recipientName || '',
      bankName: initialData?.bankName || '',
      accountNumber: initialData?.accountNumber || '',
      baseAmount: initialData?.baseAmount || 0,
      frequency: initialData?.frequency || 'MONTHLY',
      dayOfMonth: initialData?.dayOfMonth || 15,
      startDate: formatDateToString(initialData?.startDate) || new Date().toISOString().split('T')[0],
      endDate: formatDateToString(initialData?.endDate),
      advanceDays: initialData?.advanceDays ?? 7,
    },
  });

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const numericOnly = raw.replace(/[^\d]/g, '');
    const formatted = formatAmount(numericOnly);
    setAmountDisplay(formatted);
    setValue('baseAmount', parseAmount(numericOnly));
  }, [setValue]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditMode
        ? `/api/recurring-expenses/${initialData.id}`
        : '/api/recurring-expenses';

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startDate: new Date(data.startDate).toISOString(),
          endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '저장에 실패했습니다.');
      }

      router.push('/recurring-expenses');
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className={ALERT_ERROR}>
          {error}
        </div>
      )}

      {/* 기본 정보 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>기본 정보</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
              자동이체 이름
            </label>
            <input
              type="text"
              id="name"
              {...register('name')}
              placeholder="예: 월 임대료, 통신비"
              className={INPUT_BASE}
            />
            {errors.name && (
              <p className={ERROR_MESSAGE}>{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className={LABEL_BASE}>
              설명 <span className="text-gray-400 text-xs">(선택사항)</span>
            </label>
            <input
              type="text"
              id="description"
              {...register('description')}
              placeholder="추가 설명"
              className={INPUT_BASE}
            />
          </div>
        </div>
      </div>

      {/* 예산 항목 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>예산 항목</h2>
        <Controller
          name="committee"
          control={control}
          render={({ field: committeeField }) => (
            <Controller
              name="department"
              control={control}
              render={({ field: departmentField }) => (
                <Controller
                  name="budgetCategory"
                  control={control}
                  render={({ field: categoryField }) => (
                    <Controller
                      name="budgetSubcategory"
                      control={control}
                      render={({ field: subcategoryField }) => (
                        <Controller
                          name="budgetDetail"
                          control={control}
                          render={({ field: detailField }) => (
                            <BudgetSelector
                              value={{
                                committee: committeeField.value,
                                department: departmentField.value,
                                category: categoryField.value,
                                subcategory: subcategoryField.value,
                                detail: detailField.value,
                              }}
                              onChange={(budget) => {
                                committeeField.onChange(budget.committee || '');
                                departmentField.onChange(budget.department || '');
                                categoryField.onChange(budget.category || '');
                                subcategoryField.onChange(budget.subcategory || '');
                                detailField.onChange(budget.detail || '');
                              }}
                            />
                          )}
                        />
                      )}
                    />
                  )}
                />
              )}
            />
          )}
        />
        {errors.committee && (
          <p className={ERROR_MESSAGE}>{errors.committee.message}</p>
        )}
        {errors.department && (
          <p className={ERROR_MESSAGE}>{errors.department.message}</p>
        )}
        {errors.budgetCategory && (
          <p className={ERROR_MESSAGE}>{errors.budgetCategory.message}</p>
        )}
        {errors.budgetSubcategory && (
          <p className={ERROR_MESSAGE}>{errors.budgetSubcategory.message}</p>
        )}
      </div>

      {/* 수취인 정보 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>수취인 정보</h2>
        <div className={GRID_3_COLS}>
          <div>
            <label htmlFor="recipientName" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
              수취인
            </label>
            <input
              type="text"
              id="recipientName"
              {...register('recipientName')}
              placeholder="수취인 이름"
              className={INPUT_BASE}
            />
            {errors.recipientName && (
              <p className={ERROR_MESSAGE}>{errors.recipientName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="bankName" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
              은행명
            </label>
            <input
              type="text"
              id="bankName"
              {...register('bankName')}
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
              placeholder="숫자만 입력"
              className={INPUT_BASE}
            />
            {errors.accountNumber && (
              <p className={ERROR_MESSAGE}>{errors.accountNumber.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* 금액 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>금액</h2>
        <div>
          <label htmlFor="baseAmount" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
            기본 금액
          </label>
          <div className="relative">
            <input
              type="text"
              id="baseAmount"
              value={amountDisplay}
              onChange={handleAmountChange}
              placeholder="0"
              className={`${INPUT_BASE} text-right pr-8`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">원</span>
          </div>
          {errors.baseAmount && (
            <p className={ERROR_MESSAGE}>{errors.baseAmount.message}</p>
          )}
        </div>
      </div>

      {/* 이체 주기 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>이체 주기</h2>
        <div className={GRID_2_COLS}>
          <Controller
            name="frequency"
            control={control}
            render={({ field }) => (
              <FrequencySelector
                value={field.value}
                onChange={field.onChange}
                label="이체 주기"
              />
            )}
          />

          <Controller
            name="dayOfMonth"
            control={control}
            render={({ field }) => (
              <DayOfMonthInput
                value={field.value}
                onChange={field.onChange}
                label="이체일"
              />
            )}
          />
        </div>
      </div>

      {/* 기간 설정 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>기간 설정</h2>
        <div className={GRID_2_COLS}>
          <div>
            <label htmlFor="startDate" className={`${LABEL_BASE} ${LABEL_REQUIRED}`}>
              시작일
            </label>
            <input
              type="date"
              id="startDate"
              {...register('startDate')}
              className={INPUT_BASE}
            />
            {errors.startDate && (
              <p className={ERROR_MESSAGE}>{errors.startDate.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="endDate" className={LABEL_BASE}>
              종료일 <span className="text-gray-400 text-xs">(선택사항)</span>
            </label>
            <input
              type="date"
              id="endDate"
              {...register('endDate')}
              className={INPUT_BASE}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="advanceDays" className={LABEL_BASE}>
            사전 생성일
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              id="advanceDays"
              {...register('advanceDays', { valueAsNumber: true })}
              min={0}
              max={30}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
            />
            <span className="text-sm text-gray-500">이체일 N일 전에 지출결의서 자동 생성</span>
          </div>
        </div>
      </div>

      {/* 제출 버튼 */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 min-h-[44px] rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={BTN_PRIMARY}
        >
          {isSubmitting ? (
            <>
              <div className={SPINNER}></div>
              저장 중...
            </>
          ) : (
            isEditMode ? '수정' : '등록'
          )}
        </button>
      </div>
    </form>
  );
}
