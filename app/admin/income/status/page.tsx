'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Calendar,
  Filter,
  Download,
} from 'lucide-react';
import {
  SECTION_CARD,
  BTN_OUTLINE,
  BTN_SM,
  SELECT_BASE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface IncomeStatusData {
  year: number;
  month: number;
  totalIncome: number;
  byType: Array<{
    type: string;
    typeName: string;
    amount: number;
    count: number;
  }>;
  monthlyTrend: Array<{
    month: number;
    amount: number;
  }>;
}

const OFFERING_TYPE_NAMES: Record<string, string> = {
  TITHE: '십일조',
  THANKSGIVING: '감사헌금',
  SPECIAL: '특별헌금',
  MISSION: '선교헌금',
  BUILDING: '건축헌금',
  RELIEF: '구제헌금',
  OTHER: '기타',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

export default function IncomeStatusPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(null);
  const [data, setData] = useState<IncomeStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [year, month]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (month) params.append('month', String(month));

      const response = await fetch(`/api/admin/income/status?${params}`);
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
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

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
          <h1 className="text-2xl font-bold text-gray-900">수입 현황</h1>
          <p className="text-gray-600 mt-1">기간별 수입 현황을 확인합니다.</p>
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
              value={month || ''}
              onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
              className={`${SELECT_BASE} w-20`}
            >
              <option value="">전체</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {data && (
        <>
          {/* 총 수입 */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {month ? `${year}년 ${month}월` : `${year}년`} 총 수입
              </h2>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(data.totalIncome)}원
            </p>
          </div>

          {/* 헌금 종류별 현황 */}
          <div className={SECTION_CARD}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">헌금 종류별 현황</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">종류</th>
                    <th className="pb-3 font-medium text-right">건수</th>
                    <th className="pb-3 font-medium text-right">금액</th>
                    <th className="pb-3 font-medium text-right">비율</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((item) => (
                    <tr key={item.type} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        {OFFERING_TYPE_NAMES[item.type] || item.type}
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {item.count}건
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(item.amount)}원
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {data.totalIncome > 0
                          ? ((item.amount / data.totalIncome) * 100).toFixed(1)
                          : 0}%
                      </td>
                    </tr>
                  ))}
                  {data.byType.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        해당 기간의 수입 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 월별 추이 */}
          {!month && data.monthlyTrend.length > 0 && (
            <div className={SECTION_CARD}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">월별 추이</h2>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {data.monthlyTrend.map((item) => (
                  <div key={item.month} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">{item.month}월</div>
                    <div className="text-sm font-medium">
                      {formatCurrency(item.amount / 10000)}
                    </div>
                    <div className="text-xs text-gray-400">만원</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
