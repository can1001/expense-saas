'use client';

import { useState, useEffect, useCallback } from 'react';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart3 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  budget: number;
  spent: number;
  executionRate: number;
}

interface Committee {
  id: string;
  name: string;
  budget: number;
  spent: number;
  executionRate: number;
  departments: Department[];
}

interface BudgetExecutionData {
  year: number;
  summary: {
    // 사역비
    totalBudget: number;
    totalSpent: number;
    executionRate: number;
    // 전체 (인사/행정비 포함)
    grandTotalBudget: number;
    grandTotalSpent: number;
    grandTotalExecutionRate: number;
    // 전체 대비 사역비 비율
    ministryBudgetRatio: number;
  };
  committees: Committee[];
}

// 금액 포맷 (만원 단위)
function formatAmount(amount: number): string {
  const inManwon = Math.round(amount / 10000);
  return inManwon.toLocaleString();
}

// 집행률에 따른 바 색상
function getBarColor(rate: number): string {
  if (rate >= 100) return 'bg-red-400';
  if (rate >= 80) return 'bg-amber-400';
  if (rate >= 50) return 'bg-yellow-300';
  return 'bg-green-400';
}

// 집행률에 따른 텍스트 색상
function getRateColor(rate: number): string {
  if (rate >= 100) return 'text-red-600';
  if (rate >= 80) return 'text-amber-600';
  return 'text-gray-700';
}

export default function BudgetExecutionPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<BudgetExecutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/budget-execution?year=${year}`);
      if (!res.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 p-6">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-blue-800 mb-2">
          {year}년 사역비 예산 집행 현황
        </h1>
        <p className="text-gray-500">(단위: 만원)</p>
        <div className="mt-4">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 로딩/에러 상태 */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="text-center text-red-600 py-8">
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* 위원회 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {data.committees.map((committee) => (
              <CommitteeCard key={committee.id} committee={committee} />
            ))}
          </div>

          {/* 하단 합계 (사역비) */}
          <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-center gap-8 text-white">
              <span className="text-xl font-semibold">합계</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-300">예산</span>
                <span className="text-2xl font-bold text-yellow-300">
                  {formatAmount(data.summary.totalBudget)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-300">결산</span>
                <span className="text-2xl font-bold text-white">
                  {formatAmount(data.summary.totalSpent)}
                </span>
              </div>
              <DonutChart
                percentage={data.summary.executionRate}
                size={70}
                strokeWidth={8}
                className="bg-white rounded-full p-1"
              />
            </div>
          </div>

          {/* 전체 예산 대비 사역비 */}
          <div className="bg-gray-600 rounded-xl p-4 mt-4 shadow-lg">
            <div className="flex items-center justify-center gap-6 text-white text-sm">
              <span className="text-gray-300">전체 예산</span>
              <span className="font-bold text-lg">{formatAmount(data.summary.grandTotalBudget)}</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-300">사역비</span>
              <span className="font-bold text-lg">{formatAmount(data.summary.totalBudget)}</span>
              <span className="text-yellow-300 font-semibold text-lg">
                ({data.summary.ministryBudgetRatio}%)
              </span>
            </div>
          </div>
        </>
      )}

      {!loading && !error && data && data.committees.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p>등록된 위원회가 없습니다.</p>
        </div>
      )}
    </div>
  );
}

// 위원회 카드 컴포넌트
function CommitteeCard({ committee }: { committee: Committee }) {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* 카드 헤더 */}
      <div className="bg-blue-800 text-white text-center py-3">
        <h2 className="text-lg font-semibold">{committee.name}</h2>
      </div>

      {/* 예산/결산 요약 */}
      <div className="bg-gradient-to-b from-orange-200 to-orange-100 p-4">
        <div className="flex justify-center gap-8 mb-4">
          <div className="text-center">
            <div className="text-sm text-gray-600">예산</div>
            <div className="text-xl font-bold text-gray-800">
              {formatAmount(committee.budget)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">결산</div>
            <div className="text-xl font-bold text-gray-800">
              {formatAmount(committee.spent)}
            </div>
          </div>
        </div>

        {/* 도넛 차트 */}
        <div className="flex justify-center">
          <DonutChart
            percentage={committee.executionRate}
            size={90}
            strokeWidth={10}
          />
        </div>
      </div>

      {/* 부서별 목록 */}
      <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
        {committee.departments.map((dept) => (
          <DepartmentRow key={dept.id} department={dept} />
        ))}
        {committee.departments.length === 0 && (
          <p className="text-center text-gray-400 py-4 text-sm">
            등록된 사역팀이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}

// 부서 행 컴포넌트 (바 차트 포함)
function DepartmentRow({ department }: { department: Department }) {
  const barWidth = Math.min(department.executionRate, 100);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-20 truncate text-gray-700 font-medium">
        {department.name}
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="text-xs text-gray-500 w-16 text-right">
          {formatAmount(department.budget)}/{formatAmount(department.spent)}
        </div>
        <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
          <div
            className={`h-full ${getBarColor(department.executionRate)} transition-all duration-300`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className={`w-10 text-right font-semibold ${getRateColor(department.executionRate)}`}>
          {department.executionRate}%
        </div>
      </div>
    </div>
  );
}
