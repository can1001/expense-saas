'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, RefreshCw, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { SECTION_CARD, BTN_PRIMARY, BTN_OUTLINE, BTN_SM, SELECT_BASE } from '@/lib/constants/styles';

interface CumulativeReportData {
  year: number;
  toQuarter: number;
  summary: {
    totalBudget: number;
    cumulativeSpent: number;
    remaining: number;
    executionRate: number;
  };
  quarterlyBreakdown: Array<{
    quarter: number;
    spent: number;
    ratio: number;
  }>;
  byDepartment: Array<{
    committee: string;
    department: string;
    budget: number;
    cumulativeSpent: number;
    remaining: number;
    executionRate: number;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

function SummaryCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <div className={SECTION_CARD}>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function QuarterlyBar({
  quarter,
  spent,
  maxSpent,
  ratio,
}: {
  quarter: number;
  spent: number;
  maxSpent: number;
  ratio: number;
}) {
  const barWidth = maxSpent > 0 ? (spent / maxSpent) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <span className="w-12 text-sm font-medium text-gray-600">Q{quarter}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-8 relative">
        <div
          className="bg-blue-500 h-8 rounded-full flex items-center justify-end pr-3"
          style={{ width: `${Math.max(barWidth, 10)}%` }}
        >
          <span className="text-xs text-white font-medium">{formatCurrency(spent)}원</span>
        </div>
      </div>
      <span className="w-16 text-sm text-gray-500 text-right">{ratio}%</span>
    </div>
  );
}

export default function CumulativeReportPage() {
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [toQuarter, setToQuarter] = useState(Math.min(currentQuarter, 4));
  const [data, setData] = useState<CumulativeReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCommittees, setExpandedCommittees] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/cumulative-report?year=${year}&toQuarter=${toQuarter}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const result = await response.json();
      setData(result);

      // 모든 위원회 펼치기
      const committees = new Set<string>(result.byDepartment.map((d: { committee: string }) => d.committee));
      setExpandedCommittees(committees);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCommittee = (committee: string) => {
    setExpandedCommittees((prev) => {
      const next = new Set(prev);
      if (next.has(committee)) {
        next.delete(committee);
      } else {
        next.add(committee);
      }
      return next;
    });
  };

  // 위원회별로 그룹화
  const groupedByCommittee = data?.byDepartment.reduce(
    (acc, item) => {
      if (!acc[item.committee]) {
        acc[item.committee] = {
          departments: [],
          totalBudget: 0,
          totalSpent: 0,
        };
      }
      acc[item.committee].departments.push(item);
      acc[item.committee].totalBudget += item.budget;
      acc[item.committee].totalSpent += item.cumulativeSpent;
      return acc;
    },
    {} as Record<string, { departments: typeof data.byDepartment; totalBudget: number; totalSpent: number }>
  );

