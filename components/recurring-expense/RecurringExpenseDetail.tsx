'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { RecurringExpenseStatus } from './RecurringExpenseStatus';
import { formatCurrency } from '@/lib/utils';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_DANGER,
  SPINNER,
} from '@/lib/constants/styles';
import { Edit, Pause, Play, Trash2, ArrowLeft, Zap } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { GeneratedExpenseList } from './GeneratedExpenseList';
import { useOrgTerms } from '@/lib/contexts/TenantContext';

interface RecurringExpenseDetailProps {
  recurringExpense: {
    id: string;
    name: string;
    description?: string | null;
    committee: string;
    department: string;
    budgetCategory: string;
    budgetSubcategory: string;
    budgetDetail?: string | null;
    recipientName: string;
    bankName: string;
    accountNumber: string;
    baseAmount: number;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
    dayOfMonth: number;
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
    startDate: Date | string;
    endDate?: Date | string | null;
    advanceDays: number;
    nextGenerationDate?: Date | string | null;
    lastGeneratedDate?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    generatedExpenses?: Array<{
      id: string;
      requestAmount: number;
      status: string;
      createdAt: Date | string;
    }>;
  };
  onStatusChange?: (newStatus: 'ACTIVE' | 'PAUSED' | 'CANCELLED') => Promise<void>;
  onGenerateNow?: () => Promise<void>;
}

const frequencyLabels: Record<string, string> = {
  MONTHLY: '월간',
  QUARTERLY: '분기 (3개월)',
  SEMI_ANNUAL: '반기 (6개월)',
  ANNUAL: '연간',
};

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd');
}

/**
 * 계좌번호 마스킹 (앞 4자리와 뒤 4자리만 표시)
 */
function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.replace(/[^0-9]/g, '');
  if (cleaned.length <= 8) return accountNumber; // 너무 짧으면 그대로 반환
  const front = cleaned.slice(0, 4);
  const back = cleaned.slice(-4);
  const middleLength = cleaned.length - 8;
  return `${front}-${'*'.repeat(middleLength)}-${back}`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 font-medium text-right">{value}</span>
    </div>
  );
}

