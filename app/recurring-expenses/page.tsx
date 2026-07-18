'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { RecurringExpenseCard } from '@/components/recurring-expense/RecurringExpenseCard';
import { RecurringExpenseStatus } from '@/components/recurring-expense/RecurringExpenseStatus';
import { ExpenseListSkeleton } from '@/components/ui/Skeleton';
import { useInfiniteScrollWithObserver } from '@/hooks/useInfiniteScroll';
import { Plus, RefreshCw, Loader2, Search, X } from 'lucide-react';
import { BTN_PRIMARY, ALERT_ERROR, INPUT_BASE } from '@/lib/constants/styles';

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
  user?: { id: string; username: string } | null;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

const STATUS_LABELS: Record<Exclude<StatusFilter, 'ALL'>, string> = {
  ACTIVE: '활성',
  PAUSED: '일시정지',
  COMPLETED: '완료',
  CANCELLED: '취소',
};

export default function RecurringExpensesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 검색어 디바운스 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchFn = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    params.set('limit', '100');

    const response = await fetch(`/api/recurring-expenses?${params}`);
    if (!response.ok) {
      throw new Error('정기 지출 목록을 불러오는데 실패했습니다.');
    }
    const result = await response.json();
    return {
      data: result.recurringExpenses as RecurringExpenseListItem[],
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }, [statusFilter, debouncedSearch]);

  const {
    data: recurringExpenses,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMoreRef,
  } = useInfiniteScrollWithObserver<RecurringExpenseListItem>({ fetchFn });

  // 배열을 한 번만 순회하여 상태별 카운트 계산
  const statusCounts = useMemo(() =>
    recurringExpenses.reduce(
      (counts, e) => {
        counts[e.status]++;
        counts.ALL++;
        return counts;
      },
      { ALL: 0, ACTIVE: 0, PAUSED: 0, COMPLETED: 0, CANCELLED: 0 }
    ),
    [recurringExpenses]
  );

  // 필터 변경 핸들러
  const handleFilterChange = (newFilter: StatusFilter) => {
    setStatusFilter(newFilter);
  };

  // 검색어 초기화
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">정기 지출 관리</h1>
            <p className="mt-1 text-gray-600">
              정기적으로 자동 생성되는 지출결의서를 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="새로고침"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/recurring-expenses/new"
              className={BTN_PRIMARY}
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">새 정기 지출</span>
            </Link>
          </div>
        </div>

        {/* 검색 입력 */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 수취인으로 검색..."
              className={`${INPUT_BASE} pl-10 pr-10`}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* 상태 필터 탭 */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['ALL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              disabled={isLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 ${
                statusFilter === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {status === 'ALL' ? '전체' : <RecurringExpenseStatus status={status} />}
              {statusFilter === 'ALL' && status !== 'CANCELLED' && (
                <span className="text-xs">({statusCounts[status]})</span>
              )}
            </button>
          ))}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className={ALERT_ERROR}>
            {error.message}
            <button
              onClick={refresh}
              className="ml-2 underline hover:no-underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 초기 로딩 스켈레톤 */}
        {isLoading && <ExpenseListSkeleton count={5} />}

        {/* 정기 지출 목록 */}
        {!isLoading && !error && (
          <>
            {recurringExpenses.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500 mb-4">
                  {debouncedSearch
                    ? `"${debouncedSearch}"에 대한 검색 결과가 없습니다.`
                    : statusFilter === 'ALL'
                      ? '등록된 정기 지출이 없습니다.'
                      : `${STATUS_LABELS[statusFilter]} 상태의 정기 지출이 없습니다.`
                  }
                </p>
                {!debouncedSearch && statusFilter === 'ALL' && (
                  <Link href="/recurring-expenses/new" className={BTN_PRIMARY}>
                    <Plus className="w-5 h-5" />
                    첫 정기 지출 등록하기
                  </Link>
                )}
                {debouncedSearch && (
                  <button
                    onClick={clearSearch}
                    className="text-blue-500 hover:underline"
                  >
                    검색어 지우기
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                  {recurringExpenses.map((expense) => (
                    <RecurringExpenseCard
                      key={expense.id}
                      recurringExpense={expense}
                    />
                  ))}
                </div>

                {/* 무한 스크롤 트리거 */}
                {hasMore && (
                  <div ref={loadMoreRef} className="flex justify-center py-6">
                    {isLoadingMore && (
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    )}
                  </div>
                )}

                {/* 목록 끝 안내 */}
                {!hasMore && recurringExpenses.length > 0 && (
                  <p className="text-center text-sm text-gray-400 py-6">
                    모든 항목을 불러왔습니다
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
