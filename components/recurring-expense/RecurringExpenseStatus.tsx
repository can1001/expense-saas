/**
 * 자동이체 상태 배지 컴포넌트
 */

interface RecurringExpenseStatusProps {
  status?: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: '활성' },
  PAUSED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '일시정지' },
  COMPLETED: { bg: 'bg-gray-100', text: 'text-gray-600', label: '완료' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: '취소' },
};

const defaultConfig = { bg: 'bg-gray-100', text: 'text-gray-500', label: '-' };

export function RecurringExpenseStatus({ status }: RecurringExpenseStatusProps) {
  const { bg, text, label } = (status && statusConfig[status]) || defaultConfig;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}
