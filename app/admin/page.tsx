'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Wand2,
  FileBarChart,
  AlertTriangle,
  TrendingUp,
  Clock,
  DollarSign,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { SECTION_CARD, BTN_OUTLINE, BTN_SM } from '@/lib/constants/styles';

interface DashboardData {
  year: number;
  kpi: {
    executionRate: number;
    totalBudget: number;
    totalUsed: number;
    pendingApprovals: number;
    monthlyExpense: number;
    pendingPayments: number;
  };
  yearly: {
    totalExpense: number;
    expenseCount: number;
  };
  recentExpenses: Array<{
    id: string;
    applicantName: string;
    requestAmount: number;
    status: string;
    requestDate: string;
    department: string;
    committee: string;
    createdAt: string;
  }>;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '임시저장', color: 'bg-gray-100 text-gray-700' },
  PENDING: { label: '결재대기', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED_STEP_1: { label: '1차승인', color: 'bg-blue-100 text-blue-700' },
  APPROVED_STEP_2: { label: '2차승인', color: 'bg-indigo-100 text-indigo-700' },
  APPROVED_FINAL: { label: '최종승인', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: '반려', color: 'bg-red-100 text-red-700' },
};

const quickLinks = [
  {
    href: '/admin/budget-wizard',
    title: '연도별 설정 마법사',
    description: '새 연도 예산 초기 설정',
    icon: Wand2,
    color: 'bg-violet-500',
  },
  {
    href: '/approvals',
    title: '결재 대기함',
    description: '결재 대기 목록 확인',
    icon: Clock,
    color: 'bg-orange-500',
  },
  {
    href: '/admin/quarterly-report',
    title: '분기별 회계보고',
    description: '재직회 보고용 리포트',
    icon: FileBarChart,
    color: 'bg-blue-500',
  },
  {
    href: '/admin/manager-exceptions',
    title: '담당자 예외 현황',
    description: '팀장과 다른 담당자 목록',
    icon: AlertTriangle,
    color: 'bg-amber-500',
  },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  isRate = false,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  isRate?: boolean;
}) {
  return (
    <div className={SECTION_CARD}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {isRate ? `${value}%` : formatCurrency(value)}
            {!isRate && title.includes('건수') && <span className="text-base font-normal ml-1">건</span>}
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`${color} p-3 rounded-lg text-white`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {isRate && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${value >= 90 ? 'bg-green-500' : value >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(value, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/dashboard?year=${currentYear}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={fetchData} className={`${BTN_OUTLINE} ${BTN_SM}`}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
          <p className="text-gray-600 mt-1">{currentYear}년 현황 요약</p>
        </div>
        <button
          onClick={fetchData}
          className={`${BTN_OUTLINE} ${BTN_SM} flex items-center gap-2`}
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* KPI 카드 */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="예산 집행률"
            value={data.kpi.executionRate}
            subtitle={`${formatCurrency(data.kpi.totalUsed)}원 / ${formatCurrency(data.kpi.totalBudget)}원`}
            icon={TrendingUp}
            color="bg-blue-500"
            isRate
          />
          <KPICard
            title="결재 대기 건수"
            value={data.kpi.pendingApprovals}
            subtitle="승인 대기 중인 지출결의서"
            icon={Clock}
            color="bg-orange-500"
          />
          <KPICard
            title="이번 달 지출"
            value={data.kpi.monthlyExpense}
            subtitle="최종 승인된 금액"
            icon={DollarSign}
            color="bg-green-500"
          />
          <KPICard
            title="지급 대기 건수"
            value={data.kpi.pendingPayments}
            subtitle="지급 처리 필요"
            icon={CreditCard}
            color="bg-amber-500"
          />
        </div>
      )}

      {/* 빠른 링크 */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 접근</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow group flex items-start gap-4"
              >
                <div
                  className={`${item.color} p-3 rounded-lg text-white group-hover:scale-110 transition-transform flex-shrink-0`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 최근 지출결의서 */}
      {data && data.recentExpenses.length > 0 && (
        <div className={SECTION_CARD}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">최근 지출결의서</h2>
            <Link href="/expenses" className="text-sm text-blue-600 hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">신청자</th>
                  <th className="pb-2 font-medium">위원회</th>
                  <th className="pb-2 font-medium">부서</th>
                  <th className="pb-2 font-medium text-right">금액</th>
                  <th className="pb-2 font-medium text-center">상태</th>
                  <th className="pb-2 font-medium">신청일</th>
                </tr>
              </thead>
              <tbody>
                {data.recentExpenses.map((expense) => {
                  const statusInfo = STATUS_LABELS[expense.status] || {
                    label: expense.status,
                    color: 'bg-gray-100 text-gray-700',
                  };
                  return (
                    <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3">
                        <Link
                          href={`/expenses/${expense.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {expense.applicantName}
                        </Link>
                      </td>
                      <td className="py-3 text-gray-600">{expense.committee || '-'}</td>
                      <td className="py-3 text-gray-600">{expense.department || '-'}</td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(expense.requestAmount)}원
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(expense.requestDate).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 연간 요약 */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-2">
              <LayoutDashboard className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">{currentYear}년 연간 지출</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(data.yearly.totalExpense)}원
            </p>
            <p className="text-sm text-gray-500 mt-1">
              총 {data.yearly.expenseCount}건 처리
            </p>
          </div>
          <div className={SECTION_CARD}>
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">예산 잔액</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(data.kpi.totalBudget - data.kpi.totalUsed)}원
            </p>
            <p className="text-sm text-gray-500 mt-1">
              전체 예산의 {(100 - data.kpi.executionRate).toFixed(1)}% 잔여
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
