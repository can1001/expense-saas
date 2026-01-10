'use client';

import { AlertTriangle, Wallet } from 'lucide-react';

interface BudgetInfo {
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
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

export function BudgetInfoPanel({ budgetInfo }: BudgetInfoPanelProps) {
  if (!budgetInfo || budgetInfo.length === 0) {
    return null;
  }

  const hasOverBudget = budgetInfo.some((info) => info.isOverBudget);

  return (
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
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-gray-900">
                {info.budgetDetailName}
              </span>
              {info.isOverBudget && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  예산 초과
                </span>
              )}
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>배정 예산</span>
                <span>{formatAmount(info.budgetAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>사용 금액</span>
                <span>{formatAmount(info.usedAmount)}</span>
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
  );
}
