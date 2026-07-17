'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, User, AlertCircle, AlertTriangle, Wallet } from 'lucide-react';
import { SECTION_CARD, SECTION_TITLE, SPINNER } from '@/lib/constants/styles';
import { apiBase, readApiError } from '@/lib/api/api-base';

interface ApprovalStep {
  stepNumber: number;
  stepName: string;
  role: string;
  approverId: string;
  approverName: string;
  isAutoApproved: boolean;
}

interface BudgetInfo {
  budgetAmount: number;
  usedAmount: number;
  remainingAmount: number;
  isOverBudget: boolean;
}

interface ApprovalLineInfo {
  budgetDetailId?: string;
  budgetDetailName?: string;
  managerId: string | null;
  managerName: string | null;
  isDirectApproval: boolean;
  totalSteps: number;
  steps: ApprovalStep[];
  year: number;
  budget?: BudgetInfo;
}

interface ApprovalLinePreviewProps {
  budgetCategory?: string;
  budgetSubcategory?: string;
  budgetDetail?: string;
  requestDate?: string;
  requestAmount?: number; // 청구 금액
}

// 금액 포맷팅
function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

export default function ApprovalLinePreview({
  budgetCategory,
  budgetSubcategory,
  budgetDetail,
  requestDate,
  requestAmount = 0,
}: ApprovalLinePreviewProps) {
  const [approvalLine, setApprovalLine] = useState<ApprovalLineInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 필수 데이터가 있을 때만 조회
  const canFetch = budgetCategory && budgetSubcategory && budgetDetail;

  useEffect(() => {
    if (!canFetch) {
      setApprovalLine(null);
      setError(null);
      return;
    }

    const fetchApprovalLine = async () => {
      try {
        setLoading(true);
        setError(null);

        const _year = requestDate
          ? new Date(requestDate).getFullYear()
          : new Date().getFullYear();

        const response = await fetch(`${apiBase('approvals')}/approval-line/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            budgetCategory,
            budgetSubcategory,
            items: [{ budgetDetail }],
            requestDate,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(readApiError(response, data));
        }

        const data: ApprovalLineInfo = await response.json();
        setApprovalLine(data);
      } catch (err) {
        console.error('결재선 조회 오류:', err);
        setError(err instanceof Error ? err.message : '결재선 조회 실패');
        setApprovalLine(null);
      } finally {
        setLoading(false);
      }
    };

    // 디바운스: 300ms 후 조회
    const timer = setTimeout(fetchApprovalLine, 300);
    return () => clearTimeout(timer);
  }, [budgetCategory, budgetSubcategory, budgetDetail, requestDate, canFetch]);

  // 데이터가 없으면 표시하지 않음
  if (!canFetch) {
    return null;
  }

  // 예산 초과 체크
  const budget = approvalLine?.budget;
  const willExceedBudget = budget && requestAmount > 0 && requestAmount > budget.remainingAmount;
  const afterRequestRemaining = budget ? budget.remainingAmount - requestAmount : 0;

  return (
    <div className={SECTION_CARD}>
      <h2 className={SECTION_TITLE}>결재선 미리보기</h2>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 py-4">
          <div className={SPINNER}></div>
          <span>결재선 조회 중...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-amber-600 py-4">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && approvalLine && (
        <div className="space-y-4">
          {/* 예산 초과 경고 */}
          {willExceedBudget && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-700">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-5 h-5" />
                <span>예산 초과 경고</span>
              </div>
              <p className="mt-1">
                청구 금액({formatAmount(requestAmount)}원)이 잔여 예산({formatAmount(budget?.remainingAmount || 0)}원)을 초과합니다.
              </p>
            </div>
          )}

          {/* 예산 현황 */}
          {budget && budget.budgetAmount > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Wallet className="w-4 h-4" />
                <span>예산 현황</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">배정 예산</div>
                  <div className="font-medium">{formatAmount(budget.budgetAmount)}원</div>
                </div>
                <div>
                  <div className="text-gray-500">사용 금액</div>
                  <div className="font-medium">{formatAmount(budget.usedAmount)}원</div>
                </div>
                <div>
                  <div className="text-gray-500">잔여 예산</div>
                  <div className={`font-medium ${budget.remainingAmount < 0 ? 'text-red-600' : willExceedBudget ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatAmount(budget.remainingAmount)}원
                  </div>
                </div>
              </div>
              {requestAmount > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 text-sm">
                  <span className="text-gray-500">청구 후 잔액: </span>
                  <span className={`font-medium ${afterRequestRemaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatAmount(afterRequestRemaining)}원
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 전결 안내 */}
          {approvalLine.isDirectApproval && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <span className="font-medium">전결 적용:</span> 담당자가 재정팀장이므로 1차 결재가 자동 승인됩니다.
            </div>
          )}

          {/* 결재 단계 */}
          <div className="flex items-center gap-2 flex-wrap">
            {approvalLine.steps.map((step, index) => (
              <div key={step.stepNumber} className="flex items-center">
                {/* 결재자 카드 */}
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                    step.isAutoApproved
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.isAutoApproved ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  >
                    {step.isAutoApproved ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">{step.stepNumber}차 · {step.stepName}</div>
                    <div className="font-medium text-gray-900">{step.approverName}</div>
                  </div>
                  {step.isAutoApproved && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      자동승인
                    </span>
                  )}
                </div>

                {/* 화살표 (마지막 제외) */}
                {index < approvalLine.steps.length - 1 && (
                  <div className="mx-2 text-gray-400">→</div>
                )}
              </div>
            ))}
          </div>

          {/* 담당자 정보 */}
          <div className="text-sm text-gray-600 mt-2">
            <span className="font-medium">세목 담당자:</span>{' '}
            {approvalLine.managerName || '미지정 (재정팀장이 대신 결재)'}
          </div>
        </div>
      )}
    </div>
  );
}
