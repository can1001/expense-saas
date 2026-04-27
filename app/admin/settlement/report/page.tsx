'use client';

import { useState, useEffect } from 'react';
import {
  FileBarChart,
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
} from 'lucide-react';
import {
  SECTION_CARD,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_SM,
  SELECT_BASE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface ReportData {
  year: number;
  quarter: number;
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    previousBalance: number;
    currentBalance: number;
  };
  income: Array<{
    category: string;
    budget: number;
    actual: number;
    rate: number;
  }>;
  expense: Array<{
    category: string;
    budget: number;
    actual: number;
    rate: number;
  }>;
  committeeExpense: Array<{
    committee: string;
    amount: number;
    percentage: number;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

export default function SettlementReportPage() {
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [year, quarter]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/settlement/report?year=${year}&quarter=${quarter}`);
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
  const quarters = [1, 2, 3, 4];

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
          <h1 className="text-2xl font-bold text-gray-900">재정보고서</h1>
          <p className="text-gray-600 mt-1">분기별 재정 현황 보고서입니다.</p>
        </div>
        <div className="flex items-center gap-3">
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
            <select
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
              className={`${SELECT_BASE} w-20`}
            >
              {quarters.map((q) => (
                <option key={q} value={q}>{q}분기</option>
              ))}
            </select>
          </div>
          <button className={`${BTN_OUTLINE} ${BTN_SM} flex items-center gap-2`}>
            <Download className="w-4 h-4" />
            PDF 다운로드
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {data && (
        <>
          {/* 1. 수지개황 */}
          <div className={SECTION_CARD}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 수지개황</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">전기이월</p>
                <p className="text-lg font-bold">{formatCurrency(data.summary.previousBalance)}원</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-600">수입</p>
                </div>
                <p className="text-lg font-bold text-green-700">{formatCurrency(data.summary.totalIncome)}원</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-600">지출</p>
                </div>
                <p className="text-lg font-bold text-red-700">{formatCurrency(data.summary.totalExpense)}원</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 mb-1">당기차액</p>
                <p className="text-lg font-bold text-blue-700">{formatCurrency(data.summary.balance)}원</p>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Wallet className="w-4 h-4 text-indigo-600" />
                  <p className="text-sm text-indigo-600">차기이월</p>
                </div>
                <p className="text-lg font-bold text-indigo-700">{formatCurrency(data.summary.currentBalance)}원</p>
              </div>
            </div>
          </div>

          {/* 2. 수입부 */}
          <div className={SECTION_CARD}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">2. 수입부</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">항목</th>
                    <th className="pb-3 font-medium text-right">예산</th>
                    <th className="pb-3 font-medium text-right">실적</th>
                    <th className="pb-3 font-medium text-right">달성률</th>
                  </tr>
                </thead>
                <tbody>
                  {data.income.map((item) => (
                    <tr key={item.category} className="border-b last:border-0">
                      <td className="py-3 font-medium">{item.category}</td>
                      <td className="py-3 text-right text-gray-600">{formatCurrency(item.budget)}원</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(item.actual)}원</td>
                      <td className="py-3 text-right text-gray-600">{item.rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {data.income.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">수입 데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. 지출부 */}
          <div className={SECTION_CARD}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3. 지출부</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">항목</th>
                    <th className="pb-3 font-medium text-right">예산</th>
                    <th className="pb-3 font-medium text-right">실적</th>
                    <th className="pb-3 font-medium text-right">집행률</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expense.map((item) => (
                    <tr key={item.category} className="border-b last:border-0">
                      <td className="py-3 font-medium">{item.category}</td>
                      <td className="py-3 text-right text-gray-600">{formatCurrency(item.budget)}원</td>
                      <td className="py-3 text-right font-medium">{formatCurrency(item.actual)}원</td>
                      <td className="py-3 text-right text-gray-600">{item.rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {data.expense.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">지출 데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. 위원회별 지출 현황 */}
          <div className={SECTION_CARD}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">4. 위원회별 지출 현황</h2>
            <div className="space-y-3">
              {data.committeeExpense.map((item) => (
                <div key={item.committee} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-32">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{item.committee}</span>
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-blue-500 h-4 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right w-32">
                    <span className="text-sm font-medium">{formatCurrency(item.amount)}원</span>
                    <span className="text-xs text-gray-500 ml-2">({item.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
              {data.committeeExpense.length === 0 && (
                <p className="text-center text-gray-500 py-8">위원회별 지출 데이터가 없습니다.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
