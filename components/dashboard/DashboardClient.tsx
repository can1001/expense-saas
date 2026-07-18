'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Wallet, TrendingUp, CreditCard } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import StatusPill, { StatusPillVariant } from '@/components/ui/StatusPill';
import ProgressBar from '@/components/ui/ProgressBar';
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import DepartmentBudgetPanel from '@/components/dashboard/DepartmentBudgetPanel';
import { getFiscalYear } from '@/lib/utils/fiscal-year';

interface RecentExpense {
  id: string;
  applicantName: string;
  requestAmount: number;
  status: string;
  department: string | null;
}

interface DashboardData {
  kpi: {
    executionRate: number;
    pendingApprovals: number;
    monthlyExpense: number;
    pendingPayments: number;
  };
  recentExpenses: RecentExpense[];
}

const STATUS_LABELS: Record<string, { variant: StatusPillVariant; label: string }> = {
  PENDING: { variant: 'pending', label: '대기' },
  APPROVED_STEP_1: { variant: 'pending', label: '대기' },
  APPROVED_STEP_2: { variant: 'pending', label: '대기' },
  APPROVED_FINAL: { variant: 'approved', label: '승인' },
  REJECTED: { variant: 'rejected', label: '반려' },
};

function formatWon(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

function StatusCell({ status }: { status: string }) {
  const mapped = STATUS_LABELS[status];
  if (mapped) {
    return <StatusPill variant={mapped.variant}>{mapped.label}</StatusPill>;
  }
  return <StatusPill variant="brand">{status}</StatusPill>;
}

export default function DashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/dashboard?year=${getFiscalYear()}`);
        if (!res.ok) throw new Error('요청 실패');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError('대시보드 데이터를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-status-rejected">
        {error ?? '대시보드 데이터를 불러오지 못했습니다.'}
      </p>
    );
  }

  const { kpi, recentExpenses } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clock} label="대기 결재" value={`${kpi.pendingApprovals}건`} />
        <StatCard icon={Wallet} label="이번 달 지출" value={formatWon(kpi.monthlyExpense)} />
        <StatCard
          icon={TrendingUp}
          label="예산 집행률"
          value={`${kpi.executionRate}%`}
          sub={<ProgressBar value={kpi.executionRate} label="예산 집행률" />}
        />
        <StatCard icon={CreditCard} label="지급 대기" value={`${kpi.pendingPayments}건`} />
      </div>

      {/* 데스크톱: 테이블 2/3 + 부서별 집행 패널 1/3, 모바일: 패널이 하단 */}
      <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-surface-border bg-white shadow-sm lg:col-span-2">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">최근 지출결의서</h2>
          <Link href="/expenses" className="text-xs font-medium text-brand-600 hover:underline">
            전체 보기 →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="px-4 py-2 font-medium">신청자</th>
                <th className="px-4 py-2 font-medium">부서</th>
                <th className="px-4 py-2 text-right font-medium">금액</th>
                <th className="px-4 py-2 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {recentExpenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    최근 지출결의서가 없습니다.
                  </td>
                </tr>
              ) : (
                recentExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="cursor-pointer border-t border-surface-border hover:bg-surface-bg"
                    onClick={() => router.push(`/expenses/${expense.id}`)}
                  >
                    <td className="px-4 py-3">{expense.applicantName}</td>
                    <td className="px-4 py-3 text-gray-500">{expense.department ?? '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatWon(expense.requestAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusCell status={expense.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DepartmentBudgetPanel />
      </div>
    </div>
  );
}
