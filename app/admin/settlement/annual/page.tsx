'use client';

import { useState, useEffect } from 'react';
import {
  CalendarRange,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  AlertTriangle,
  FileBarChart,
  Download,
} from 'lucide-react';
import {
  SECTION_CARD,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_SM,
  SELECT_BASE,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface AnnualSettlement {
  year: number;
  income: number;
  expense: number;
  balance: number;
  previousBalance: number;
  currentBalance: number;
  status: 'OPEN' | 'CLOSED';
  closedAt?: string;
  closedBy?: string;
  quarterStatus: Array<{
    quarter: number;
    status: 'OPEN' | 'CLOSED';
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

export default function AnnualSettlementPage() {
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<AnnualSettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ action: 'close' | 'open' } | null>(null);

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/settlement/annual?year=${year}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettlementAction = async (action: 'close' | 'open') => {
    try {
      const response = await fetch('/api/admin/settlement/annual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, action }),
      });
      if (!response.ok) throw new Error('처리에 실패했습니다.');
      setConfirmModal(null);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const allQuartersClosed = data?.quarterStatus.every((q) => q.status === 'CLOSED') || false;
  const canCloseYear = allQuartersClosed && data?.status === 'OPEN';

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
          <h1 className="text-2xl font-bold text-gray-900">연간 결산</h1>
          <p className="text-gray-600 mt-1">연간 결산을 확정하고 차기연도 예산 편성을 준비합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-gray-500" />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={`${SELECT_BASE} w-24`}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          <button className={`${BTN_OUTLINE} ${BTN_SM} flex items-center gap-2`}>
            <Download className="w-4 h-4" />
            결산 보고서
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {data && (
        <>
          {/* 연간 결산 상태 */}
          <div className={`${SECTION_CARD} ${data.status === 'CLOSED' ? 'border-green-500 border-2' : ''}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FileBarChart className="w-6 h-6 text-gray-600" />
                <h2 className="text-xl font-bold">{year}년 연간 결산</h2>
              </div>
              {data.status === 'CLOSED' ? (
                <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg">
                  <Lock className="w-4 h-4" />
                  결산 확정
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg">
                  <Unlock className="w-4 h-4" />
                  진행 중
                </span>
              )}
            </div>

            {/* 분기별 마감 현황 */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">분기별 마감 현황</h3>
              <div className="flex gap-2">
                {data.quarterStatus.map((q) => (
                  <div
                    key={q.quarter}
                    className={`flex-1 text-center py-2 px-3 rounded ${
                      q.status === 'CLOSED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <div className="text-xs">Q{q.quarter}</div>
                    <div className="text-sm font-medium">
                      {q.status === 'CLOSED' ? '마감' : '진행중'}
                    </div>
                  </div>
                ))}
              </div>
              {!allQuartersClosed && data.status === 'OPEN' && (
                <p className="text-sm text-yellow-600 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  모든 분기가 마감되어야 연간 결산을 확정할 수 있습니다.
                </p>
              )}
            </div>

            {/* 수지 현황 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">전기이월</p>
                <p className="text-lg font-bold">{formatCurrency(data.previousBalance)}원</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-600">수입</p>
                </div>
                <p className="text-lg font-bold text-green-700">{formatCurrency(data.income)}원</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-600">지출</p>
                </div>
                <p className="text-lg font-bold text-red-700">{formatCurrency(data.expense)}원</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 mb-1">당기차액</p>
                <p className={`text-lg font-bold ${data.balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {data.balance >= 0 ? '+' : ''}{formatCurrency(data.balance)}원
                </p>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-600 mb-1">차기이월</p>
                <p className="text-lg font-bold text-indigo-700">{formatCurrency(data.currentBalance)}원</p>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex justify-center gap-3">
              {data.status === 'CLOSED' ? (
                <button
                  onClick={() => setConfirmModal({ action: 'open' })}
                  className={`${BTN_OUTLINE} flex items-center gap-2`}
                >
                  <Unlock className="w-4 h-4" />
                  결산 확정 해제
                </button>
              ) : (
                <button
                  onClick={() => setConfirmModal({ action: 'close' })}
                  disabled={!canCloseYear}
                  className={`${BTN_PRIMARY} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Lock className="w-4 h-4" />
                  연간 결산 확정
                </button>
              )}
            </div>
          </div>

          {/* 안내 */}
          {data.status === 'CLOSED' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800 mb-2">결산이 확정되었습니다</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• {year}년 결산 데이터는 수정할 수 없습니다.</li>
                <li>• 차기이월금 {formatCurrency(data.currentBalance)}원이 {year + 1}년 전기이월로 적용됩니다.</li>
                <li>• {year + 1}년 예산 편성을 진행할 수 있습니다.</li>
              </ul>
            </div>
          )}
        </>
      )}

      {/* 확인 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <h3 className="text-lg font-semibold">
                {confirmModal.action === 'close' ? '연간 결산 확정' : '결산 확정 해제'}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              {confirmModal.action === 'close'
                ? `${year}년 연간 결산을 확정하시겠습니까? 확정 후에는 해당 연도의 모든 데이터 수정이 제한됩니다.`
                : `${year}년 연간 결산 확정을 해제하시겠습니까? 결산 데이터 수정이 가능해집니다.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className={`${BTN_OUTLINE} ${BTN_SM}`}
              >
                취소
              </button>
              <button
                onClick={() => handleSettlementAction(confirmModal.action)}
                className={`${BTN_PRIMARY} ${BTN_SM}`}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
