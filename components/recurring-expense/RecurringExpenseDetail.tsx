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
import { Edit, Pause, Play, XCircle, ArrowLeft } from 'lucide-react';

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
  };
  onStatusChange?: (newStatus: 'ACTIVE' | 'PAUSED' | 'CANCELLED') => Promise<void>;
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 font-medium text-right">{value}</span>
    </div>
  );
}

export function RecurringExpenseDetail({ recurringExpense, onStatusChange }: RecurringExpenseDetailProps) {
  const router = useRouter();
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const canChangeStatus = ['ACTIVE', 'PAUSED'].includes(recurringExpense.status);

  const handleStatusChange = async (newStatus: 'ACTIVE' | 'PAUSED' | 'CANCELLED') => {
    if (!onStatusChange) return;

    setIsChangingStatus(true);
    try {
      await onStatusChange(newStatus);
    } finally {
      setIsChangingStatus(false);
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
        </div>
      </div>

      {/* 기본 정보 */}
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>기본 정보</h2>
        <div className="space-y-1">
          <InfoRow label="위원회" value={recurringExpense.committee} />
          <InfoRow label="사역팀/부" value={recurringExpense.department} />
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
          <InfoRow label="계좌번호" value={recurringExpense.accountNumber} />
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
    </div>
  );
}
