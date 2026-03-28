'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Settings } from 'lucide-react';

interface BudgetItem {
  name: string;
  budget: number;
  spent: number;
  executionRate: number;
  note?: string;
}

interface BudgetGroup {
  name: string;
  items: BudgetItem[];
  subtotal: {
    budget: number;
    spent: number;
    executionRate: number;
  };
}

interface HrAdminData {
  year: number;
  personnel: {
    items: BudgetItem[];
    total: { budget: number; spent: number; executionRate: number };
  };
  admin: {
    groups: BudgetGroup[];
    total: { budget: number; spent: number; executionRate: number };
  };
}

// 금액 포맷 (만원 단위)
function formatAmount(amount: number): string {
  const inManwon = Math.round(amount / 10000);
  return inManwon.toLocaleString();
}

// 집행률에 따른 바 색상
function getBarColor(rate: number): string {
  if (rate >= 100) return 'bg-red-500';
  if (rate >= 80) return 'bg-amber-400';
  if (rate >= 50) return 'bg-yellow-300';
  return 'bg-green-400';
}

// 집행률에 따른 텍스트 색상
function getRateColor(rate: number): string {
  if (rate >= 100) return 'text-red-600 font-bold';
  return 'text-gray-700';
}

export default function HrAdminExecutionPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<HrAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/hr-admin-execution?year=${year}`);
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
          {year}년 인사 및 행정비 예산 집행 현황
        </h1>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 인사 섹션 */}
          <PersonnelSection data={data.personnel} />

          {/* 행정비 섹션 */}
          <AdminSection data={data.admin} />
        </div>
      )}
    </div>
  );
}

// 인사 섹션 컴포넌트
function PersonnelSection({ data }: { data: HrAdminData['personnel'] }) {
  return (
    <div className="bg-gradient-to-b from-green-100 to-green-50 rounded-xl shadow-lg p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <User className="w-6 h-6 text-green-700" />
        <h2 className="text-xl font-bold text-green-800">인사</h2>
      </div>

      {/* 항목 목록 */}
      <div className="space-y-4">
        {data.items.map((item, index) => (
          <BudgetItemRow key={index} item={item} />
        ))}
      </div>

      {/* 합계 */}
      <div className="mt-6 pt-4 border-t-2 border-green-300">
        <div className="flex items-center justify-between bg-yellow-400 rounded-lg px-4 py-3">
          <span className="font-bold text-gray-800">인사 합계: {data.total.executionRate}%</span>
          <span className="text-sm text-gray-700">
            (예산 {formatAmount(data.total.budget)} / 결산 {formatAmount(data.total.spent)})
          </span>
        </div>
      </div>
    </div>
  );
}

// 행정비 섹션 컴포넌트
function AdminSection({ data }: { data: HrAdminData['admin'] }) {
  return (
    <div className="bg-gradient-to-b from-blue-100 to-blue-50 rounded-xl shadow-lg p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-6 h-6 text-blue-700" />
        <h2 className="text-xl font-bold text-blue-800">행정비</h2>
      </div>

      {/* 그룹별 항목 */}
      <div className="space-y-6">
        {data.groups.map((group, index) => (
          <div key={index}>
            {/* 그룹 헤더 */}
            <div className="bg-blue-700 text-white rounded-t-lg px-4 py-2 flex justify-between items-center">
              <span className="font-semibold">{group.name}</span>
              <span className="text-sm">(소계: {group.subtotal.executionRate}%)</span>
            </div>

            {/* 그룹 항목들 */}
            <div className="bg-white rounded-b-lg p-4 space-y-3">
              {group.items.map((item, idx) => (
                <BudgetItemRow key={idx} item={item} compact />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 합계 */}
      <div className="mt-6 pt-4 border-t-2 border-blue-300">
        <div className="flex items-center justify-between bg-yellow-400 rounded-lg px-4 py-3">
          <span className="font-bold text-gray-800">행정비 합계: {data.total.executionRate}%</span>
          <span className="text-sm text-gray-700">
            (예산 {formatAmount(data.total.budget)} / 결산 {formatAmount(data.total.spent)})
          </span>
        </div>
      </div>
    </div>
  );
}

// 예산 항목 행 컴포넌트
function BudgetItemRow({ item, compact = false }: { item: BudgetItem; compact?: boolean }) {
  const barWidth = Math.min(item.executionRate, 100);

  return (
    <div className={compact ? 'text-sm' : ''}>
      {/* 항목명과 금액 */}
      <div className="flex justify-between items-center mb-1">
        <span className="font-medium text-gray-800">
          {item.name}: <span className={getRateColor(item.executionRate)}>{item.executionRate}%</span>
        </span>
        <span className="text-gray-600 text-sm">
          (예산 {formatAmount(item.budget)} / 결산 {formatAmount(item.spent)})
        </span>
      </div>

      {/* 바 차트 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-6 bg-gray-200 rounded overflow-hidden">
          <div
            className={`h-full ${getBarColor(item.executionRate)} transition-all duration-300 flex items-center justify-end pr-2`}
            style={{ width: `${barWidth}%` }}
          >
            {item.executionRate >= 20 && (
              <span className="text-xs text-white font-semibold">{item.executionRate}%</span>
            )}
          </div>
        </div>
        {item.executionRate < 20 && (
          <span className="text-xs text-gray-600 w-10">{item.executionRate}%</span>
        )}
      </div>

      {/* 비고 */}
      {item.note && (
        <p className="text-xs text-gray-500 mt-1">※ {item.note}</p>
      )}
    </div>
  );
}
