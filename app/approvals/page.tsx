'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeftRight, Clock, CheckCircle, FileText, User, Building2, Calendar } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Sidebar from '@/components/layout/Sidebar';
import SidebarUserCard from '@/components/layout/SidebarUserCard';
import TopbarBell from '@/components/layout/TopbarBell';
import TopbarUserMenu, { TopbarUserMenuUser } from '@/components/layout/TopbarUserMenu';
import TenantSwitcher, { useMemberships } from '@/components/TenantSwitcher';
import StatusPill, { StatusPillVariant } from '@/components/ui/StatusPill';
import { getGlobalSidebarMenu } from '@/lib/constants/global-menu';
import { canAccessApprovalMenu } from '@/lib/constants/menu-permissions';
import { usePendingApprovalCount } from '@/hooks/usePendingApprovalCount';
import { formatCurrency } from '@/lib/utils';
import { apiBase } from '@/lib/api/api-base';

interface UserInfo extends TopbarUserMenuUser {
  id: string;
  userid: string;
  username: string;
  role: string;
  roles?: string[];
  department?: string;
}

interface ApprovalItem {
  id: string;
  expense: {
    id: string;
    committee: string;
    department: string;
    budgetCategory: string;
    budgetSubcategory: string;
    requestAmount: number;
    applicantName: string;
    status: string;
    submittedAt: string | null;
    createdAt: string;
  };
  approvalLine: {
    id: string;
    currentStep: number;
    totalSteps: number;
    isUrgent: boolean;
    steps: Array<{
      stepNumber: number;
      stepName: string;
      approverName: string;
      status: string;
    }>;
  };
  myStep: {
    stepNumber: number;
    stepName: string;
    status: string;
    approvedAt: string | null;
    rejectedAt: string | null;
    comment: string | null;
  } | null;
  isMyTurn: boolean;
}

// 지출결의서 상태 → StatusPill 매핑 (ApprovalLineDisplay.tsx의 패턴과 동일)
const EXPENSE_STATUS_PILL: Partial<Record<string, StatusPillVariant>> = {
  PENDING: 'pending',
  APPROVED_STEP_1: 'pending',
  APPROVED_STEP_2: 'pending',
  IN_PROGRESS: 'pending',
  APPROVED_FINAL: 'approved',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const EXPENSE_STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성중',
  PENDING: '1차 결재대기',
  APPROVED_STEP_1: '2차 결재대기',
  APPROVED_STEP_2: '3차 결재대기',
  APPROVED_FINAL: '최종승인',
  IN_PROGRESS: '결재진행중',
  APPROVED: '승인완료',
  REJECTED: '반려',
  WITHDRAWN: '회수',
};

