'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { RecurringExpenseCard } from '@/components/recurring-expense/RecurringExpenseCard';
import { RecurringExpenseStatus } from '@/components/recurring-expense/RecurringExpenseStatus';
import { ExpenseListSkeleton } from '@/components/ui/Skeleton';
import { Plus, RefreshCw } from 'lucide-react';
import { BTN_PRIMARY, ALERT_ERROR } from '@/lib/constants/styles';

interface RecurringExpenseListItem {
  id: string;
  name: string;
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  recipientName: string;
  baseAmount: number;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  dayOfMonth: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  nextGenerationDate: string | null;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export default function RecurringExpensesPage() {
  const router = useRouter();
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpenseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const fetchRecurringExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/recurring-expenses');
      if (!response.ok) {
        throw new Error('자동이체 목록을 불러오는데 실패했습니다.');
      }
      const data = await response.json();
      setRecurringExpenses(data.recurringExpenses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecurringExpenses();
  }, [fetchRecurringExpenses]);

  const filteredExpenses = statusFilter === 'ALL'
    ? recurringExpenses
    : recurringExpenses.filter(e => e.status === statusFilter);

  const statusCounts = {
    ALL: recurringExpenses.length,
    ACTIVE: recurringExpenses.filter(e => e.status === 'ACTIVE').length,
    PAUSED: recurringExpenses.filter(e => e.status === 'PAUSED').length,
    COMPLETED: recurringExpenses.filter(e => e.status === 'COMPLETED').length,
    CANCELLED: recurringExpenses.filter(e => e.status === 'CANCELLED').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">자동이체 관리</h1>
            <p className="mt-1 text-gray-600">
              정기적으로 자동 생성되는 지출결의서를 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchRecurringExpenses}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/recurring-expenses/new"
              className={BTN_PRIMARY}
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">새 자동이체</span>
            </Link>
          </div>
        </div>

        {/* 상태 필터 탭 */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['ALL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {status === 'ALL' ? '전체' : <RecurringExpenseStatus status={status} />}
              <span className="text-xs">({statusCounts[status]})</span>
            </button>
          ))}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className={ALERT_ERROR}>
            {error}
            <button
              onClick={fetchRecurringExpenses}
              className="ml-2 underline hover:no-underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 로딩 스켈레톤 */}
        {loading && <ExpenseListSkeleton count={5} />}

        {/* 자동이체 목록 */}
        {!loading && !error && (
          <>
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500 mb-4">
                  {statusFilter === 'ALL'
                    ? '등록된 자동이체가 없습니다.'
                    : `${statusFilter === 'ACTIVE' ? '활성' : statusFilter === 'PAUSED' ? '일시정지' : statusFilter === 'COMPLETED' ? '완료' : '취소'} 상태의 자동이체가 없습니다.`
                  }
                </p>
                {statusFilter === 'ALL' && (
                  <Link href="/recurring-expenses/new" className={BTN_PRIMARY}>
                    <Plus className="w-5 h-5" />
                    첫 자동이체 등록하기
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                {filteredExpenses.map((expense) => (
                  <RecurringExpenseCard
                    key={expense.id}
                    recurringExpense={expense}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
