/**
 * 재정보고서 대시보드 페이지
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ArrowRightLeft,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  SELECT_BASE,
  SPINNER_MD,
} from '@/lib/constants/styles';
import { BarChart, PieChart, LineChart, ComposedChart } from '@/components/charts';
import type { SummaryData } from '@/lib/account-report-parser';

interface ReportItem {
  id: string;
  itemName: string;
  parentItemName?: string;
  level: number;
  budgetAmount: number;
  cumulativeAmount: number;
  currentAmount: number;
  executionRate: number;
  sortOrder: number;
}

interface ReportData {
  id: string;
  fileName: string;
  uploadedAt: string;
  summary: SummaryData;
  incomeItems: ReportItem[];
  expenseItems: ReportItem[];
}

interface ComparisonItem {
  itemName: string;
  current: {
    budgetAmount: number;
    cumulativeAmount: number;
    currentAmount: number;
    executionRate: number;
  };
  previous: {
    budgetAmount: number;
    cumulativeAmount: number;
    currentAmount: number;
    executionRate: number;
  } | null;
  diff: {
    cumulativeDiff: number;
    cumulativeDiffRate: number;
  };
}

interface ApiResponse {
  success: boolean;
  data?: {
    year: number;
    quarter: number;
    currentYear: ReportData | null;
    previousYear: ReportData | null;
    comparison?: {
      summary: {
        totalIncome: { current: number; previous: number; diff: number; diffRate: number };
        totalExpense: { current: number; previous: number; diff: number; diffRate: number };
        nextCarryover: { current: number; previous: number; diff: number; diffRate: number };
      };
      income: ComparisonItem[];
      expense: ComparisonItem[];
    };
  };
}

export default function AccountReportPage() {
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [compareMode, setCompareMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse['data'] | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'income' | 'expense'>('summary');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        quarter: String(quarter),
        compare: String(compareMode),
      });
      const response = await fetch(`/api/admin/account-report?${params}`);
      const result: ApiResponse = await response.json();
      if (result.success) {
        setData(result.data || null);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [year, quarter, compareMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const toggleExpand = (itemName: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  };

  // 차트 데이터 준비
  const incomeChartData =
    data?.currentYear?.incomeItems
      .filter((item) => item.level === 1)
      .slice(0, 8)
      .map((item) => ({
        name: item.itemName.length > 6 ? item.itemName.slice(0, 6) + '...' : item.itemName,
        value: item.cumulativeAmount,
      })) || [];

  const expenseChartData =
    data?.currentYear?.expenseItems
      .filter((item) => item.level === 1)
      .slice(0, 8)
      .map((item) => ({
        name: item.itemName.length > 6 ? item.itemName.slice(0, 6) + '...' : item.itemName,
        budget: item.budgetAmount,
        actual: item.cumulativeAmount,
        rate: item.executionRate,
      })) || [];

  const summaryComparisonData = data?.comparison
    ? [
        {
          name: '수입',
          current: data.comparison.summary.totalIncome.current,
          previous: data.comparison.summary.totalIncome.previous,
        },
        {
          name: '지출',
          current: data.comparison.summary.totalExpense.current,
          previous: data.comparison.summary.totalExpense.previous,
        },
        {
          name: '이월',
          current: data.comparison.summary.nextCarryover.current,
          previous: data.comparison.summary.nextCarryover.previous,
        },
      ]
    : [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin" className={BTN_OUTLINE}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold">재정보고서</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={SELECT_BASE}>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select value={quarter} onChange={(e) => setQuarter(parseInt(e.target.value))} className={SELECT_BASE}>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                {q}분기
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
              className="rounded"
            />
            전년비교
          </label>
          <button onClick={fetchData} className={BTN_OUTLINE} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/admin/account-report/upload" className={BTN_PRIMARY}>
            <Upload className="w-4 h-4 mr-2" />
            업로드
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-20">
          <div className={SPINNER_MD}></div>
        </div>
      )}

      {!loading && !data?.currentYear && (
        <div className={`${SECTION_CARD} text-center py-12`}>
          <p className="text-gray-500 mb-4">
            {year}년 {quarter}분기 재정보고서 데이터가 없습니다.
          </p>
          <Link href="/admin/account-report/upload" className={BTN_PRIMARY}>
            <Upload className="w-4 h-4 mr-2" />
            재정보고서 업로드
          </Link>
        </div>
      )}

      {!loading && data?.currentYear && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* 수입 */}
            <div className={`${SECTION_CARD} border-l-4 border-l-green-500`}>
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">수입 총계</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatAmount(data.currentYear.summary.current.totalIncome)}원
              </p>
              {data.comparison && (
                <p
                  className={`text-sm mt-1 ${
                    data.comparison.summary.totalIncome.diffRate >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  전년대비 {formatPercent(data.comparison.summary.totalIncome.diffRate)}
                </p>
              )}
            </div>

            {/* 지출 */}
            <div className={`${SECTION_CARD} border-l-4 border-l-red-500`}>
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <TrendingDown className="w-5 h-5" />
                <span className="font-medium">지출 총계</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatAmount(data.currentYear.summary.current.totalExpense)}원
              </p>
              {data.comparison && (
                <p
                  className={`text-sm mt-1 ${
                    data.comparison.summary.totalExpense.diffRate <= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  전년대비 {formatPercent(data.comparison.summary.totalExpense.diffRate)}
                </p>
              )}
            </div>

            {/* 차기이월 */}
            <div className={`${SECTION_CARD} border-l-4 border-l-blue-500`}>
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <PiggyBank className="w-5 h-5" />
                <span className="font-medium">차기 이월</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatAmount(data.currentYear.summary.current.nextCarryover)}원
              </p>
              {data.comparison && (
                <p
                  className={`text-sm mt-1 ${
                    data.comparison.summary.nextCarryover.diffRate >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  전년대비 {formatPercent(data.comparison.summary.nextCarryover.diffRate)}
                </p>
              )}
            </div>
          </div>

          {/* 차트 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 수입 구성 */}
            <div className={SECTION_CARD}>
              <h3 className={SECTION_TITLE}>수입 구성</h3>
              {incomeChartData.length > 0 ? (
                <PieChart data={incomeChartData} height={280} />
              ) : (
                <p className="text-gray-500 text-center py-10">데이터가 없습니다.</p>
              )}
            </div>

            {/* 지출 예산 vs 실적 */}
            <div className={SECTION_CARD}>
              <h3 className={SECTION_TITLE}>지출 예산 vs 실적</h3>
              {expenseChartData.length > 0 ? (
                <ComposedChart data={expenseChartData} height={280} />
              ) : (
                <p className="text-gray-500 text-center py-10">데이터가 없습니다.</p>
              )}
            </div>

            {/* 전년 대비 비교 */}
            {data.comparison && summaryComparisonData.length > 0 && (
              <div className={`${SECTION_CARD} lg:col-span-2`}>
                <h3 className={SECTION_TITLE}>전년 대비 비교</h3>
                <BarChart
                  data={summaryComparisonData.map((d) => ({
                    name: d.name,
                    actual: d.current,
                    previous: d.previous,
                  }))}
                  showBudget={false}
                  showActual={true}
                  showPrevious={true}
                  colors={{ actual: '#3b82f6', previous: '#94a3b8' }}
                  height={250}
                />
              </div>
            )}
          </div>

          {/* 탭 */}
          <div className={SECTION_CARD}>
            <div className="flex border-b mb-4">
              {[
                { key: 'summary', label: '수지개황' },
                { key: 'income', label: '수입부' },
                { key: 'expense', label: '지출부' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 수지개황 탭 */}
            {activeTab === 'summary' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">구분</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">전기이월</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">수입총계</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">지출총계</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">차액</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">차기이월</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-3 font-medium">당기</td>
                      <td className="px-4 py-3 text-right">
                        {formatAmount(data.currentYear.summary.current.previousCarryover)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {formatAmount(data.currentYear.summary.current.totalIncome)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {formatAmount(data.currentYear.summary.current.totalExpense)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatAmount(data.currentYear.summary.current.difference)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600">
                        {formatAmount(data.currentYear.summary.current.nextCarryover)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium">누계</td>
                      <td className="px-4 py-3 text-right">
                        {formatAmount(data.currentYear.summary.cumulative.previousCarryover)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {formatAmount(data.currentYear.summary.cumulative.totalIncome)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {formatAmount(data.currentYear.summary.cumulative.totalExpense)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatAmount(data.currentYear.summary.cumulative.difference)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600">
                        {formatAmount(data.currentYear.summary.cumulative.nextCarryover)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* 수입부 탭 */}
            {activeTab === 'income' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">항목</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">예산액</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">누계</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">당기</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">집행률</th>
                      {data.comparison && (
                        <th className="px-4 py-3 text-right font-medium text-gray-600">전년대비</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.currentYear.incomeItems
                      .filter((item) => item.level === 1)
                      .map((item) => {
                        const comparisonItem = data.comparison?.income.find((c) => c.itemName === item.itemName);
                        return (
                          <tr key={item.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{item.itemName}</td>
                            <td className="px-4 py-3 text-right">{formatAmount(item.budgetAmount)}</td>
                            <td className="px-4 py-3 text-right text-green-600">
                              {formatAmount(item.cumulativeAmount)}
                            </td>
                            <td className="px-4 py-3 text-right">{formatAmount(item.currentAmount)}</td>
                            <td className="px-4 py-3 text-right">{item.executionRate.toFixed(1)}%</td>
                            {data.comparison && comparisonItem && (
                              <td
                                className={`px-4 py-3 text-right ${
                                  comparisonItem.diff.cumulativeDiffRate >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {formatPercent(comparisonItem.diff.cumulativeDiffRate)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 지출부 탭 */}
            {activeTab === 'expense' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">항목</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">예산액</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">누계</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">당기</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">집행률</th>
                      {data.comparison && (
                        <th className="px-4 py-3 text-right font-medium text-gray-600">전년대비</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.currentYear.expenseItems
                      .filter((item) => item.level === 1)
                      .map((item) => {
                        const comparisonItem = data.comparison?.expense.find((c) => c.itemName === item.itemName);
                        const isOverBudget = item.executionRate > 100;
                        return (
                          <tr key={item.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{item.itemName}</td>
                            <td className="px-4 py-3 text-right">{formatAmount(item.budgetAmount)}</td>
                            <td className="px-4 py-3 text-right text-red-600">
                              {formatAmount(item.cumulativeAmount)}
                            </td>
                            <td className="px-4 py-3 text-right">{formatAmount(item.currentAmount)}</td>
                            <td className={`px-4 py-3 text-right ${isOverBudget ? 'text-red-600 font-medium' : ''}`}>
                              {item.executionRate.toFixed(1)}%
                            </td>
                            {data.comparison && comparisonItem && (
                              <td
                                className={`px-4 py-3 text-right ${
                                  comparisonItem.diff.cumulativeDiffRate <= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {formatPercent(comparisonItem.diff.cumulativeDiffRate)}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
