'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  SECTION_CARD,
  BTN_SM,
  BTN_PRIMARY,
  BTN_OUTLINE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface PendingExpense {
  id: string;
  applicantName: string;
  committee: string;
  department: string;
  requestAmount: number;
  status: string;
  requestDate: string;
  createdAt: string;
  currentStep: number;
  totalSteps: number;
  isUrgent: boolean;
}

const STATUS_LABELS: Record<string, { label: string; step: string }> = {
  PENDING: { label: '1차 결재 대기', step: '팀장 결재' },
  APPROVED_STEP_1: { label: '2차 결재 대기', step: '회계 결재' },
  APPROVED_STEP_2: { label: '3차 결재 대기', step: '재정팀장 결재' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return `${Math.floor(diffDays / 30)}개월 전`;
}

export default function ExpensePendingPage() {
  const [expenses, setExpenses] = useState<PendingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingExpenses();
  }, []);

  const fetchPendingExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/approvals/pending');
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const data = await response.json();
      setExpenses(data.expenses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const urgentExpenses = expenses.filter((e) => e.isUrgent);
  const normalExpenses = expenses.filter((e) => !e.isUrgent);

  if (loading) {
    return (
      <div className={`${FLEX_CENTER} py-20`}>
        <div className={SPINNER_LG}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">결재 대기</h1>
          <p className="text-gray-600 mt-1">결재 대기 중인 지출결의서 목록입니다.</p>
        </div>
        <Link href="/approvals" className={`${BTN_PRIMARY} flex items-center gap-2`}>
          <Clock className="w-4 h-4" />
          결재함 바로가기
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {/* 긴급 결재 */}
      {urgentExpenses.length > 0 && (
        <div className={`${SECTION_CARD} border-l-4 border-red-500`}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">긴급 결재</h2>
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
              {urgentExpenses.length}건
            </span>
          </div>
          <div className="space-y-3">
            {urgentExpenses.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} />
            ))}
          </div>
        </div>
      )}

      {/* 일반 결재 */}
      <div className={SECTION_CARD}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-gray-900">결재 대기 목록</h2>
          <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
            {normalExpenses.length}건
          </span>
        </div>
        {normalExpenses.length > 0 ? (
          <div className="space-y-3">
            {normalExpenses.map((expense) => (
              <ExpenseCard key={expense.id} expense={expense} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            결재 대기 중인 지출결의서가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseCard({ expense }: { expense: PendingExpense }) {
  const statusInfo = STATUS_LABELS[expense.status] || { label: expense.status, step: '' };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-900">{expense.applicantName}</span>
          <span className="text-sm text-gray-500">
            {expense.committee} / {expense.department}
          </span>
          {expense.isUrgent && (
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">긴급</span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
          <span className="font-medium text-gray-900">
            {formatCurrency(expense.requestAmount)}원
          </span>
          <span>{statusInfo.step}</span>
          <span>{getRelativeTime(expense.createdAt)}</span>
        </div>
      </div>
      <Link
        href={`/expenses/${expense.id}`}
        className={`${BTN_SM} ${BTN_OUTLINE} flex items-center gap-1`}
      >
        <Eye className="w-4 h-4" />
        상세
      </Link>
    </div>
  );
}
