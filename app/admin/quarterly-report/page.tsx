'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  Download,
  ChevronDown,
  ChevronRight,
  FileText,
  Building2,
  Calendar,
  Wallet,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import {
  SECTION_CARD,
  SELECT_BASE,
  BTN_OUTLINE,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
  TABLE_CELL_RIGHT,
  SPINNER_MD,
} from '@/lib/constants/styles';

interface QuarterlyReportData {
  year: number;
  quarter: number;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalExpenses: number;
    totalAmount: number;
    completedAmount: number;
    pendingAmount: number;
  };
  budgetSummary: {
    // 연간
    totalBudget: number;
    yearlySpent: number;
    yearlyRemaining: number;
    yearlyExecutionRate: number;
    // 분기별
    quarterlyBudget: number;
    quarterlySpent: number;
    quarterlyRemaining: number;
    quarterlyExecutionRate: number;
  };
  byMonth: Array<{
    month: number;
    monthLabel: string;
    count: number;
    amount: number;
    ratio: number;
  }>;
  byDepartment: Array<{
    committee: string;
    department: string;
    count: number;
    amount: number;
    ratio: number;
    categoryDetails: Array<{
      category: string;
      subcategory: string;
      count: number;
      amount: number;
      ratio: number;
    }>;
  }>;
  byCategory: Array<{
    category: string;
    count: number;
    spentAmount: number;
    budgetAmount: number;
    remainingAmount: number;
    executionRate: number;
    ratio: number;
    subcategories: Array<{
      subcategory: string;
      count: number;
      spentAmount: number;
      budgetAmount: number;
      remainingAmount: number;
      executionRate: number;
      ratio: number;
    }>;
  }>;
  filterOptions: {
    departments: Array<{ committee: string; department: string }>;
    categories: string[];
  };
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

