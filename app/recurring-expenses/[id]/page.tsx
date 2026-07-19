'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import GlobalShell from '@/components/layout/GlobalShell';
import { RecurringExpenseDetail } from '@/components/recurring-expense/RecurringExpenseDetail';
import { ALERT_ERROR, SPINNER_LG, FLEX_CENTER } from '@/lib/constants/styles';

interface GeneratedExpenseData {
  id: string;
  requestAmount: number;
  status: string;
  createdAt: string;
}

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
  nextGenerationDate?: string | null;
  lastGeneratedDate?: string | null;
  createdAt: string;
  updatedAt: string;
  generatedExpenses?: GeneratedExpenseData[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RecurringExpenseDetailPage({ params }: PageProps) {
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

  const handleStatusChange = async (newStatus: 'ACTIVE' | 'PAUSED' | 'CANCELLED') => {
    try {
      const response = await fetch(`/api/recurring-expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('상태 변경에 실패했습니다.');
      }

      // 데이터 새로고침
      await fetchRecurringExpense();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    }
  };

  const handleGenerateNow = async () => {
    try {
      const response = await fetch(`/api/recurring-expenses/${id}/generate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '지출결의서 생성에 실패했습니다.');
      }

      // 생성된 지출결의서 상세 페이지로 이동
      router.push(`/expenses/${data.expenseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '지출결의서 생성에 실패했습니다.');
    }
  };

  return (
    <GlobalShell title="정기 지출 상세">
      <div className="max-w-5xl mx-auto">
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

        {/* 상세 정보 */}
        {!loading && !error && recurringExpense && (
          <RecurringExpenseDetail
            recurringExpense={recurringExpense}
            onStatusChange={handleStatusChange}
            onGenerateNow={handleGenerateNow}
          />
        )}
      </div>
    </GlobalShell>
  );
}