  const handleExport = () => {
    if (!data) return;

    const headers = ['위원회', '부서', '예산', '누적지출', '잔액', '집행률'];
    const rows = data.byDepartment.map((d) => [
      d.committee,
      d.department,
      d.budget,
      d.cumulativeSpent,
      d.remaining,
      `${d.executionRate}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `누적현황_${year}년_${toQuarter}분기.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const maxSpent = data ? Math.max(...data.quarterlyBreakdown.map((q) => q.spent)) : 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">분기별 누적 현황</h1>
          <p className="text-gray-600 mt-1">1분기부터 선택한 분기까지의 누적 집행 실적</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className={`${SELECT_BASE} w-28`}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select
            value={toQuarter}
            onChange={(e) => setToQuarter(parseInt(e.target.value))}
            className={`${SELECT_BASE} w-28`}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                ~{q}분기
              </option>
            ))}
          </select>
          <button onClick={fetchData} className={`${BTN_PRIMARY} ${BTN_SM} flex items-center gap-2`}>
            <RefreshCw className="w-4 h-4" />
            조회
          </button>
          <button
            onClick={handleExport}
            disabled={!data}
            className={`${BTN_OUTLINE} ${BTN_SM} flex items-center gap-2`}
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="예산 총액"
              value={`${formatCurrency(data.summary.totalBudget)}원`}
              color="text-gray-900"
            />
            <SummaryCard
              title="누적 지출"
              value={`${formatCurrency(data.summary.cumulativeSpent)}원`}
              subtitle={`1~${toQuarter}분기 합계`}
              color="text-blue-600"
            />
            <SummaryCard
              title="누적 잔액"
              value={`${formatCurrency(data.summary.remaining)}원`}
              color="text-green-600"
            />
            <div className={SECTION_CARD}>
              <p className="text-sm text-gray-500 mb-1">집행률</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.executionRate}%</p>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      data.summary.executionRate >= 90
                        ? 'bg-green-500'
                        : data.summary.executionRate >= 70
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(data.summary.executionRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 분기별 추이 */}
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">분기별 지출 추이</h2>
            </div>
            <div className="space-y-3">
              {data.quarterlyBreakdown.map((q) => (
                <QuarterlyBar
                  key={q.quarter}
                  quarter={q.quarter}
                  spent={q.spent}
                  maxSpent={maxSpent}
                  ratio={q.ratio}
                />
              ))}
            </div>
          </div>

          {/* 부서별 현황 */}
          <div className={SECTION_CARD}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">부서별 누적 집행 현황</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">위원회 / 부서</th>
                    <th className="pb-3 font-medium text-right">예산</th>
                    <th className="pb-3 font-medium text-right">누적지출</th>
                    <th className="pb-3 font-medium text-right">잔액</th>
                    <th className="pb-3 font-medium text-right">집행률</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedByCommittee &&
                    Object.entries(groupedByCommittee).map(([committee, group]) => {
                      const isExpanded = expandedCommittees.has(committee);
                      const committeeRate =
                        group.totalBudget > 0
                          ? Math.round((group.totalSpent / group.totalBudget) * 1000) / 10
                          : 0;

                      return (
                        <React.Fragment key={committee}>
                          {/* 위원회 행 */}
                          <tr
                            className="border-b bg-indigo-50 cursor-pointer hover:bg-indigo-100"
                            onClick={() => toggleCommittee(committee)}
                          >
                            <td className="py-3 font-medium">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                {committee}
                              </div>
                            </td>
                            <td className="py-3 text-right font-medium">
                              {formatCurrency(group.totalBudget)}원
                            </td>
                            <td className="py-3 text-right font-medium">
                              {formatCurrency(group.totalSpent)}원
                            </td>
                            <td className="py-3 text-right font-medium">
                              {formatCurrency(group.totalBudget - group.totalSpent)}원
                            </td>
                            <td className="py-3 text-right">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  committeeRate >= 90
                                    ? 'bg-green-100 text-green-700'
                                    : committeeRate >= 70
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {committeeRate}%
                              </span>
                            </td>
                          </tr>

                          {/* 부서 행들 */}
                          {isExpanded &&
                            group.departments.map((dept) => (
                              <tr key={`${committee}-${dept.department}`} className="border-b hover:bg-gray-50">
                                <td className="py-3 pl-10 text-gray-600">{dept.department}</td>
                                <td className="py-3 text-right text-gray-600">
                                  {formatCurrency(dept.budget)}원
                                </td>
                                <td className="py-3 text-right text-gray-600">
                                  {formatCurrency(dept.cumulativeSpent)}원
                                </td>
                                <td className="py-3 text-right text-gray-600">
                                  {formatCurrency(dept.remaining)}원
                                </td>
                                <td className="py-3 text-right">
                                  <span
                                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                      dept.executionRate >= 90
                                        ? 'bg-green-100 text-green-700'
                                        : dept.executionRate >= 70
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {dept.executionRate}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
