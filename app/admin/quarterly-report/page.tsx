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
    count: number;
    amount: number;
    ratio: number;
    departments: Array<{
      department: string;
      count: number;
      amount: number;
      deptRatio: number;
      categoryDetails: Array<{
        category: string;
        count: number;
        amount: number;
        ratio: number;
        subcategories: Array<{
          subcategory: string;
          count: number;
          amount: number;
          ratio: number;
          details: Array<{
            detail: string;
            count: number;
            amount: number;
            ratio: number;
          }>;
        }>;
      }>;
    }>;
  }>;
  byCategory: Array<{
    category: string;
    count: number;
    spentAmount: number;
    // 연간 기준
    budgetAmount: number;
    yearlySpentAmount: number;
    yearlyRemainingAmount: number;
    yearlyExecutionRate: number;
    // 분기 기준
    quarterlyBudget: number;
    quarterlyRemaining: number;
    quarterlyExecutionRate: number;
    ratio: number;
    subcategories: Array<{
      subcategory: string;
      count: number;
      spentAmount: number;
      // 연간 기준
      budgetAmount: number;
      yearlySpentAmount: number;
      yearlyRemainingAmount: number;
      yearlyExecutionRate: number;
      // 분기 기준
      quarterlyBudget: number;
      quarterlyRemaining: number;
      quarterlyExecutionRate: number;
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
  // 부서별 계층용 상태
  const [expandedCommittees, setExpandedCommittees] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [expandedDeptCategories, setExpandedDeptCategories] = useState<Set<string>>(new Set());
  const [expandedDeptSubcategories, setExpandedDeptSubcategories] = useState<Set<string>>(new Set());
  // 연간 컬럼 표시 여부
  const [showYearlyColumns, setShowYearlyColumns] = useState(false);

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

  // 위원회 토글
  const toggleCommittee = (committee: string) => {
    setExpandedCommittees((prev) => {
      const next = new Set(prev);
      if (next.has(committee)) {
        next.delete(committee);
        // 하위 부서도 접기
        setExpandedDepartments((prevDept) => {
          const nextDept = new Set(prevDept);
          prevDept.forEach((k) => {
            if (k.startsWith(committee + '|')) nextDept.delete(k);
          });
          return nextDept;
        });
      } else {
        next.add(committee);
      }
      return next;
    });
  };

  // 부서 토글 (committee|department 키 사용)
  const toggleDepartment = (deptKey: string) => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(deptKey)) {
        next.delete(deptKey);
        // 하위 항도 접기
        setExpandedDeptCategories((prevCat) => {
          const nextCat = new Set(prevCat);
          prevCat.forEach((k) => {
            if (k.startsWith(deptKey + '|')) nextCat.delete(k);
          });
          return nextCat;
        });
        setExpandedDeptSubcategories((prevSub) => {
          const nextSub = new Set(prevSub);
          prevSub.forEach((k) => {
            if (k.startsWith(deptKey + '|')) nextSub.delete(k);
          });
          return nextSub;
        });
      } else {
        next.add(deptKey);
      }
      return next;
    });
  };

  const expandAllDepartments = () => {
    if (data) {
      // 1. 위원회 펼치기
      setExpandedCommittees(new Set(data.byDepartment.map((c) => c.committee)));

      // 2. 부서 펼치기
      const deptKeys = new Set<string>();
      data.byDepartment.forEach((comm) => {
        comm.departments?.forEach((dept) => {
          deptKeys.add(`${comm.committee}|${dept.department}`);
        });
      });
      setExpandedDepartments(deptKeys);

      // 3. 항 펼치기
      const catKeys = new Set<string>();
      data.byDepartment.forEach((comm) => {
        comm.departments?.forEach((dept) => {
          const deptKey = `${comm.committee}|${dept.department}`;
          dept.categoryDetails?.forEach((cat) => {
            catKeys.add(`${deptKey}|${cat.category}`);
          });
        });
      });
      setExpandedDeptCategories(catKeys);

      // 4. 목 펼치기 (세목은 펼치지 않음)
      const subKeys = new Set<string>();
      data.byDepartment.forEach((comm) => {
        comm.departments?.forEach((dept) => {
          const deptKey = `${comm.committee}|${dept.department}`;
          dept.categoryDetails?.forEach((cat) => {
            const catKey = `${deptKey}|${cat.category}`;
            cat.subcategories?.forEach((sub) => {
              subKeys.add(`${catKey}|${sub.subcategory}`);
            });
          });
        });
      });
      setExpandedDeptSubcategories(subKeys);
    }
  };

  const collapseAllDepartments = () => {
    setExpandedCommittees(new Set());
    setExpandedDepartments(new Set());
    setExpandedDeptCategories(new Set());
    setExpandedDeptSubcategories(new Set());
  };

  // 부서 내 항 토글
  const toggleDeptCategory = (deptKey: string, category: string) => {
    const key = `${deptKey}|${category}`;
    setExpandedDeptCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // 하위 목도 접기
        setExpandedDeptSubcategories((prevSub) => {
          const nextSub = new Set(prevSub);
          prevSub.forEach((k) => {
            if (k.startsWith(key + '|')) nextSub.delete(k);
          });
          return nextSub;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 부서 내 목 토글
  const toggleDeptSubcategory = (deptKey: string, category: string, subcategory: string) => {
    const key = `${deptKey}|${category}|${subcategory}`;
    setExpandedDeptSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
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
                    <th className={TABLE_HEADER_CELL}>위원회 / 사역팀(부) / 항 / 목 / 세목</th>
                    <th className={TABLE_HEADER_CELL}>건수</th>
                    <th className={TABLE_HEADER_CELL}>금액</th>
                    <th className={TABLE_HEADER_CELL}>비율</th>
                  </tr>
                </thead>
                <tbody className={TABLE_BODY}>
                  {data?.byDepartment.map((comm) => {
                    const isCommExpanded = expandedCommittees.has(comm.committee);

                    return (
                      <Fragment key={comm.committee}>
                        {/* Level 0: 위원회 */}
                        <tr
                          className="cursor-pointer hover:bg-gray-50 bg-blue-50"
                          onClick={() => toggleCommittee(comm.committee)}
                        >
                          <td className={TABLE_CELL}>
                            <div className="flex items-center gap-2 font-bold text-blue-800">
                              {isCommExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-blue-600" />
                              )}
                              {comm.committee}
                            </div>
                          </td>
                          <td className={`${TABLE_CELL_RIGHT} font-bold text-blue-800`}>{comm.count}건</td>
                          <td className={`${TABLE_CELL_RIGHT} font-bold text-blue-800`}>{formatAmount(comm.amount)}</td>
                          <td className={`${TABLE_CELL_RIGHT} font-bold text-blue-800`}>{comm.ratio}%</td>
                        </tr>

                        {/* Level 1: 사역팀(부) */}
                        {isCommExpanded &&
                          comm.departments?.map((dept) => {
                            const deptKey = `${comm.committee}|${dept.department}`;
                            const isDeptExpanded = expandedDepartments.has(deptKey);

                            return (
                              <Fragment key={deptKey}>
                                <tr
                                  className="cursor-pointer hover:bg-gray-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDepartment(deptKey);
                                  }}
                                >
                                  <td className={TABLE_CELL}>
                                    <div className="pl-6 flex items-center gap-2 font-medium">
                                      {isDeptExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                      )}
                                      {dept.department}
                                    </div>
                                  </td>
                                  <td className={`${TABLE_CELL_RIGHT} font-medium`}>{dept.count}건</td>
                                  <td className={`${TABLE_CELL_RIGHT} font-medium`}>{formatAmount(dept.amount)}</td>
                                  <td className={`${TABLE_CELL_RIGHT} font-medium`}>{dept.deptRatio}%</td>
                                </tr>

                                {/* Level 2: 항 */}
                                {isDeptExpanded &&
                                  dept.categoryDetails?.map((cat) => {
                                    const catKey = `${deptKey}|${cat.category}`;
                                    const isCatExpanded = expandedDeptCategories.has(catKey);

                                    return (
                                      <Fragment key={catKey}>
                                        <tr
                                          className="bg-green-50 cursor-pointer hover:bg-green-100"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleDeptCategory(deptKey, cat.category);
                                          }}
                                        >
                                          <td className={TABLE_CELL}>
                                            <div className="pl-12 flex items-center gap-2 text-gray-700">
                                              {isCatExpanded ? (
                                                <ChevronDown className="w-3 h-3 text-gray-400" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3 text-gray-400" />
                                              )}
                                              <span className="font-medium">항:</span> {cat.category}
                                            </div>
                                          </td>
                                          <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>{cat.count}건</td>
                                          <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>{formatAmount(cat.amount)}</td>
                                          <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>{cat.ratio}%</td>
                                        </tr>

                                        {/* Level 3: 목 */}
                                        {isCatExpanded &&
                                          cat.subcategories?.map((sub) => {
                                            const subKey = `${catKey}|${sub.subcategory}`;
                                            const isSubExpanded = expandedDeptSubcategories.has(subKey);

                                            return (
                                              <Fragment key={subKey}>
                                                <tr
                                                  className="bg-green-100 cursor-pointer hover:bg-green-200"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleDeptSubcategory(deptKey, cat.category, sub.subcategory);
                                                  }}
                                                >
                                                  <td className={TABLE_CELL}>
                                                    <div className="pl-16 flex items-center gap-2 text-gray-600">
                                                      {isSubExpanded ? (
                                                        <ChevronDown className="w-3 h-3 text-gray-400" />
                                                      ) : (
                                                        <ChevronRight className="w-3 h-3 text-gray-400" />
                                                      )}
                                                      <span className="font-medium">목:</span> {sub.subcategory}
                                                    </div>
                                                  </td>
                                                  <td className={`${TABLE_CELL_RIGHT} text-gray-500`}>{sub.count}건</td>
                                                  <td className={`${TABLE_CELL_RIGHT} text-gray-500`}>{formatAmount(sub.amount)}</td>
                                                  <td className={`${TABLE_CELL_RIGHT} text-gray-500`}>{sub.ratio}%</td>
                                                </tr>

                                                {/* Level 4: 세목 */}
                                                {isSubExpanded &&
                                                  sub.details?.map((detail, detailIdx) => (
                                                    <tr key={`${subKey}-${detailIdx}`} className="bg-green-50">
                                                      <td className={TABLE_CELL}>
                                                        <div className="pl-20 text-gray-500">
                                                          └ <span className="text-xs text-gray-400">세목:</span> {detail.detail}
                                                        </div>
                                                      </td>
                                                      <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm`}>{detail.count}건</td>
                                                      <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm`}>{formatAmount(detail.amount)}</td>
                                                      <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm`}>{detail.ratio}%</td>
                                                    </tr>
                                                  ))}
                                              </Fragment>
                                            );
                                          })}
                                      </Fragment>
                                    );
                                  })}
                              </Fragment>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                  {(!data?.byDepartment || data.byDepartment.length === 0) && (
                    <tr>
                      <td colSpan={4} className={`${TABLE_CELL} text-center text-gray-500`}>
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
                분기별 예산 대비 지출 현황 (계정과목별)
              </h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showYearlyColumns}
                    onChange={(e) => setShowYearlyColumns(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  연간 정보 표시
                </label>
                <span className="text-gray-300">|</span>
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
                    <th className={TABLE_HEADER_CELL} style={{ width: '24%' }}>
                      계정과목
                    </th>
                    <th className={TABLE_HEADER_CELL}>분기예산</th>
                    <th className={TABLE_HEADER_CELL}>분기지출</th>
                    <th className={TABLE_HEADER_CELL}>분기잔액</th>
                    <th className={TABLE_HEADER_CELL} style={{ width: '8%' }}>분기집행률</th>
                    <th className={TABLE_HEADER_CELL} style={{ width: '8%' }}>진행</th>
                    {showYearlyColumns && (
                      <>
                        <th className={`${TABLE_HEADER_CELL} text-gray-500`}>(연간예산)</th>
                        <th className={`${TABLE_HEADER_CELL} text-gray-500`}>(연간지출)</th>
                        <th className={`${TABLE_HEADER_CELL} text-gray-500`}>(연간잔액)</th>
                        <th className={`${TABLE_HEADER_CELL} text-gray-500`}>(연간집행률)</th>
                      </>
                    )}
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
                          {formatAmount(cat.quarterlyBudget)}
                        </td>
                        <td className={`${TABLE_CELL_RIGHT} font-medium`}>
                          {formatAmount(cat.spentAmount)}
                        </td>
                        <td className={`${TABLE_CELL_RIGHT} font-medium ${cat.quarterlyRemaining < 0 ? 'text-red-600' : ''}`}>
                          {formatAmount(cat.quarterlyRemaining)}
                        </td>
                        <td className={`${TABLE_CELL_RIGHT} font-medium`}>
                          <span className={
                            cat.quarterlyExecutionRate >= 100
                              ? 'text-red-600'
                              : cat.quarterlyExecutionRate >= 80
                              ? 'text-amber-600'
                              : 'text-green-600'
                          }>
                            {cat.quarterlyExecutionRate}%
                          </span>
                        </td>
                        <td className={TABLE_CELL}>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${
                                cat.quarterlyExecutionRate >= 100
                                  ? 'bg-red-500'
                                  : cat.quarterlyExecutionRate >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(cat.quarterlyExecutionRate, 100)}%` }}
                            />
                          </div>
                        </td>
                        {showYearlyColumns && (
                          <>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm`}>
                              {formatAmount(cat.budgetAmount)}
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm`}>
                              {formatAmount(cat.yearlySpentAmount)}
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm ${cat.yearlyRemainingAmount < 0 ? 'text-red-500' : ''}`}>
                              {formatAmount(cat.yearlyRemainingAmount)}
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm`}>
                              <span className={
                                cat.yearlyExecutionRate >= 100
                                  ? 'text-red-500'
                                  : cat.yearlyExecutionRate >= 80
                                  ? 'text-amber-500'
                                  : 'text-gray-400'
                              }>
                                {cat.yearlyExecutionRate}%
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                      {expandedCategories.has(cat.category) &&
                        cat.subcategories.map((sub, i) => (
                          <tr key={`${cat.category}-${i}`} className="bg-gray-50">
                            <td className={TABLE_CELL}>
                              <div className="pl-8 text-gray-600">└ {sub.subcategory}</div>
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>
                              {formatAmount(sub.quarterlyBudget)}
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>
                              {formatAmount(sub.spentAmount)}
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-600 ${sub.quarterlyRemaining < 0 ? 'text-red-600' : ''}`}>
                              {formatAmount(sub.quarterlyRemaining)}
                            </td>
                            <td className={`${TABLE_CELL_RIGHT} text-gray-600`}>
                              <span className={
                                sub.quarterlyExecutionRate >= 100
                                  ? 'text-red-600'
                                  : sub.quarterlyExecutionRate >= 80
                                  ? 'text-amber-600'
                                  : 'text-green-600'
                              }>
                                {sub.quarterlyExecutionRate}%
                              </span>
                            </td>
                            <td className={TABLE_CELL}>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    sub.quarterlyExecutionRate >= 100
                                      ? 'bg-red-400'
                                      : sub.quarterlyExecutionRate >= 80
                                      ? 'bg-amber-400'
                                      : 'bg-green-400'
                                  }`}
                                  style={{ width: `${Math.min(sub.quarterlyExecutionRate, 100)}%` }}
                                />
                              </div>
                            </td>
                            {showYearlyColumns && (
                              <>
                                <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm`}>
                                  {formatAmount(sub.budgetAmount)}
                                </td>
                                <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm`}>
                                  {formatAmount(sub.yearlySpentAmount)}
                                </td>
                                <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm ${sub.yearlyRemainingAmount < 0 ? 'text-red-500' : ''}`}>
                                  {formatAmount(sub.yearlyRemainingAmount)}
                                </td>
                                <td className={`${TABLE_CELL_RIGHT} text-gray-400 text-sm`}>
                                  <span className={
                                    sub.yearlyExecutionRate >= 100
                                      ? 'text-red-500'
                                      : sub.yearlyExecutionRate >= 80
                                      ? 'text-amber-500'
                                      : 'text-gray-400'
                                  }>
                                    {sub.yearlyExecutionRate}%
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                    </>
                  ))}
                  {(!data?.byCategory || data.byCategory.length === 0) && (
                    <tr>
                      <td colSpan={showYearlyColumns ? 10 : 6} className={`${TABLE_CELL} text-center text-gray-500`}>
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
