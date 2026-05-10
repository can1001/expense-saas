'use client';

import { useState, useRef, useCallback } from 'react';
import { AlertTriangle, Wallet, Info } from 'lucide-react';
import { UsageDetailModal } from './UsageDetailModal';

interface BudgetInfo {
  committee?: string;
  department?: string;
  budgetCategory?: string;
  budgetSubcategory?: string;
  budgetDetailName: string;
  budgetAmount: number;
  usedAmount: number;
  remainingAmount: number;
  requestAmount: number;
  afterApproval: number;
  isOverBudget: boolean;
}

interface BudgetInfoPanelProps {
  budgetInfo: BudgetInfo[];
  year?: number;
  expenseId?: string; // 현재 지출결의서 ID (이중 차감 방지용)
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

export function BudgetInfoPanel({ budgetInfo, year, expenseId }: BudgetInfoPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBudgetDetail, setSelectedBudgetDetail] = useState<string>('');
  const lastTapRef = useRef<number>(0);

  // 기본 연도: props로 전달되지 않으면 현재 연도 사용
  const displayYear = year || new Date().getFullYear();

  const handleUsedAmountDoubleClick = useCallback((budgetDetailName: string) => {
    setSelectedBudgetDetail(budgetDetailName);
    setModalOpen(true);
  }, []);

  // 모바일 더블탭 감지 핸들러
  const handleDoubleTap = useCallback((budgetDetailName: string) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // 300ms 내 두 번 탭 감지
      setSelectedBudgetDetail(budgetDetailName);
      setModalOpen(true);
    }
    lastTapRef.current = now;
  }, []);

  if (!budgetInfo || budgetInfo.length === 0) {
    return null;
  }

  const hasOverBudget = budgetInfo.some((info) => info.isOverBudget);

  return (
    <>
      <div className="mb-4 rounded-lg border bg-white shadow-sm">
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b bg-gray-50 px-4 py-3">
          <Wallet className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">예산 현황</h3>
        </div>

        {/* 예산 초과 경고 */}
        {hasOverBudget && (
          <div className="flex items-center gap-2 border-b bg-red-50 px-4 py-3 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">
              예산을 초과하는 항목이 있습니다. 결재 시 주의해주세요.
            </span>
          </div>
        )}

        {/* 세목별 예산 정보 */}
        <div className="divide-y">
          {budgetInfo.map((info, index) => (
            <div
              key={index}
              className={`px-4 py-3 ${info.isOverBudget ? 'bg-red-50' : ''}`}
            >
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {info.budgetDetailName}
                  </span>
                  {info.isOverBudget && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      예산 초과
                    </span>
                  )}
                </div>
                {(info.committee || info.department || info.budgetCategory || info.budgetSubcategory) && (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {[info.committee, info.department, info.budgetCategory, info.budgetSubcategory]
                      .filter(Boolean)
                      .join(' > ')}
                  </div>
                )}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>배정 예산</span>
                  <span>{formatAmount(info.budgetAmount)}</span>
                </div>
                <div
                  className="group flex cursor-pointer justify-between rounded px-1 -mx-1 text-gray-600 transition-colors hover:bg-blue-50"
                  onDoubleClick={() => handleUsedAmountDoubleClick(info.budgetDetailName)}
                  onTouchEnd={() => handleDoubleTap(info.budgetDetailName)}
                  title="더블클릭하여 사용 내역 보기"
                >
                  <span className="flex items-center gap-1">
                    사용 금액
                    <Info className="h-3 w-3 text-gray-400 group-hover:text-blue-500" />
                  </span>
                  <span className="group-hover:text-blue-600 group-hover:underline">
                    {formatAmount(info.usedAmount)}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-gray-900">
                  <span>잔여 예산</span>
                  <span>{formatAmount(info.remainingAmount)}</span>
                </div>
                <div className="mt-2 border-t pt-2">
                  <div className="flex justify-between text-blue-600">
                    <span>이번 청구</span>
                    <span>-{formatAmount(info.requestAmount)}</span>
                  </div>
                  <div
                    className={`flex justify-between font-semibold ${
                      info.isOverBudget ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    <span>승인 후 잔액</span>
                    <span>{formatAmount(info.afterApproval)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 사용 내역 모달 */}
      <UsageDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        budgetDetailName={selectedBudgetDetail}
        year={displayYear}
        excludeExpenseId={expenseId}
      />
    </>
  );
}
