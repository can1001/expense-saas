'use client';

import { useState, useEffect } from 'react';
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  AlertTriangle,
  FileText,
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

interface QuarterlySettlement {
  quarter: number;
  months: number[];
  income: number;
  expense: number;
  balance: number;
  status: 'OPEN' | 'CLOSED';
  closedAt?: string;
  closedBy?: string;
}

interface QuarterlyData {
  year: number;
  quarters: QuarterlySettlement[];
  yearTotal: {
    income: number;
    expense: number;
    balance: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

const QUARTER_MONTHS: Record<number, string> = {
  1: '1월~3월',
  2: '4월~6월',
  3: '7월~9월',
  4: '10월~12월',
};

export default function QuarterlySettlementPage() {
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<QuarterlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ quarter: number; action: 'close' | 'open' } | null>(null);

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/settlement/quarterly?year=${year}`);
      if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettlementAction = async (quarter: number, action: 'close' | 'open') => {
    try {
      const response = await fetch('/api/admin/settlement/quarterly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, quarter, action }),
      });
      if (!response.ok) throw new Error('처리에 실패했습니다.');
      setConfirmModal(null);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

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
          <h1 className="text-2xl font-bold text-gray-900">분기별 결산</h1>
          <p className="text-gray-600 mt-1">분기별 수입/지출을 결산하고 마감합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-500" />
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
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {data && (
        <>
          {/* 연간 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={SECTION_CARD}>
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm">연간 수입</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(data.yearTotal.income)}원</p>
            </div>
            <div className={SECTION_CARD}>
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <TrendingDown className="w-5 h-5" />
                <span className="text-sm">연간 지출</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(data.yearTotal.expense)}원</p>
            </div>
            <div className={SECTION_CARD}>
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <span className="text-sm">연간 차액</span>
              </div>
              <p className={`text-2xl font-bold ${data.yearTotal.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {data.yearTotal.balance >= 0 ? '+' : ''}{formatCurrency(data.yearTotal.balance)}원
              </p>
            </div>
          </div>

          {/* 분기별 현황 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.quarters.map((item) => {
              const isFuture = year === currentYear && item.quarter > currentQuarter;
              const isCurrent = year === currentYear && item.quarter === currentQuarter;

              return (
                <div
                  key={item.quarter}
                  className={`${SECTION_CARD} ${isCurrent ? 'ring-2 ring-blue-500' : ''} ${isFuture ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {item.quarter}분기
                        {isCurrent && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            현재
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500">{QUARTER_MONTHS[item.quarter]}</p>
                    </div>
                    <div>
                      {isFuture ? (
                        <span className="text-gray-400">-</span>
                      ) : item.status === 'CLOSED' ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          <Lock className="w-3 h-3" />
                          마감
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          <Unlock className="w-3 h-3" />
                          진행중
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">수입</span>
                      <span className="font-medium text-green-600">
                        {isFuture ? '-' : formatCurrency(item.income) + '원'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">지출</span>
                      <span className="font-medium text-red-600">
                        {isFuture ? '-' : formatCurrency(item.expense) + '원'}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-gray-700 font-medium">차액</span>
                      <span className={`font-bold ${item.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {isFuture ? '-' : (item.balance >= 0 ? '+' : '') + formatCurrency(item.balance) + '원'}
                      </span>
                    </div>
                  </div>

                  {!isFuture && (
                    <div className="flex gap-2">
                      {item.status === 'CLOSED' ? (
                        <button
                          onClick={() => setConfirmModal({ quarter: item.quarter, action: 'open' })}
                          className={`${BTN_OUTLINE} ${BTN_SM} flex-1 flex items-center justify-center gap-1`}
                        >
                          <Unlock className="w-4 h-4" />
                          마감 해제
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmModal({ quarter: item.quarter, action: 'close' })}
                          className={`${BTN_PRIMARY} ${BTN_SM} flex-1 flex items-center justify-center gap-1`}
                        >
                          <Lock className="w-4 h-4" />
                          결산 마감
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 확인 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <h3 className="text-lg font-semibold">
                {confirmModal.action === 'close' ? '분기 결산 마감 확인' : '마감 해제 확인'}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              {confirmModal.action === 'close'
                ? `${year}년 ${confirmModal.quarter}분기 결산을 마감하시겠습니까? 마감 후에는 해당 분기의 데이터 수정이 제한됩니다.`
                : `${year}년 ${confirmModal.quarter}분기 결산 마감을 해제하시겠습니까?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className={`${BTN_OUTLINE} ${BTN_SM}`}
              >
                취소
              </button>
              <button
                onClick={() => handleSettlementAction(confirmModal.quarter, confirmModal.action)}
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
