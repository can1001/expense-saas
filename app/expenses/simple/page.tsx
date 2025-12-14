'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Header from '@/components/Header';
import {
  INPUT_BASE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_LG,
  BTN_PAGINATION,
  BTN_PAGE_ACTIVE,
  BTN_PAGE_INACTIVE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';
import { formatCurrency } from '@/lib/utils';

interface SimpleExpenseListItem {
  id: string;
  expenseDate: string | null;
  requestAmount: number;
  requestDate: string;
  applicantName: string;
  bankName: string;
  createdAt: string;
  items: Array<{
    budgetCategory: string;
    budgetSubcategory: string;
    budgetDetail: string;
    description: string;
    amount: number;
  }>;
}

interface SimpleExpenseListResponse {
  expenses: SimpleExpenseListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function SimpleExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<SimpleExpenseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/simple-expenses');

      if (!response.ok) {
        throw new Error('데이터를 불러오는데 실패했습니다.');
      }

      const data: SimpleExpenseListResponse = await response.json();
      setExpenses(data.expenses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 검색 필터링
  const filteredExpenses = expenses.filter((expense) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        expense.applicantName.toLowerCase().includes(query) ||
        expense.items.some(
          (item) =>
            item.budgetCategory.toLowerCase().includes(query) ||
            item.budgetSubcategory.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        );

      if (!matchesSearch) return false;
    }
    return true;
  });

  // 페이지네이션
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 예산 항목 요약
  const getBudgetSummary = (items: SimpleExpenseListItem['items']) => {
    const categories = [...new Set(items.map((item) => item.budgetCategory))];
    if (categories.length === 1) {
      return categories[0];
    }
    return `${categories[0]} 외 ${categories.length - 1}건`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className={`${FLEX_CENTER} py-20`}>
          <div className="text-center">
            <div className={`inline-block ${SPINNER_LG}`}></div>
            <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">간편 지출결의서 목록</h1>
            <p className="mt-2 text-gray-600">
              항목별 예산 선택 방식의 지출결의서 (Ver.4.1.4)
            </p>
          </div>
          <button
            onClick={() => router.push('/expenses/simple/new')}
            className={`${BTN_PRIMARY} ${BTN_LG}`}
          >
            + 새 지출결의서
          </button>
        </div>

        {/* 검색 */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="청구인, 예산항목, 적요로 검색..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className={`${INPUT_BASE} max-w-md`}
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button
              onClick={fetchExpenses}
              className="ml-4 text-red-600 underline hover:text-red-800"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 목록 */}
        {paginatedExpenses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">
              {searchQuery ? '검색 결과가 없습니다.' : '등록된 지출결의서가 없습니다.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/expenses/simple/new')}
                className={`${BTN_PRIMARY} mt-4`}
              >
                첫 지출결의서 작성하기
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    청구일자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    예산항목
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    청구인
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    청구금액
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    항목 수
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/expenses/simple/${expense.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getBudgetSummary(expense.items)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.applicantName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      {formatCurrency(expense.requestAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                      {expense.items.length}건
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/expenses/simple/${expense.id}`);
                        }}
                        className={BTN_OUTLINE}
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={BTN_PAGINATION}
            >
              이전
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={currentPage === page ? BTN_PAGE_ACTIVE : BTN_PAGE_INACTIVE}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={BTN_PAGINATION}
            >
              다음
            </button>
          </div>
        )}

        {/* 통계 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          총 {filteredExpenses.length}건의 지출결의서
          {searchQuery && ` (검색어: "${searchQuery}")`}
        </div>
      </div>
    </div>
  );
}
