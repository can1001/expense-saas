/**
 * 재정보고서 대시보드 페이지
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  Download,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  SELECT_BASE,
  SPINNER_MD,
} from '@/lib/constants/styles';
import { BarChart, PieChart, ComposedChart, LineChart } from '@/components/charts';
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

interface TrendDataItem {
  name: string;
  quarter: number;
  income: number;
  expense: number;
  previousIncome?: number;
  previousExpense?: number;
  [key: string]: string | number | undefined;
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
    trendData?: TrendDataItem[];
  };
}

// 수입 현황에서 제외할 항목명
const EXCLUDED_INCOME_ITEMS = ['모임회비', '교재비', '연공간이용비', '기타잡수익', '적립금_해지(원금입금)'];

// 수입 현황에서 마크 표시할 항목명
const MARKED_INCOME_ITEMS = ['주헌금', '기타헌금', '절기헌금', '기타수입', '예산외수입'];

export default function AccountReportPage() {
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(1);
  const [compareMode, setCompareMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<ApiResponse['data'] | null>(null);
  const [expandedIncomeItems, setExpandedIncomeItems] = useState<Set<string>>(new Set());
  const [expandedExpenseItems, setExpandedExpenseItems] = useState<Set<string>>(new Set());

  const toggleIncomeExpand = (itemName: string) => {
    setExpandedIncomeItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  const toggleExpenseExpand = (itemName: string) => {
    setExpandedExpenseItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  // 수입 항목 전체 펼치기/접기
  const expandAllIncome = () => {
    const allParentNames = data?.currentYear?.incomeItems
      .filter(item => item.level === 1 && !EXCLUDED_INCOME_ITEMS.includes(item.itemName))
      .map(item => item.itemName) || [];
    setExpandedIncomeItems(new Set(allParentNames));
  };

  const collapseAllIncome = () => {
    setExpandedIncomeItems(new Set());
  };

  // 지출 항목 전체 펼치기/접기
  const expandAllExpense = () => {
    const allParentNames = data?.currentYear?.expenseItems
      .filter(item => item.level === 1)
      .map(item => item.itemName) || [];
    setExpandedExpenseItems(new Set(allParentNames));
  };

  const collapseAllExpense = () => {
    setExpandedExpenseItems(new Set());
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        quarter: String(quarter),
        compare: String(compareMode),
        trend: 'true',
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

  const exportExcel = async () => {
    if (!data?.currentYear) return;

    setExporting(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        quarter: String(quarter),
      });
      const response = await fetch(`/api/admin/account-report/export?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '엑셀 다운로드에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `재정보고서_${year}년_${quarter}분기.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert(error instanceof Error ? error.message : '엑셀 다운로드에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // 차트 데이터 준비
  const incomeChartData = (() => {
    const filteredItems = data?.currentYear?.incomeItems
      .filter((item) => item.level === 1 && !EXCLUDED_INCOME_ITEMS.includes(item.itemName)) || [];

    const topItems = filteredItems.slice(0, 8).map((item) => ({
      name: item.itemName.length > 6 ? item.itemName.slice(0, 6) + '...' : item.itemName,
      value: item.cumulativeAmount,
      budget: item.budgetAmount,
      rate: item.budgetAmount > 0 ? (item.cumulativeAmount / item.budgetAmount * 100) : 0,
    }));

    // 8개 초과 항목은 '기타'로 합산
    if (filteredItems.length > 8) {
      const otherItems = filteredItems.slice(8);
      const otherValue = otherItems.reduce((sum, item) => sum + item.cumulativeAmount, 0);
      const otherBudget = otherItems.reduce((sum, item) => sum + item.budgetAmount, 0);
      topItems.push({
        name: '기타',
        value: otherValue,
        budget: otherBudget,
        rate: otherBudget > 0 ? (otherValue / otherBudget * 100) : 0,
      });
    }

    return topItems;
  })();

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
          <h1 className="text-2xl font-bold text-gray-900">재정보고서</h1>
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
          <label className="flex items-center gap-2 text-sm text-gray-900">
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
          {data?.currentYear && (
            <button
              onClick={exportExcel}
              className={BTN_OUTLINE}
              disabled={exporting}
              title="재정보고서(표준) 엑셀 다운로드"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              <span className="ml-2 hidden sm:inline">다운로드</span>
            </button>
          )}
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
          {/* Ⅰ. 수입 및 지출 개요 */}
          <div className={`${SECTION_CARD} mb-6`}>
            <h3 className={SECTION_TITLE}>Ⅰ. 수입 및 지출 개요</h3>
            <p className="text-sm text-gray-800 mb-3">
              기 간 : {year}.01.01 ~ {year}.{String(quarter * 3).padStart(2, '0')}.{quarter === 1 ? '31' : quarter === 2 ? '30' : quarter === 3 ? '30' : '31'}
            </p>
            <p className="text-right text-sm text-gray-700 mb-2">(단위: 원)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-900">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-800">구분</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-800">전기이월</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-800">수입총계</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-800">지출총계</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-800">차액</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-800">차기이월</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-3 font-medium">당기누계</td>
                    <td className="px-4 py-3 text-right">
                      {formatAmount(data.currentYear.summary.current.previousCarryover)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatAmount(data.currentYear.summary.current.totalIncome)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatAmount(data.currentYear.summary.current.totalExpense)}
                    </td>
                    <td className={`px-4 py-3 text-right ${data.currentYear.summary.current.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatAmount(data.currentYear.summary.current.difference)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-600">
                      {formatAmount(data.currentYear.summary.current.nextCarryover)}
                    </td>
                  </tr>
                  {data.previousYear && (
                    <tr className="border-b bg-yellow-50">
                      <td className="px-4 py-3 font-medium">전년(동분기)누계</td>
                      <td className="px-4 py-3 text-right">
                        {formatAmount(data.previousYear.summary.cumulative.previousCarryover)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {formatAmount(data.previousYear.summary.cumulative.totalIncome)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {formatAmount(data.previousYear.summary.cumulative.totalExpense)}
                      </td>
                      <td className={`px-4 py-3 text-right ${data.previousYear.summary.cumulative.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAmount(data.previousYear.summary.cumulative.difference)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600">
                        {formatAmount(data.previousYear.summary.cumulative.nextCarryover)}
                      </td>
                    </tr>
                  )}
                  {data.comparison && (
                    <tr className="bg-blue-50">
                      <td className="px-4 py-3 font-medium">전년대비증감</td>
                      <td className="px-4 py-3 text-right text-gray-400">-</td>
                      <td className="px-4 py-3 text-right">
                        <span className={data.comparison.summary.totalIncome.diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {data.comparison.summary.totalIncome.diff >= 0 ? '+' : ''}
                          {formatAmount(data.comparison.summary.totalIncome.diff)}
                          <span className="text-xs ml-1">
                            ({formatPercent(data.comparison.summary.totalIncome.diffRate)})
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={data.comparison.summary.totalExpense.diff <= 0 ? 'text-green-600' : 'text-red-600'}>
                          {data.comparison.summary.totalExpense.diff >= 0 ? '+' : ''}
                          {formatAmount(data.comparison.summary.totalExpense.diff)}
                          <span className="text-xs ml-1">
                            ({formatPercent(data.comparison.summary.totalExpense.diffRate)})
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const currentDiff = data.currentYear.summary.current.difference;
                          const prevDiff = data.previousYear?.summary.cumulative.difference || 0;
                          const diff = currentDiff - prevDiff;
                          return (
                            <span className={diff >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {diff >= 0 ? '+' : ''}{formatAmount(diff)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ⅱ. 수입 현황 */}
          {data.currentYear.incomeItems.length > 0 && (
            <div className={`${SECTION_CARD} mb-6`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`${SECTION_TITLE} mb-0`}>Ⅱ. 수입 현황</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={expandAllIncome}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
                  >
                    전체 펼치기
                  </button>
                  <button
                    onClick={collapseAllIncome}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
                  >
                    전체 접기
                  </button>
                </div>
              </div>
              <p className="text-right text-sm text-gray-700 mb-2">(단위: 원)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-900">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left font-medium text-gray-800">항목</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-800">예산액</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-800">결산 누계</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-800">(결산/예산)<br/>진척률</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-800">수입 비중</th>
                      {data.previousYear && (
                        <>
                          <th className="px-3 py-2 text-right font-medium text-gray-800 bg-yellow-50">전년(동분기)<br/>누계</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-800 bg-blue-50">전년 대비 당해<br/>누계 증감액</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.currentYear.incomeItems
                      .filter((item) => item.level === 1 && !EXCLUDED_INCOME_ITEMS.includes(item.itemName))
                      .flatMap((parentItem) => {
                        const totalIncome = data.currentYear?.incomeItems
                          .filter((item) => item.level === 1 && !EXCLUDED_INCOME_ITEMS.includes(item.itemName))
                          .reduce((sum, item) => sum + item.cumulativeAmount, 0) || 0;
                        const childItems = data.currentYear?.incomeItems.filter(
                          (child) => child.level === 2 && child.parentItemName === parentItem.itemName
                        ) || [];

                        // 부모 항목 행
                        const parentComparisonItem = data.comparison?.income.find(
                          (c) => c.itemName === parentItem.itemName
                        );
                        const parentProgressRate = parentItem.budgetAmount > 0
                          ? (parentItem.cumulativeAmount / parentItem.budgetAmount * 100)
                          : 0;
                        const parentIncomeRatio = totalIncome > 0
                          ? (parentItem.cumulativeAmount / totalIncome * 100)
                          : 0;
                        const parentDiff = parentComparisonItem?.diff.cumulativeDiff || 0;

                        const rows = [
                          <tr key={parentItem.id} className="border-b bg-gray-50 font-medium">
                            <td
                              className="px-3 py-2 cursor-pointer select-none"
                              onClick={() => childItems.length > 0 && toggleIncomeExpand(parentItem.itemName)}
                            >
                              <span className="inline-flex items-center gap-1">
                                {MARKED_INCOME_ITEMS.includes(parentItem.itemName) && <span className="text-blue-600">●</span>}
                                {childItems.length > 0 ? (
                                  expandedIncomeItems.has(parentItem.itemName)
                                    ? <ChevronDown className="w-4 h-4" />
                                    : <ChevronRight className="w-4 h-4" />
                                ) : <span className="w-4" />}
                                {parentItem.itemName}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">{formatAmount(parentItem.budgetAmount)}</td>
                            <td className="px-3 py-2 text-right">{formatAmount(parentItem.cumulativeAmount)}</td>
                            <td className="px-3 py-2 text-right">{parentProgressRate.toFixed(0)}%</td>
                            <td className="px-3 py-2 text-right">{parentIncomeRatio.toFixed(0)}%</td>
                            {data.previousYear && (
                              <>
                                <td className="px-3 py-2 text-right bg-yellow-50">
                                  {formatAmount(parentComparisonItem?.previous?.cumulativeAmount || 0)}
                                </td>
                                <td className="px-3 py-2 text-right bg-blue-50">
                                  <span className={parentDiff >= 0 ? 'text-red-600' : 'text-blue-600'}>
                                    {parentDiff >= 0 ? '▲' : '▼'} {formatAmount(Math.abs(parentDiff))}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ];

                        // 자식 항목 행들 (펼친 상태일 때만 표시)
                        if (expandedIncomeItems.has(parentItem.itemName)) {
                          childItems.forEach((childItem) => {
                          const childComparisonItem = data.comparison?.income.find(
                            (c) => c.itemName === childItem.itemName
                          );
                          const childProgressRate = childItem.budgetAmount > 0
                            ? (childItem.cumulativeAmount / childItem.budgetAmount * 100)
                            : 0;
                          const childIncomeRatio = totalIncome > 0
                            ? (childItem.cumulativeAmount / totalIncome * 100)
                            : 0;
                          const childDiff = childComparisonItem?.diff.cumulativeDiff || 0;

                          rows.push(
                            <tr key={childItem.id} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-2 pl-6 text-gray-700">ㄴ {childItem.itemName}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{formatAmount(childItem.budgetAmount)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{formatAmount(childItem.cumulativeAmount)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{childProgressRate.toFixed(0)}%</td>
                              <td className="px-3 py-2 text-right text-gray-700">{childIncomeRatio.toFixed(0)}%</td>
                              {data.previousYear && (
                                <>
                                  <td className="px-3 py-2 text-right bg-yellow-50 text-gray-700">
                                    {formatAmount(childComparisonItem?.previous?.cumulativeAmount || 0)}
                                  </td>
                                  <td className="px-3 py-2 text-right bg-blue-50">
                                    <span className={childDiff >= 0 ? 'text-red-600' : 'text-blue-600'}>
                                      {childDiff >= 0 ? '▲' : '▼'} {formatAmount(Math.abs(childDiff))}
                                    </span>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                          });
                        }

                        return rows;
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ⅲ. 지출 현황 */}
          {data.currentYear.expenseItems.length > 0 && (
            <div className={`${SECTION_CARD} mb-6`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`${SECTION_TITLE} mb-0`}>Ⅲ. 지출 현황</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={expandAllExpense}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
                  >
                    전체 펼치기
                  </button>
                  <button
                    onClick={collapseAllExpense}
                    className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
                  >
                    전체 접기
                  </button>
                </div>
              </div>
              <p className="text-right text-sm text-gray-700 mb-2">(단위: 원)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-900">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left font-medium text-gray-800">항목</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-800">예산액</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-800">결산 누계</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-800">(결산/예산)<br/>진척률</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-800">지출 비중</th>
                      {data.previousYear && (
                        <>
                          <th className="px-3 py-2 text-right font-medium text-gray-800 bg-yellow-50">전년(동분기)<br/>누계</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-800 bg-blue-50">전년 대비 당해<br/>누계 증감액</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.currentYear.expenseItems
                      .filter((item) => item.level === 1)
                      .flatMap((parentItem) => {
                        const totalExpense = data.currentYear?.summary.cumulative.totalExpense || 0;
                        const childItems = data.currentYear?.expenseItems.filter(
                          (child) => child.level === 2 && child.parentItemName === parentItem.itemName
                        ) || [];

                        // 부모 항목 행
                        const parentComparisonItem = data.comparison?.expense.find(
                          (c) => c.itemName === parentItem.itemName
                        );
                        const parentProgressRate = parentItem.budgetAmount > 0
                          ? (parentItem.cumulativeAmount / parentItem.budgetAmount * 100)
                          : 0;
                        const parentExpenseRatio = totalExpense > 0
                          ? (parentItem.cumulativeAmount / totalExpense * 100)
                          : 0;
                        const parentDiff = parentComparisonItem?.diff.cumulativeDiff || 0;
                        const isOverBudget = parentProgressRate > 100;

                        const rows = [
                          <tr key={parentItem.id} className="border-b bg-gray-50 font-medium">
                            <td
                              className="px-3 py-2 cursor-pointer select-none"
                              onClick={() => childItems.length > 0 && toggleExpenseExpand(parentItem.itemName)}
                            >
                              <span className="inline-flex items-center gap-1">
                                {childItems.length > 0 ? (
                                  expandedExpenseItems.has(parentItem.itemName)
                                    ? <ChevronDown className="w-4 h-4" />
                                    : <ChevronRight className="w-4 h-4" />
                                ) : <span className="w-4" />}
                                {parentItem.itemName}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">{formatAmount(parentItem.budgetAmount)}</td>
                            <td className="px-3 py-2 text-right">{formatAmount(parentItem.cumulativeAmount)}</td>
                            <td className={`px-3 py-2 text-right ${isOverBudget ? 'text-red-600 font-bold' : ''}`}>
                              {parentProgressRate.toFixed(0)}%
                            </td>
                            <td className="px-3 py-2 text-right">{parentExpenseRatio.toFixed(0)}%</td>
                            {data.previousYear && (
                              <>
                                <td className="px-3 py-2 text-right bg-yellow-50">
                                  {formatAmount(parentComparisonItem?.previous?.cumulativeAmount || 0)}
                                </td>
                                <td className="px-3 py-2 text-right bg-blue-50">
                                  <span className={parentDiff >= 0 ? 'text-red-600' : 'text-blue-600'}>
                                    {parentDiff >= 0 ? '▲' : '▼'} {formatAmount(Math.abs(parentDiff))}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ];

                        // 자식 항목 행들 (펼친 상태일 때만 표시)
                        if (expandedExpenseItems.has(parentItem.itemName)) {
                          childItems.forEach((childItem) => {
                          const childComparisonItem = data.comparison?.expense.find(
                            (c) => c.itemName === childItem.itemName
                          );
                          const childProgressRate = childItem.budgetAmount > 0
                            ? (childItem.cumulativeAmount / childItem.budgetAmount * 100)
                            : 0;
                          const childExpenseRatio = totalExpense > 0
                            ? (childItem.cumulativeAmount / totalExpense * 100)
                            : 0;
                          const childDiff = childComparisonItem?.diff.cumulativeDiff || 0;
                          const childOverBudget = childProgressRate > 100;

                          rows.push(
                            <tr key={childItem.id} className="border-b hover:bg-gray-50">
                              <td className="px-3 py-2 pl-6 text-gray-700">ㄴ {childItem.itemName}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{formatAmount(childItem.budgetAmount)}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{formatAmount(childItem.cumulativeAmount)}</td>
                              <td className={`px-3 py-2 text-right ${childOverBudget ? 'text-red-600' : 'text-gray-700'}`}>
                                {childProgressRate.toFixed(0)}%
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700">{childExpenseRatio.toFixed(0)}%</td>
                              {data.previousYear && (
                                <>
                                  <td className="px-3 py-2 text-right bg-yellow-50 text-gray-700">
                                    {formatAmount(childComparisonItem?.previous?.cumulativeAmount || 0)}
                                  </td>
                                  <td className="px-3 py-2 text-right bg-blue-50">
                                    <span className={childDiff >= 0 ? 'text-red-600' : 'text-blue-600'}>
                                      {childDiff >= 0 ? '▲' : '▼'} {formatAmount(Math.abs(childDiff))}
                                    </span>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                          });
                        }

                        return rows;
                      })}
                    {/* 합계 행 */}
                    <tr className="bg-red-100 font-medium">
                      <td className="px-3 py-2">합계</td>
                      <td className="px-3 py-2 text-right">
                        {formatAmount(data.currentYear?.expenseItems
                          .filter((item) => item.level === 1)
                          .reduce((sum, item) => sum + item.budgetAmount, 0) || 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatAmount(data.currentYear?.summary.cumulative.totalExpense || 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(() => {
                          const totalBudget = data.currentYear?.expenseItems
                            .filter((item) => item.level === 1)
                            .reduce((sum, item) => sum + item.budgetAmount, 0) || 0;
                          const cumTotalExpense = data.currentYear?.summary.cumulative.totalExpense || 0;
                          return totalBudget > 0
                            ? ((cumTotalExpense / totalBudget) * 100).toFixed(0)
                            : 0;
                        })()}%
                      </td>
                      <td className="px-3 py-2 text-right">100%</td>
                      {data.previousYear && (
                        <>
                          <td className="px-3 py-2 text-right bg-yellow-100">
                            {formatAmount(data.previousYear.summary.cumulative.totalExpense)}
                          </td>
                          <td className="px-3 py-2 text-right bg-blue-100">
                            {(() => {
                              const currentExpense = data.currentYear?.summary.cumulative.totalExpense || 0;
                              const previousExpense = data.previousYear?.summary.cumulative.totalExpense || 0;
                              const diff = currentExpense - previousExpense;
                              return (
                                <span className={diff >= 0 ? 'text-red-600' : 'text-blue-600'}>
                                  {diff >= 0 ? '▲' : '▼'} {formatAmount(Math.abs(diff))}
                                </span>
                              );
                            })()}
                          </td>
                        </>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 차트 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 수입 구성 */}
            <div className={SECTION_CARD}>
              <h3 className={SECTION_TITLE}>수입 구성</h3>
              {incomeChartData.length > 0 ? (
                <PieChart data={incomeChartData} height={280} showCenterTotal={true} />
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

            {/* 분기별 추이 */}
            {data.trendData && data.trendData.length > 0 && (
              <div className={`${SECTION_CARD} lg:col-span-2`}>
                <h3 className={SECTION_TITLE}>분기별 수입/지출 추이 ({year}년)</h3>
                <LineChart
                  data={data.trendData}
                  showIncome={true}
                  showExpense={true}
                  showPrevious={compareMode && data.trendData.some((d) => d.previousIncome !== undefined)}
                  height={280}
                />
              </div>
            )}

            {/* 예산 집행률 */}
            {expenseChartData.length > 0 && (
              <div className={SECTION_CARD}>
                <h3 className={SECTION_TITLE}>지출 예산 집행률</h3>
                <BarChart
                  data={expenseChartData}
                  valueKey="rate"
                  threshold={100}
                  thresholdColor="#ef4444"
                  unit="%"
                  height={280}
                />
              </div>
            )}

            {/* 수입/지출 카테고리 비교 */}
            {(incomeChartData.length > 0 || expenseChartData.length > 0) && (
              <div className={SECTION_CARD}>
                <h3 className={SECTION_TITLE}>주요 항목 예산 vs 실적</h3>
                <BarChart
                  data={[
                    ...data.currentYear.incomeItems
                      .filter((item) => item.level === 1 && !EXCLUDED_INCOME_ITEMS.includes(item.itemName))
                      .slice(0, 3)
                      .map((item) => ({
                        name: item.itemName.length > 5 ? item.itemName.slice(0, 5) + '..' : item.itemName,
                        budget: item.budgetAmount,
                        actual: item.cumulativeAmount,
                      })),
                    ...data.currentYear.expenseItems
                      .filter((item) => item.level === 1)
                      .slice(0, 3)
                      .map((item) => ({
                        name: item.itemName.length > 5 ? item.itemName.slice(0, 5) + '..' : item.itemName,
                        budget: item.budgetAmount,
                        actual: item.cumulativeAmount,
                      })),
                  ]}
                  showBudget={true}
                  showActual={true}
                  showPrevious={false}
                  height={280}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