function ExpenseStatusPill({ status }: { status: string }) {
  const variant = EXPENSE_STATUS_PILL[status];
  const label = EXPENSE_STATUS_LABEL[status] ?? status;
  if (!variant) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
        {label}
      </span>
    );
  }
  return <StatusPill variant={variant}>{label}</StatusPill>;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTenantSwitcherOpen, setIsTenantSwitcherOpen] = useState(false);

  // 로그인 사용자 정보 가져오기
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${apiBase('auth')}/auth/me`);
        const data = await response.json();
        if (response.ok && data.user) {
          setUser(data.user);
        } else {
          // 로그인하지 않은 경우 로그인 페이지로 이동
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setUserLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const fetchApprovals = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${apiBase('approvals')}/approvals?approverName=${encodeURIComponent(user.username)}&status=${statusFilter}`
      );

      if (!response.ok) {
        throw new Error('결재 목록을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setApprovals(data.approvals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 사용자 정보가 있을 때 결재 목록 가져오기
  useEffect(() => {
    if (user) {
      fetchApprovals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statusFilter]);

  const userRoles = user?.roles ?? (user ? [user.role] : []);
  const canApprove = userRoles.some((role) => canAccessApprovalMenu(role));
  const { count: pendingApprovalCount } = usePendingApprovalCount({ enabled: canApprove });
  const sidebarConfig = getGlobalSidebarMenu({ roles: userRoles }, { pendingApprovalCount });
  const { memberships } = useMemberships(!!user);
  const canSwitchTenant = memberships.length > 1;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'yyyy-MM-dd HH:mm');
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'text-status-approved';
      case 'REJECTED':
        return 'text-status-rejected';
      case 'PENDING':
        return 'text-status-pending';
      default:
        return 'text-gray-600';
    }
  };

  if (userLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-bg">
        <div className="text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  return (
    <AppShell
      title="결재함"
      onOpenMobileMenu={() => setIsSidebarOpen(true)}
      topbarExtra={
        <>
          {canSwitchTenant && (
            <button
              onClick={() => setIsTenantSwitcherOpen(true)}
              aria-label="조직 전환"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </button>
          )}
          <TopbarBell />
          <TopbarUserMenu user={user} />
        </>
      }
      sidebar={
        <Sidebar
          config={sidebarConfig}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          footer={<SidebarUserCard />}
        />
      }
    >
      <div className="max-w-7xl mx-auto">
        {/* 필터 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-surface-border p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                상태 필터
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === 'pending'
                      ? 'bg-brand-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  대기중
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === 'completed'
                      ? 'bg-brand-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  처리완료
                </button>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-brand-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 결재 목록 */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          </div>
        ) : error ? (
          <div className="bg-status-rejected-bg border border-status-rejected rounded-lg p-6 text-center">
            <p className="text-status-rejected">{error}</p>
            <button
              onClick={fetchApprovals}
              className="mt-4 px-4 py-2 bg-status-rejected text-white rounded-lg hover:opacity-90"
            >
              다시 시도
            </button>
          </div>
        ) : approvals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-surface-border p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {statusFilter === 'pending'
                ? '결재 대기 중인 문서가 없습니다.'
                : statusFilter === 'completed'
                ? '처리 완료된 문서가 없습니다.'
                : '결재 문서가 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/approvals/${item.id}`)}
                className={`bg-white rounded-lg shadow-sm border-2 p-6 cursor-pointer transition-all hover:shadow-md ${
                  item.isMyTurn
                    ? 'border-brand-500 hover:border-brand-600'
                    : 'border-surface-border hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* 기본 정보 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {item.isMyTurn && (
                        <span className="px-2 py-1 bg-brand-100 text-brand-700 text-xs font-semibold rounded-full">
                          결재 대기
                        </span>
                      )}
                      {item.approvalLine.isUrgent && (
                        <span className="px-2 py-1 bg-status-rejected-bg text-status-rejected text-xs font-semibold rounded-full">
                          긴급
                        </span>
                      )}
                      <ExpenseStatusPill status={item.expense.status} />
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {item.expense.budgetCategory} - {item.expense.budgetSubcategory}
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">
                          <Building2 className="w-4 h-4 inline mr-1" />
                          위원회/부서
                        </span>
                        <p className="font-medium text-gray-900">
                          {item.expense.committee} / {item.expense.department}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          <User className="w-4 h-4 inline mr-1" />
                          신청자
                        </span>
                        <p className="font-medium text-gray-900">{item.expense.applicantName}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          제출일
                        </span>
                        <p className="font-medium text-gray-900">
                          {formatDate(item.expense.submittedAt)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">청구금액</span>
                        <p className="font-semibold text-brand-700">
                          {formatCurrency(item.expense.requestAmount)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 결재 진행 상태 */}
                  <div className="lg:w-64 bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-2">
                      결재 진행 ({item.approvalLine.currentStep}/{item.approvalLine.totalSteps})
                    </p>
                    <div className="flex items-center gap-2">
                      {item.approvalLine.steps.map((step, index) => (
                        <div key={index} className="flex items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                              step.status === 'APPROVED'
                                ? 'bg-brand-500 text-white'
                                : step.status === 'REJECTED'
                                ? 'bg-status-rejected text-white'
                                : step.stepNumber === item.approvalLine.currentStep
                                ? 'bg-white text-status-pending-bar ring-2 ring-status-pending-bar'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                            title={`${step.stepName}: ${step.approverName}`}
                          >
                            {step.stepNumber}
                          </div>
                          {index < item.approvalLine.steps.length - 1 && (
                            <div
                              className={`w-4 h-0.5 ${
                                step.status === 'APPROVED' ? 'bg-brand-500' : 'bg-gray-300'
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    {item.myStep && (
                      <p className={`text-xs mt-2 ${getStepStatusColor(item.myStep.status)}`}>
                        내 결재: {item.myStep.stepNumber}차 ({item.myStep.stepName}) -{' '}
                        {item.myStep.status === 'APPROVED'
                          ? '승인함'
                          : item.myStep.status === 'REJECTED'
                          ? '반려함'
                          : '대기중'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <TenantSwitcher
        isOpen={isTenantSwitcherOpen}
        onClose={() => setIsTenantSwitcherOpen(false)}
        memberships={memberships}
      />
    </AppShell>
  );
}
