'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Header from '@/components/Header';
import ApprovalStatusBadge from '@/components/approval/ApprovalStatusBadge';
import { formatCurrency } from '@/lib/utils';
import { Clock, CheckCircle, FileText, User, Building2, Calendar } from 'lucide-react';

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

// 결재자 목록 (실제로는 인증 시스템에서 가져와야 함)
// approval-engine.ts의 DEPARTMENT_APPROVERS와 일치해야 함
const APPROVERS = [
  { name: '팀장', role: '팀장 (기본)' },
  { name: '김재정', role: '팀장 (재정팀)' },
  { name: '최교육', role: '팀장 (교육팀)' },
  { name: '강선교', role: '팀장 (선교팀)' },
  { name: '박회계', role: '회계' },
  { name: '이재무', role: '재정팀장' },
];

export default function ApprovalsPage() {
  const router = useRouter();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApprover, setSelectedApprover] = useState('박회계');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');

  useEffect(() => {
    fetchApprovals();
  }, [selectedApprover, statusFilter]);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/approvals?approverName=${encodeURIComponent(selectedApprover)}&status=${statusFilter}`
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'yyyy-MM-dd HH:mm');
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'text-green-600';
      case 'REJECTED':
        return 'text-red-600';
      case 'PENDING':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 페이지 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">결재함</h1>
          <p className="text-gray-600">결재 대기 중인 지출결의서를 확인하고 처리하세요.</p>
        </div>

        {/* 필터 영역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 결재자 선택 */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                결재자 선택
              </label>
              <select
                value={selectedApprover}
                onChange={(e) => setSelectedApprover(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {APPROVERS.map((approver) => (
                  <option key={approver.name} value={approver.name}>
                    {approver.name} ({approver.role})
                  </option>
                ))}
              </select>
            </div>

            {/* 상태 필터 */}
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
                      ? 'bg-blue-600 text-white'
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
                      ? 'bg-blue-600 text-white'
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
                      ? 'bg-blue-600 text-white'
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchApprovals}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        ) : approvals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
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
                    ? 'border-blue-500 hover:border-blue-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* 기본 정보 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {item.isMyTurn && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                          결재 대기
                        </span>
                      )}
                      {item.approvalLine.isUrgent && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                          긴급
                        </span>
                      )}
                      <ApprovalStatusBadge status={item.expense.status} size="sm" />
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
                        <p className="font-semibold text-blue-600">
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
                                ? 'bg-green-100 text-green-700'
                                : step.status === 'REJECTED'
                                ? 'bg-red-100 text-red-700'
                                : step.stepNumber === item.approvalLine.currentStep
                                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                            title={`${step.stepName}: ${step.approverName}`}
                          >
                            {step.stepNumber}
                          </div>
                          {index < item.approvalLine.steps.length - 1 && (
                            <div
                              className={`w-4 h-0.5 ${
                                step.status === 'APPROVED' ? 'bg-green-300' : 'bg-gray-300'
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
      </main>
    </div>
  );
}
