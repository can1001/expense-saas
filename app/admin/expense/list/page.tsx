'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Calendar,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  SECTION_CARD,
  BTN_OUTLINE,
  BTN_SM,
  INPUT_BASE,
  SELECT_BASE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface Expense {
  id: string;
  applicantName: string;
  committee: string;
  department: string;
  requestAmount: number;
  status: string;
  paymentStatus: string;
  requestDate: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '임시저장', color: 'bg-gray-100 text-gray-700' },
  PENDING: { label: '결재대기', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED_STEP_1: { label: '1차승인', color: 'bg-blue-100 text-blue-700' },
  APPROVED_STEP_2: { label: '2차승인', color: 'bg-indigo-100 text-indigo-700' },
  APPROVED_FINAL: { label: '최종승인', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: '반려', color: 'bg-red-100 text-red-700' },
  WITHDRAWN: { label: '회수', color: 'bg-gray-100 text-gray-600' },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '지급대기', color: 'bg-yellow-50 text-yellow-700' },
  HOLD: { label: '지급보류', color: 'bg-orange-50 text-orange-700' },
  CANCELLED: { label: '지급취소', color: 'bg-red-50 text-red-700' },
  COMPLETED: { label: '지급완료', color: 'bg-green-50 text-green-700' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

export default function ExpenseListPage() {
  const currentYear = new Date().getFullYear();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(currentYear);
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchExpenses();
  }, [year, status, page]);

  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(year),
        page: String(page),
        pageSize: String(pageSize),
      });
      if (status) params.append('status', status);
      if (search) params.append('search', search);

      const response = await fetch(`/api/expenses?${params}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const data = await response.json();
      setExpenses(data.expenses || []);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchExpenses();
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">지출결의서 목록</h1>
        <p className="text-gray-600 mt-1">전체 지출결의서를 조회하고 관리합니다.</p>
      </div>

      {/* 필터 */}
      <div className={SECTION_CARD}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}
              className={`${SELECT_BASE} w-24`}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className={`${SELECT_BASE} w-28`}
            >
              <option value="">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="신청자, 위원회, 부서 검색"
              className={`${INPUT_BASE} flex-1`}
            />
            <button onClick={handleSearch} className={`${BTN_OUTLINE} ${BTN_SM}`}>
              검색
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className={`${FLEX_CENTER} py-20`}>
          <div className={SPINNER_LG}></div>
        </div>
      ) : (
        <div className={SECTION_CARD}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">신청자</th>
                  <th className="pb-3 font-medium">위원회</th>
                  <th className="pb-3 font-medium">부서</th>
                  <th className="pb-3 font-medium text-right">금액</th>
                  <th className="pb-3 font-medium text-center">결재상태</th>
                  <th className="pb-3 font-medium text-center">지급상태</th>
                  <th className="pb-3 font-medium">신청일</th>
                  <th className="pb-3 font-medium text-center">상세</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => {
                  const statusInfo = STATUS_LABELS[expense.status] || { label: expense.status, color: 'bg-gray-100' };
                  const paymentInfo = expense.status === 'APPROVED_FINAL'
                    ? PAYMENT_STATUS_LABELS[expense.paymentStatus] || { label: '-', color: '' }
                    : { label: '-', color: '' };

                  return (
                    <tr key={expense.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-medium">{expense.applicantName}</td>
                      <td className="py-3 text-gray-600">{expense.committee || '-'}</td>
                      <td className="py-3 text-gray-600">{expense.department || '-'}</td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(expense.requestAmount)}원
                      </td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        {paymentInfo.label !== '-' ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${paymentInfo.color}`}>
                            {paymentInfo.label}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(expense.requestDate).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="py-3 text-center">
                        <Link
                          href={`/expenses/${expense.id}`}
                          className={`${BTN_SM} text-blue-600 hover:bg-blue-50 inline-flex items-center gap-1`}
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      해당 조건의 지출결의서가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`${BTN_SM} ${BTN_OUTLINE} disabled:opacity-50`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`${BTN_SM} ${BTN_OUTLINE} disabled:opacity-50`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
