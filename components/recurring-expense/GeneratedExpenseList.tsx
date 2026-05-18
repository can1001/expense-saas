'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { SECTION_CARD, SECTION_TITLE } from '@/lib/constants/styles';
import { FileText, ExternalLink } from 'lucide-react';

interface GeneratedExpense {
  id: string;
  requestAmount: number;
  status: string;
  createdAt: Date | string;
  accountHolder?: string;
}

interface GeneratedExpenseListProps {
  expenses: GeneratedExpense[];
}

const statusLabels: Record<string, { label: string; className: string }> = {
  DRAFT: { label: '임시저장', className: 'bg-gray-100 text-gray-700' },
  PENDING: { label: '결재대기', className: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: '승인', className: 'bg-green-100 text-green-700' },
  REJECTED: { label: '반려', className: 'bg-red-100 text-red-700' },
  FINAL_APPROVED: { label: '최종승인', className: 'bg-blue-100 text-blue-700' },
  PAYMENT_PENDING: { label: '지급대기', className: 'bg-purple-100 text-purple-700' },
  PAID: { label: '지급완료', className: 'bg-green-100 text-green-700' },
};

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd');
}

function StatusBadge({ status }: { status: string }) {
  const config = statusLabels[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}

export function GeneratedExpenseList({ expenses }: GeneratedExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <div className={SECTION_CARD}>
        <h2 className={SECTION_TITLE}>생성 이력</h2>
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>생성된 지출결의서가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={SECTION_CARD}>
      <h2 className={SECTION_TITLE}>생성 이력</h2>
      <div className="space-y-2">
        {expenses.map((expense) => (
          <Link
            key={expense.id}
            href={`/expenses/${expense.id}`}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                <FileText className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(expense.requestAmount)}
                  </span>
                  <StatusBadge status={expense.status} />
                </div>
                <span className="text-xs text-gray-500">
                  {formatDate(expense.createdAt)}
                </span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
      {expenses.length >= 5 && (
        <p className="text-xs text-gray-400 text-center mt-3">
          최근 {expenses.length}건
        </p>
      )}
    </div>
  );
}