export default function QuarterlyReportPage() {
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;

  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuarterlyReportData | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        quarter: quarter.toString(),
        ...(department && { department }),
        ...(category && { category }),
        ...(paymentStatus && { paymentStatus }),
      });

      const response = await fetch(`/api/admin/quarterly-report?${params}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching quarterly report:', error);
    } finally {
      setLoading(false);
    }
  }, [year, quarter, department, category, paymentStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (data) {
      setExpandedCategories(new Set(data.byCategory.map((c) => c.category)));
    }
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const getDeptKey = (dept: { committee: string; department: string }) =>
    `${dept.committee}|${dept.department}`;

  const toggleDepartment = (deptKey: string) => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(deptKey)) {
        next.delete(deptKey);
      } else {
        next.add(deptKey);
      }
      return next;
    });
  };

  const expandAllDepartments = () => {
    if (data) {
      setExpandedDepartments(new Set(data.byDepartment.map((d) => getDeptKey(d))));
    }
  };

  const collapseAllDepartments = () => {
    setExpandedDepartments(new Set());
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">분기별 회계보고</h1>
          <p className="text-sm text-gray-500 mt-1">
            분기별 지출 현황을 조회하고 보고서를 생성합니다.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <FileText className="w-4 h-4" />
            <span>총 건수</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? '-' : `${data?.summary.totalExpenses || 0}건`}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Wallet className="w-4 h-4" />
            <span>분기 지출</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {loading ? '-' : formatAmount(data?.summary.totalAmount || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-emerald-500">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Wallet className="w-4 h-4" />
            <span>지급완료</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {loading ? '-' : formatAmount(data?.summary.completedAmount || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-amber-500">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Wallet className="w-4 h-4" />
            <span>지급대기</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {loading ? '-' : formatAmount(data?.summary.pendingAmount || 0)}
          </div>
        </div>
      </div>

      {/* Budget Summary Cards - 연간 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
          <PiggyBank className="w-4 h-4" />
          연간 예산 현황
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border-l-4 border-indigo-500 pl-3">
            <div className="text-xs text-gray-500 mb-1">예산액</div>
            <div className="text-xl font-bold text-indigo-600">
              {loading ? '-' : formatAmount(data?.budgetSummary?.totalBudget || 0)}
            </div>
          </div>
          <div className="border-l-4 border-purple-500 pl-3">
            <div className="text-xs text-gray-500 mb-1">지출액</div>
            <div className="text-xl font-bold text-purple-600">
              {loading ? '-' : formatAmount(data?.budgetSummary?.yearlySpent || 0)}
            </div>
          </div>
          <div className="border-l-4 border-teal-500 pl-3">
            <div className="text-xs text-gray-500 mb-1">잔액</div>
            <div className={`text-xl font-bold ${(data?.budgetSummary?.yearlyRemaining || 0) < 0 ? 'text-red-600' : 'text-teal-600'}`}>
              {loading ? '-' : formatAmount(data?.budgetSummary?.yearlyRemaining || 0)}
            </div>
          </div>
          <div className="border-l-4 border-cyan-500 pl-3">
            <div className="text-xs text-gray-500 mb-1">집행률</div>
            <div className="text-xl font-bold text-cyan-600">
              {loading ? '-' : `${data?.budgetSummary?.yearlyExecutionRate || 0}%`}
            </div>
            {!loading && data?.budgetSummary && (
              <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    (data.budgetSummary.yearlyExecutionRate || 0) >= 100
                      ? 'bg-red-500'
                      : (data.budgetSummary.yearlyExecutionRate || 0) >= 80
                      ? 'bg-amber-500'
                      : 'bg-cyan-500'
                  }`}
                  style={{ width: `${Math.min(data.budgetSummary.yearlyExecutionRate || 0, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Budget Summary Cards - 분기별 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {quarter}분기 예산 현황
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border-l-4 border-blue-500 pl-3">
            <div className="text-xs text-gray-500 mb-1">예산액</div>
            <div className="text-xl font-bold text-blue-600">
              {loading ? '-' : formatAmount(data?.budgetSummary?.quarterlyBudget || 0)}
            </div>
          </div>
          <div className="border-l-4 border-green-500 pl-3">
            <div className="text-xs text-gray-500 mb-1">지출액</div>
            <div className="text-xl font-bold text-green-600">
              {loading ? '-' : formatAmount(data?.budgetSummary?.quarterlySpent || 0)}
            </div>
          </div>
          <div className="border-l-4 border-emerald-500 pl-3">
            <div className="text-xs text-gray-500 mb-1">잔액</div>
            <div className={`text-xl font-bold ${(data?.budgetSummary?.quarterlyRemaining || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {loading ? '-' : formatAmount(data?.budgetSummary?.quarterlyRemaining || 0)}
            </div>
          </div>
          <div className="border-l-4 border-amber-500 pl-3">
            <div className="text-xs text-gray-500 mb-1">집행률</div>
            <div className="text-xl font-bold text-amber-600">
              {loading ? '-' : `${data?.budgetSummary?.quarterlyExecutionRate || 0}%`}
            </div>
            {!loading && data?.budgetSummary && (
              <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    (data.budgetSummary.quarterlyExecutionRate || 0) >= 100
                      ? 'bg-red-500'
                      : (data.budgetSummary.quarterlyExecutionRate || 0) >= 80
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(data.budgetSummary.quarterlyExecutionRate || 0, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={SECTION_CARD}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className={`${SELECT_BASE} w-28`}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <select
              value={quarter}
              onChange={(e) => setQuarter(parseInt(e.target.value))}
              className={`${SELECT_BASE} w-28`}
            >
              <option value={1}>1분기</option>
              <option value={2}>2분기</option>
              <option value={3}>3분기</option>
              <option value={4}>4분기</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-400" />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={`${SELECT_BASE} w-40`}
            >
              <option value="">전체 부서</option>
              {data?.filterOptions.departments.map((d, i) => (
                <option key={i} value={d.department}>
                  {d.department}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${SELECT_BASE} w-40`}
            >
              <option value="">전체 예산항</option>
              {data?.filterOptions.categories.map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-gray-400" />
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className={`${SELECT_BASE} w-32`}
            >
              <option value="">전체 상태</option>
              <option value="COMPLETED">지급완료</option>
              <option value="PENDING">지급대기</option>
            </select>
          </div>

          <div className="ml-auto">
            <button
              className={BTN_OUTLINE}
              onClick={() => {
                const params = new URLSearchParams({
                  year: year.toString(),
                  quarter: quarter.toString(),
                  ...(department && { department }),
                  ...(category && { category }),
                  ...(paymentStatus && { paymentStatus }),
                });
                window.location.href = `/api/admin/quarterly-report/export?${params}`;
              }}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>

        {data && (
          <div className="mt-3 text-sm text-gray-500">
            조회 기간: {data.period.startDate} ~ {data.period.endDate}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className={SPINNER_MD} />
        </div>
      ) : (
        <>
          {/* Monthly Table */}
          <div className={SECTION_CARD}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              월별 지출 현황
            </h2>
            <div className="overflow-x-auto">
              <table className={TABLE_BASE}>
                <thead className={TABLE_HEADER}>
                  <tr>
                    <th className={TABLE_HEADER_CELL}>월</th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>건수</th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>금액</th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>비율</th>
                    <th className={TABLE_HEADER_CELL} style={{ width: '30%' }}>
                      그래프
                    </th>
                  </tr>
                </thead>
                <tbody className={TABLE_BODY}>
                  {data?.byMonth.map((month) => (
                    <tr key={month.month}>
                      <td className={TABLE_CELL}>{month.monthLabel}</td>
                      <td className={TABLE_CELL_RIGHT}>{month.count}건</td>
                      <td className={TABLE_CELL_RIGHT}>{formatAmount(month.amount)}</td>
                      <td className={TABLE_CELL_RIGHT}>{month.ratio}%</td>
                      <td className={TABLE_CELL}>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                          <div
                            className="bg-blue-500 h-4 rounded-full transition-all"
                            style={{ width: `${Math.min(month.ratio, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!data?.byMonth || data.byMonth.length === 0) && (
                    <tr>
                      <td colSpan={5} className={`${TABLE_CELL} text-center text-gray-500`}>
                        데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Department Table with Accordion */}
          <div className={SECTION_CARD}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-500" />
                부서별 지출 현황
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={expandAllDepartments}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  전체 펼치기
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={collapseAllDepartments}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  전체 접기
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className={TABLE_BASE}>
                <thead className={TABLE_HEADER}>
                  <tr>
                    <th className={TABLE_HEADER_CELL}>위원회</th>
                    <th className={TABLE_HEADER_CELL}>사역팀(부)</th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>건수</th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>금액</th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>비율</th>
                  </tr>
                </thead>
                <tbody className={TABLE_BODY}>
                  {data?.byDepartment.map((dept) => {
                    const deptKey = getDeptKey(dept);
                    const isExpanded = expandedDepartments.has(deptKey);

                    return (
                      <Fragment key={deptKey}>
                        {/* 부서 행 (클릭 가능) */}
                        <tr
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleDepartment(deptKey)}
                        >
                          <td className={TABLE_CELL}>
                            <div className="flex items-center gap-2 font-medium">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                              {dept.committee}
                            </div>
                          </td>
                          <td className={`${TABLE_CELL} font-medium`}>{dept.department}</td>
                          <td className={`${TABLE_CELL_RIGHT} font-medium`}>{dept.count}건</td>
                          <td className={`${TABLE_CELL_RIGHT} font-medium`}>{formatAmount(dept.amount)}</td>
                          <td className={`${TABLE_CELL_RIGHT} font-medium`}>{dept.ratio}%</td>
                        </tr>

                        {/* 계정과목별 상세 (펼쳐진 경우) */}
                        {isExpanded &&
                          dept.categoryDetails?.map((cat, idx) => (
                            <tr key={`${deptKey}-${idx}`} className="bg-green-50">
                              <td className={TABLE_CELL}>
                                <div className="pl-8 text-gray-600">└ {cat.category}</div>
                              </td>
                              <td className={`${TABLE_CELL} text-gray-600`}>{cat.subcategory}</td>
                              <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>{cat.count}건</td>
                              <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>
                                {formatAmount(cat.amount)}
                              </td>
                              <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>{cat.ratio}%</td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                  {(!data?.byDepartment || data.byDepartment.length === 0) && (
                    <tr>
                      <td colSpan={5} className={`${TABLE_CELL} text-center text-gray-500`}>
                        데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Accordion Table with Budget */}
          <div className={SECTION_CARD}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-500" />
                예산 대비 지출 현황 (계정과목별)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  전체 펼치기
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={collapseAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  전체 접기
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className={TABLE_BASE}>
                <thead className={TABLE_HEADER}>
                  <tr>
                    <th className={TABLE_HEADER_CELL} style={{ width: '20%' }}>
                      계정과목
                    </th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>예산액</th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>지출액</th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>잔액</th>
                    <th className={`${TABLE_HEADER_CELL} text-right`}>집행률</th>
                    <th className={TABLE_HEADER_CELL} style={{ width: '15%' }}>진행</th>
                  </tr>
                </thead>
                <tbody className={TABLE_BODY}>
                  {data?.byCategory.map((cat) => (
                    <>
                      <tr
                        key={cat.category}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleCategory(cat.category)}
                      >
                        <td className={TABLE_CELL}>
                          <div className="flex items-center gap-2 font-medium">
                            {expandedCategories.has(cat.category) ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                            {cat.category}
                          </div>
                        </td>
                        <td className={`${TABLE_CELL_RIGHT} font-medium`}>
                          {formatAmount(cat.budgetAmount)}
                        </td>
                        <td className={`${TABLE_CELL_RIGHT} font-medium`}>
                          {formatAmount(cat.spentAmount)}
                        </td>
                        <td className={`${TABLE_CELL_RIGHT} font-medium ${cat.remainingAmount < 0 ? 'text-red-600' : ''}`}>
                          {formatAmount(cat.remainingAmount)}
                        </td>
                        <td className={`${TABLE_CELL_RIGHT} font-medium`}>
                          <span className={
                            cat.executionRate >= 100
                              ? 'text-red-600'
                              : cat.executionRate >= 80
                              ? 'text-amber-600'
                              : 'text-green-600'
                          }>
                            {cat.executionRate}%
                          </span>
                        </td>
                        <td className={TABLE_CELL}>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${
                                cat.executionRate >= 100
                                  ? 'bg-red-500'
                                  : cat.executionRate >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(cat.executionRate, 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                      {expandedCategories.has(cat.category) &&
                        cat.subcategories.map((sub, i) => (
                          <tr key={`${cat.category}-${i}`} className="bg-gray-50">
                            <td className={TABLE_CELL}>
                              <div className="pl-8 text-gray-600">└ {sub.subcategory}</div>
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>
                              {formatAmount(sub.budgetAmount)}
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>
                              {formatAmount(sub.spentAmount)}
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-600 ${sub.remainingAmount < 0 ? 'text-red-600' : ''}`}>
                              {formatAmount(sub.remainingAmount)}
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>
                              <span className={
                                sub.executionRate >= 100
                                  ? 'text-red-600'
                                  : sub.executionRate >= 80
                                  ? 'text-amber-600'
                                  : 'text-green-600'
                              }>
                                {sub.executionRate}%
                              </span>
                            </td>
                            <td className={TABLE_CELL}>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    sub.executionRate >= 100
                                      ? 'bg-red-400'
                                      : sub.executionRate >= 80
                                      ? 'bg-amber-400'
                                      : 'bg-green-400'
                                  }`}
                                  style={{ width: `${Math.min(sub.executionRate, 100)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                    </>
                  ))}
                  {(!data?.byCategory || data.byCategory.length === 0) && (
                    <tr>
                      <td colSpan={6} className={`${TABLE_CELL} text-center text-gray-500`}>
                        데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
