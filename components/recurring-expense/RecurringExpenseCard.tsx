'use client';

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { RecurringExpenseStatus } from './RecurringExpenseStatus';
import { formatCurrency } from '@/lib/utils';

interface RecurringExpenseCardProps {
  recurringExpense: {
    id: string;
    name: string;
    committee: string;
    department: string;
    budgetCategory: string;
    budgetSubcategory: string;
    recipientName: string;
    baseAmount: number;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
    dayOfMonth: number;
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
    nextGenerationDate?: Date | string | null;
  };
  onClick?: (id: string) => void;
}

const frequencyLabels: Record<string, string> = {
  MONTHLY: '월간',
  QUARTERLY: '분기',
  SEMI_ANNUAL: '반기',
  ANNUAL: '연간',
};

export function RecurringExpenseCard({ recurringExpense, onClick }: RecurringExpenseCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick(recurringExpense.id);
    } else {
      router.push(`/recurring-expenses/${recurringExpense.id}`);
    }
  };

  const formatNextDate = (date: Date | string | null | undefined): string => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'yyyy-MM-dd');
  };

  const isActive = recurringExpense.status === 'ACTIVE';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
    >
      {/* 상단: 이름 + 상태 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 truncate">{recurringExpense.name}</h3>
        <RecurringExpenseStatus status={recurringExpense.status} />
      </div>

      {/* 위원회 / 사역팀 */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
        <span>{recurringExpense.committee}</span>
        <span className="text-gray-300">|</span>
        <span>{recurringExpense.department}</span>
      </div>

      {/* 예산 정보 */}
      <div className="text-xs text-gray-500 mb-3 truncate">
        {recurringExpense.budgetCategory} &gt; {recurringExpense.budgetSubcategory}
      </div>

      {/* 이체 정보 */}
      <div className="flex items-center justify-between text-sm mb-2">
        <div className="text-gray-600">
          <span className="font-medium">{frequencyLabels[recurringExpense.frequency]}</span>
          <span className="mx-1">·</span>
          <span>매월 {recurringExpense.dayOfMonth}일</span>
        </div>
        <span className="text-gray-700">{recurringExpense.recipientName}</span>
      </div>

      {/* 하단: 금액 + 다음 생성일 */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-lg font-bold text-gray-900">
          {formatCurrency(recurringExpense.baseAmount)}
        </span>
        {isActive && recurringExpense.nextGenerationDate && (
          <span className="text-xs text-gray-500">
            다음 생성: {formatNextDate(recurringExpense.nextGenerationDate)}
          </span>
        )}
      </div>
    </div>
  );
}
