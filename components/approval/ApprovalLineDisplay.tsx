'use client';

import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';

/**
 * 결재선 표시 컴포넌트
 */

interface ApprovalStep {
  id: string;
  stepNumber: number;
  stepName: string;
  approverName: string;
  approverEmail?: string | null;
  approverTitle?: string | null;
  status: string;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  comment?: string | null;
  isRequired: boolean;
}

interface ApprovalLine {
  id: string;
  currentStep: number;
  totalSteps: number;
  isUrgent: boolean;
  steps: ApprovalStep[];
  createdAt: Date;
  updatedAt: Date;
}

interface ApprovalLineDisplayProps {
  approvalLine: ApprovalLine | null;
  expenseStatus: string;
}

export default function ApprovalLineDisplay({
  approvalLine,
  expenseStatus,
}: ApprovalLineDisplayProps) {
  if (!approvalLine) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <p className="text-gray-500 text-center">
          결재선이 생성되지 않았습니다. 제출 후 결재선이 자동으로 생성됩니다.
        </p>
      </div>
    );
  }

  const getStatusIcon = (status: string, isCurrent: boolean) => {
    if (status === 'APPROVED') {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    } else if (status === 'REJECTED') {
      return <XCircle className="w-6 h-6 text-red-500" />;
    } else if (status === 'PENDING' && isCurrent) {
      return <Clock className="w-6 h-6 text-blue-500 animate-pulse" />;
    } else {
      return <Clock className="w-6 h-6 text-gray-300" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return '승인';
      case 'REJECTED':
        return '반려';
      case 'PENDING':
        return '대기';
      case 'SKIPPED':
        return '건너뜀';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'text-green-600 bg-green-50';
      case 'REJECTED':
        return 'text-red-600 bg-red-50';
      case 'PENDING':
        return 'text-gray-600 bg-gray-50';
      case 'SKIPPED':
        return 'text-gray-400 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">결재선</h3>
        <div className="flex items-center gap-2">
          {approvalLine.isUrgent && (
            <span className="flex items-center gap-1 text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
              <AlertCircle className="w-4 h-4" />
              긴급
            </span>
          )}
          <span className="text-sm text-gray-500">
            {approvalLine.currentStep}/{approvalLine.totalSteps} 단계
          </span>
        </div>
      </div>

      {/* 결재 단계 */}
      <div className="space-y-4">
        {approvalLine.steps.map((step, index) => {
          const isCurrent = step.stepNumber === approvalLine.currentStep;
          const isCompleted = step.status === 'APPROVED';
          const isRejected = step.status === 'REJECTED';

          return (
            <div
              key={step.id}
              className={`relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                isCurrent
                  ? 'border-blue-500 bg-blue-50'
                  : isCompleted
                  ? 'border-green-200 bg-green-50'
                  : isRejected
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/* 연결선 */}
              {index < approvalLine.steps.length - 1 && (
                <div
                  className={`absolute left-7 top-16 w-0.5 h-8 ${
                    isCompleted ? 'bg-green-300' : 'bg-gray-300'
                  }`}
                />
              )}

              {/* 아이콘 */}
              <div className="flex-shrink-0 relative z-10">
                {getStatusIcon(step.status, isCurrent)}
              </div>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {step.stepNumber}차 결재
                      </span>
                      <span className="text-sm text-gray-500">
                        ({step.stepName})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {step.approverName}
                      </span>
                      {step.approverTitle && (
                        <span className="text-sm text-gray-500">
                          {step.approverTitle}
                        </span>
                      )}
                    </div>
                    {step.approverEmail && (
                      <span className="text-sm text-gray-500">
                        {step.approverEmail}
                      </span>
                    )}
                  </div>

                  {/* 상태 배지 */}
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      step.status
                    )}`}
                  >
                    {getStatusText(step.status)}
                  </span>
                </div>

                {/* 결재 일시 및 의견 */}
                {(step.approvedAt || step.rejectedAt || step.comment) && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    {step.approvedAt && (
                      <p className="text-xs text-gray-600">
                        승인: {formatDate(step.approvedAt)}
                      </p>
                    )}
                    {step.rejectedAt && (
                      <p className="text-xs text-red-600">
                        반려: {formatDate(step.rejectedAt)}
                      </p>
                    )}
                    {step.comment && (
                      <p className="text-sm text-gray-700 mt-1 p-2 bg-white rounded border border-gray-200">
                        {step.comment}
                      </p>
                    )}
                  </div>
                )}

                {/* 현재 진행 중 표시 */}
                {isCurrent && !['APPROVED', 'APPROVED_FINAL'].includes(expenseStatus) && expenseStatus !== 'REJECTED' && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                      <Clock className="w-3 h-3" />
                      결재 대기 중
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 최종 상태 메시지 */}
      {['APPROVED', 'APPROVED_FINAL'].includes(expenseStatus) && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800 text-center">
            ✓ 모든 결재가 완료되었습니다
          </p>
        </div>
      )}

      {expenseStatus === 'REJECTED' && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800 text-center">
            ✗ 지출결의서가 반려되었습니다
          </p>
        </div>
      )}
    </div>
  );
}