export function RecurringExpenseDetail({ recurringExpense, onStatusChange, onGenerateNow }: RecurringExpenseDetailProps) {
  const terms = useOrgTerms();
  const router = useRouter();
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const canChangeStatus = ['ACTIVE', 'PAUSED'].includes(recurringExpense.status);
  const canCancel = recurringExpense.status !== 'CANCELLED' && recurringExpense.status !== 'COMPLETED';
  const canGenerateNow = recurringExpense.status === 'ACTIVE' && !!onGenerateNow;

  const handleStatusChange = async (newStatus: 'ACTIVE' | 'PAUSED' | 'CANCELLED') => {
    if (!onStatusChange) return;

    setIsChangingStatus(true);
    try {
      await onStatusChange(newStatus);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleGenerateNow = async () => {
    if (!onGenerateNow) return;

    setIsGenerating(true);
    try {
      await onGenerateNow();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancel = async () => {
    if (!onStatusChange) return;

    setIsCancelling(true);
    try {
      await onStatusChange('CANCELLED');
      setIsCancelDialogOpen(false);
      router.push('/recurring-expenses');
    } catch {
      // 에러는 부모 컴포넌트에서 처리
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{recurringExpense.name}</h1>
              <RecurringExpenseStatus status={recurringExpense.status} />
            </div>
            {recurringExpense.description && (
              <p className="text-gray-600 mt-1">{recurringExpense.description}</p>
            )}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          {canGenerateNow && (
            <button
              onClick={handleGenerateNow}
              disabled={isGenerating || isChangingStatus}
              className={`${BTN_OUTLINE} text-blue-600 border-blue-300 hover:bg-blue-50`}
              title="다음 생성 예정일을 기다리지 않고 지출결의서를 즉시 생성합니다"
            >
              {isGenerating ? (
                <div className={SPINNER}></div>
              ) : (
                <Zap className="w-4 h-4" />
              )}
              지금 생성
            </button>
          )}

          <button
            onClick={() => router.push(`/recurring-expenses/${recurringExpense.id}/edit`)}
            className={BTN_OUTLINE}
          >
            <Edit className="w-4 h-4" />
            수정
          </button>

          {canChangeStatus && (
            <>
              {recurringExpense.status === 'ACTIVE' && (
                <button
                  onClick={() => handleStatusChange('PAUSED')}
                  disabled={isChangingStatus}
                  className={`${BTN_OUTLINE} text-yellow-600 border-yellow-300 hover:bg-yellow-50`}
                >
                  {isChangingStatus ? (
                    <div className={SPINNER}></div>
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                  일시정지
                </button>
              )}

              {recurringExpense.status === 'PAUSED' && (
                <button
                  onClick={() => handleStatusChange('ACTIVE')}
                  disabled={isChangingStatus}
                  className={`${BTN_OUTLINE} text-green-600 border-green-300 hover:bg-green-50`}
                >
                  {isChangingStatus ? (
                    <div className={SPINNER}></div>
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  재개
                </button>
              )}
            </>
          )}

          {canCancel && (
            <button
              onClick={() => setIsCancelDialogOpen(true)}
              disabled={isChangingStatus}
              className={BTN_DANGER}
            >
              <Trash2 className="w-4 h-4" />
              취소
            </button>
          )}
        </div>
      </div>

      {/* 취소 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={isCancelDialogOpen}
        onClose={() => setIsCancelDialogOpen(false)}
        onConfirm={handleCancel}
        title="자동이체 취소"
        message="이 자동이체를 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="취소하기"
        cancelText="돌아가기"
        variant="danger"
        isLoading={isCancelling}
      />

      {/* 기본 정보 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>기본 정보</h2>
        <div className="space-y-1">
          <InfoRow label={terms.committee} value={recurringExpense.committee} />
          <InfoRow label={terms.departmentSlash} value={recurringExpense.department} />
          <InfoRow label="예산(항)" value={recurringExpense.budgetCategory} />
          <InfoRow label="예산(목)" value={recurringExpense.budgetSubcategory} />
          {recurringExpense.budgetDetail && (
            <InfoRow label="예산(세목)" value={recurringExpense.budgetDetail} />
          )}
        </div>
      </div>

      {/* 수취인 정보 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>수취인 정보</h2>
        <div className="space-y-1">
          <InfoRow label="수취인명" value={recurringExpense.recipientName} />
          <InfoRow label="은행명" value={recurringExpense.bankName} />
          <InfoRow label="계좌번호" value={maskAccountNumber(recurringExpense.accountNumber)} />
        </div>
      </div>

      {/* 이체 정보 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>이체 정보</h2>
        <div className="space-y-1">
          <InfoRow
            label="기본 금액"
            value={
              <span className="text-lg font-bold text-blue-600">
                {formatCurrency(recurringExpense.baseAmount)}
              </span>
            }
          />
          <InfoRow label="이체 주기" value={frequencyLabels[recurringExpense.frequency]} />
          <InfoRow label="이체일" value={`매월 ${recurringExpense.dayOfMonth}일`} />
          <InfoRow label="사전 생성" value={`이체일 ${recurringExpense.advanceDays}일 전`} />
        </div>
      </div>

      {/* 기간 정보 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>기간 정보</h2>
        <div className="space-y-1">
          <InfoRow label="시작일" value={formatDate(recurringExpense.startDate)} />
          <InfoRow
            label="종료일"
            value={recurringExpense.endDate ? formatDate(recurringExpense.endDate) : '무기한'}
          />
          {recurringExpense.status === 'ACTIVE' && recurringExpense.nextGenerationDate && (
            <InfoRow
              label="다음 생성 예정일"
              value={
                <span className="text-green-600 font-medium">
                  {formatDate(recurringExpense.nextGenerationDate)}
                </span>
              }
            />
          )}
          {recurringExpense.lastGeneratedDate && (
            <InfoRow
              label="마지막 생성일"
              value={formatDate(recurringExpense.lastGeneratedDate)}
            />
          )}
        </div>
      </div>

      {/* 메타 정보 */}
      {(recurringExpense.createdAt || recurringExpense.updatedAt) && (
        <div className="text-xs text-gray-400 text-right space-x-4">
          {recurringExpense.createdAt && (
            <span>생성: {formatDate(recurringExpense.createdAt)}</span>
          )}
          {recurringExpense.updatedAt && (
            <span>수정: {formatDate(recurringExpense.updatedAt)}</span>
          )}
        </div>
      )}

      {/* 생성 이력 */}
      {recurringExpense.generatedExpenses && (
        <GeneratedExpenseList expenses={recurringExpense.generatedExpenses} />
      )}
    </div>
  );
}
