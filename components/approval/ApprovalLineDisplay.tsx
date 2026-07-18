'use client';

import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import StatusPill, { StatusPillVariant } from '@/components/ui/StatusPill';

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
  signatureType?: string | null;
  signatureData?: string | null;
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

const STATUS_PILL_VARIANT: Partial<Record<string, StatusPillVariant>> = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PENDING: 'pending',
};

const STATUS_TEXT: Record<string, string> = {
  APPROVED: '승인',
  REJECTED: '반려',
  PENDING: '대기',
  SKIPPED: '건너뜀',
};

function StepNode({ status, isCurrent }: { status: string; isCurrent: boolean }) {
  if (status === 'APPROVED') {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
        <Check className="h-5 w-5" strokeWidth={3} />
      </div>
    );
  }
  if (status === 'REJECTED') {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-status-rejected text-white">
        <X className="h-5 w-5" strokeWidth={3} />
      </div>
    );
  }
  if (status === 'PENDING') {
    return (
      <div
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-status-pending-bar ring-[3px] ring-status-pending-bar',
          isCurrent && 'animate-pulse'
        )}
      >
        <Clock className="h-5 w-5" />
      </div>
    );
  }
  // SKIPPED 등 기타
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-300 ring-2 ring-gray-200">
      <Clock className="h-5 w-5" />
    </div>
  );
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
          const pillVariant = STATUS_PILL_VARIANT[step.status];

          return (
            <div
              key={step.id}
              className={cn(
                'relative flex items-start gap-4 p-4 rounded-lg border-2 transition-all',
                isCompleted
                  ? 'border-brand-500 bg-brand-50'
                  : isRejected
                  ? 'border-status-rejected bg-status-rejected-bg'
                  : isCurrent
                  ? 'border-status-pending-bar bg-status-pending-bg'
                  : 'border-surface-border bg-white'
              )}
            >
              {/* 연결선 */}
              {index < approvalLine.steps.length - 1 && (
                <div
                  className={cn(
                    'absolute left-9 top-14 h-8 w-0.5',
                    isCompleted ? 'bg-brand-500' : 'bg-surface-border'
                  )}
                />
              )}

              {/* 아이콘 */}
              <div className="relative z-10">
                <StepNode status={step.status} isCurrent={isCurrent} />
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
                  {pillVariant ? (
                    <StatusPill variant={pillVariant}>{STATUS_TEXT[step.status]}</StatusPill>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-gray-400 bg-gray-50">
                      {STATUS_TEXT[step.status] ?? step.status}
                    </span>
                  )}
                </div>

                {/* 서명/도장 표시 */}
                {step.signatureData && step.status === 'APPROVED' && (
                  <div className="mt-2 flex justify-center">
                    <img
                      src={step.signatureData}
                      alt={`${step.approverName} ${step.signatureType === 'stamp' ? '도장' : '서명'}`}
                      className="max-w-[80px] max-h-[40px] object-contain"
                    />
                  </div>
                )}

                {/* 결재 일시 및 의견 */}
                {(step.approvedAt || step.rejectedAt || step.comment) && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    {step.approvedAt && (
                      <p className="text-xs text-gray-600">
                        승인: {formatDate(step.approvedAt)}
                      </p>
                    )}
                    {step.rejectedAt && (
                      <p className="text-xs text-status-rejected">
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
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-status-pending-bar">
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
        <div className="mt-4 p-4 bg-brand-50 border border-brand-500 rounded-lg">
          <p className="text-sm font-medium text-brand-700 text-center">
            ✓ 모든 결재가 완료되었습니다
          </p>
        </div>
      )}

      {expenseStatus === 'REJECTED' && (
        <div className="mt-4 p-4 bg-status-rejected-bg border border-status-rejected rounded-lg">
          <p className="text-sm font-medium text-status-rejected text-center">
            ✗ 지출결의서가 반려되었습니다
          </p>
        </div>
      )}
    </div>
  );
}
