'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { RecurringExpenseForm } from '@/components/recurring-expense/RecurringExpenseForm';
import { ALERT_ERROR, SPINNER_LG, FLEX_CENTER } from '@/lib/constants/styles';

interface RecurringExpenseData {
  id: string;
  name: string;
  description?: string | null;
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail?: string | null;
  recipientName: string;
  bankName: string;
  accountNumber: string;
  baseAmount: number;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  dayOfMonth: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate?: string | null;
  advanceDays: number;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditRecurringExpensePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [recurringExpense, setRecurringExpense] = useState<RecurringExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecurringExpense = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/recurring-expenses/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('정기 지출을 찾을 수 없습니다.');
        }
        throw new Error('정기 지출 정보를 불러오는데 실패했습니다.');
      }
      const data = await response.json();
      setRecurringExpense(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecurringExpense();
  }, [fetchRecurringExpense]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">정기 지출 수정</h1>
          <p className="mt-2 text-gray-600">
            정기 지출 정보를 수정합니다.
          </p>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className={`${FLEX_CENTER} py-20`}>
            <div className={SPINNER_LG}></div>
          </div>
        )}

        {/* 에러 상태 */}
        {!loading && error && (
          <div className={ALERT_ERROR}>
            {error}
            <button
              onClick={() => router.push('/recurring-expenses')}
              className="ml-2 underline hover:no-underline"
            >
              목록으로 돌아가기
            </button>
          </div>
        )}

        {/* 수정 폼 */}
        {!loading && !error && recurringExpense && (
          <RecurringExpenseForm
            initialData={{
              id: recurringExpense.id,
              name: recurringExpense.name,
              description: recurringExpense.description || undefined,
              committee: recurringExpense.committee,
              department: recurringExpense.department,
              budgetCategory: recurringExpense.budgetCategory,
              budgetSubcategory: recurringExpense.budgetSubcategory,
              budgetDetail: recurringExpense.budgetDetail || undefined,
              recipientName: recurringExpense.recipientName,
              bankName: recurringExpense.bankName,
              accountNumber: recurringExpense.accountNumber,
              baseAmount: recurringExpense.baseAmount,
              frequency: recurringExpense.frequency,
              dayOfMonth: recurringExpense.dayOfMonth,
              startDate: recurringExpense.startDate,
              endDate: recurringExpense.endDate || undefined,
              advanceDays: recurringExpense.advanceDays,
            }}
          />
        )}
      </div>
    </div>
  );
}
