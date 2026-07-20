'use client';

import { useRouter } from 'next/navigation';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import ExpenseStatusPill from './ExpenseStatusPill';

export interface MissingReceiptExpense {
  expenseId: string;
  applicantName: string;
  department: string;
  committee: string;
  requestAmount: number;
  status: string;
  requestDate: string;
}

interface MissingReceiptListProps {
  expenses: MissingReceiptExpense[];
}

export default function MissingReceiptList({ expenses }: MissingReceiptListProps) {
  const router = useRouter();

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">해당 조건의 미첨부 결의서가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {expenses.map((expense) => (
        <div
          key={expense.expenseId}
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/expenses/${expense.expenseId}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') router.push(`/expenses/${expense.expenseId}`);
          }}
          className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {expense.applicantName} · {expense.department}
            </p>
            <p className="text-sm text-gray-500">{formatDateShort(expense.requestDate)}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm text-gray-700">{formatCurrency(expense.requestAmount)}</span>
            <ExpenseStatusPill status={expense.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
