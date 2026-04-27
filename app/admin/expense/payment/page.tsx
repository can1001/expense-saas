'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Banknote,
  Eye,
  CheckCircle,
  PauseCircle,
  XCircle,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  SECTION_CARD,
  BTN_SM,
  BTN_PRIMARY,
  BTN_OUTLINE,
  SELECT_BASE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface PaymentExpense {
  id: string;
  applicantName: string;
  committee: string;
  department: string;
  requestAmount: number;
  paymentStatus: string;
  approvedAt: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

const PAYMENT_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: '지급대기', color: 'bg-yellow-100 text-yellow-700', icon: Banknote },
  HOLD: { label: '지급보류', color: 'bg-orange-100 text-orange-700', icon: PauseCircle },
  CANCELLED: { label: '지급취소', color: 'bg-red-100 text-red-700', icon: XCircle },
  COMPLETED: { label: '지급완료', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

export default function ExpensePaymentPage() {
  const [expenses, setExpenses] = useState<PaymentExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('PENDING');

  useEffect(() => {
    fetchPaymentExpenses();
  }, [filter]);

  const fetchPaymentExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: 'APPROVED_FINAL',
        paymentStatus: filter || '',
      });
      const response = await fetch(`/api/expenses?${params}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const data = await response.json();
      setExpenses(data.expenses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentAction = async (expenseId: string, action: 'complete' | 'hold' | 'cancel') => {
    const actionMap = {
      complete: 'COMPLETED',
      hold: 'HOLD',
      cancel: 'CANCELLED',
    };

    try {
      const response = await fetch(`/api/expenses/${expenseId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: actionMap[action] }),
      });
      if (!response.ok) throw new Error('처리에 실패했습니다.');
      fetchPaymentExpenses();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  const pendingCount = expenses.filter((e) => e.paymentStatus === 'PENDING').length;

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지급 처리</h1>
          <p className="text-gray-600 mt-1">최종 승인된 지출결의서의 지급을 처리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`${SELECT_BASE} w-32`}
          >
            <option value="">전체</option>
            <option value="PENDING">지급대기</option>
            <option value="HOLD">지급보류</option>
            <option value="COMPLETED">지급완료</option>
            <option value="CANCELLED">지급취소</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(PAYMENT_STATUS).map(([status, { label, color, icon: Icon }]) => {
          const count = status === filter
            ? expenses.length
            : expenses.filter((e) => e.paymentStatus === status).length;
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`${SECTION_CARD} text-left hover:shadow-md transition-shadow ${
                filter === status ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-600">{label}</span>
              </div>
              <p className="text-2xl font-bold">{count}건</p>
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      <div className={SECTION_CARD}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {PAYMENT_STATUS[filter]?.label || '전체'} 목록
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 font-medium">신청자</th>
                <th className="pb-3 font-medium">위원회/부서</th>
                <th className="pb-3 font-medium text-right">금액</th>
                <th className="pb-3 font-medium">계좌정보</th>
                <th className="pb-3 font-medium text-center">상태</th>
                <th className="pb-3 font-medium text-center">처리</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const statusInfo = PAYMENT_STATUS[expense.paymentStatus];
                return (
                  <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3">
                      <Link
                        href={`/expenses/${expense.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {expense.applicantName}
                      </Link>
                    </td>
                    <td className="py-3 text-gray-600">
                      {expense.committee} / {expense.department}
                    </td>
                    <td className="py-3 text-right font-medium">
                      {formatCurrency(expense.requestAmount)}원
                    </td>
                    <td className="py-3 text-gray-600 text-sm">
                      <div>{expense.bankName} {expense.accountNumber}</div>
                      <div className="text-gray-400">{expense.accountHolder}</div>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo?.color}`}>
                        {statusInfo?.label}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-center gap-1">
                        {expense.paymentStatus === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handlePaymentAction(expense.id, 'complete')}
                              className={`${BTN_SM} text-green-600 hover:bg-green-50`}
                              title="지급완료"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePaymentAction(expense.id, 'hold')}
                              className={`${BTN_SM} text-orange-600 hover:bg-orange-50`}
                              title="지급보류"
                            >
                              <PauseCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {expense.paymentStatus === 'HOLD' && (
                          <button
                            onClick={() => handlePaymentAction(expense.id, 'complete')}
                            className={`${BTN_SM} text-green-600 hover:bg-green-50`}
                            title="지급완료"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          href={`/expenses/${expense.id}`}
                          className={`${BTN_SM} text-gray-600 hover:bg-gray-100`}
                          title="상세보기"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    해당 조건의 지출결의서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
