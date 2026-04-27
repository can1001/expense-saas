'use client';

import { useState, useEffect } from 'react';
import {
  Receipt,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react';
import {
  SECTION_CARD,
  SELECT_BASE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface ExpenseStatusData {
  year: number;
  totalExpense: number;
  totalBudget: number;
  executionRate: number;
  byCommittee: Array<{
    committee: string;
    budgetAmount: number;
    usedAmount: number;
    rate: number;
  }>;
  byMonth: Array<{
    month: number;
    amount: number;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

export default function ExpenseStatusPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<ExpenseStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/expense/status?year=${year}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (loading) {
    return (
      <div className={`${FLEX_CENTER} py-20`}>
        <div className={SPINNER_LG}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지출 현황</h1>
          <p className="text-gray-600 mt-1">연도별 지출 현황을 확인합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`${SELECT_BASE} w-24`}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {data && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={SECTION_CARD}>
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Receipt className="w-5 h-5" />
                <span className="text-sm">총 지출</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.totalExpense)}원
              </p>
            </div>
            <div className={SECTION_CARD}>
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <BarChart3 className="w-5 h-5" />
                <span className="text-sm">총 예산</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.totalBudget)}원
              </p>
            </div>
            <div className={SECTION_CARD}>
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm">집행률</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {data.executionRate.toFixed(1)}%
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    data.executionRate >= 90 ? 'bg-green-500' :
                    data.executionRate >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(data.executionRate, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 위원회별 현황 */}
          <div className={SECTION_CARD}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">위원회별 지출 현황</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">위원회</th>
                    <th className="pb-3 font-medium text-right">예산</th>
                    <th className="pb-3 font-medium text-right">집행</th>
                    <th className="pb-3 font-medium text-right">잔액</th>
                    <th className="pb-3 font-medium w-32">집행률</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCommittee.map((item) => (
                    <tr key={item.committee} className="border-b last:border-0">
                      <td className="py-3 font-medium">{item.committee}</td>
                      <td className="py-3 text-right text-gray-600">
                        {formatCurrency(item.budgetAmount)}원
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(item.usedAmount)}원
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {formatCurrency(item.budgetAmount - item.usedAmount)}원
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                item.rate >= 90 ? 'bg-green-500' :
                                item.rate >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(item.rate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right">
                            {item.rate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.byCommittee.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 월별 추이 */}
          {data.byMonth.length > 0 && (
            <div className={SECTION_CARD}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">월별 지출 추이</h2>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {data.byMonth.map((item) => {
                  const maxAmount = Math.max(...data.byMonth.map((m) => m.amount));
                  const height = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                  return (
                    <div key={item.month} className="text-center">
                      <div className="h-20 flex items-end justify-center mb-1">
                        <div
                          className="w-6 bg-blue-500 rounded-t"
                          style={{ height: `${height}%`, minHeight: item.amount > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <div className="text-xs text-gray-500">{item.month}월</div>
                      <div className="text-xs font-medium">
                        {formatCurrency(item.amount / 10000)}
                      </div>
                      <div className="text-xs text-gray-400">만원</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
