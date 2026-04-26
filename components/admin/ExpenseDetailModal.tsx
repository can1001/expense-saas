'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { X, ExternalLink, FileText, Wallet } from 'lucide-react';
import {
  MODAL_OVERLAY,
  MODAL_CONTAINER,
  MODAL_HEADER,
  MODAL_BODY,
  MODAL_FOOTER,
  MODAL_LG,
  BTN_OUTLINE,
  TABLE_BASE,
  TABLE_HEADER,
  TABLE_HEADER_CELL,
  TABLE_BODY,
  TABLE_CELL,
  TABLE_CELL_RIGHT,
  SPINNER_MD,
} from '@/lib/constants/styles';

interface ExpenseItem {
  description: string;
  amount: number;
  budgetDetail: string;
  unitPrice: number;
  quantity: number;
}

interface ExpenseData {
  id: string;
  requestDate: string;
  applicantName: string;
  committee: string;
  department: string;
  paymentStatus: string;
  items: ExpenseItem[];
}

interface DetailModalData {
  expenses: ExpenseData[];
  summary: {
    totalCount: number;
    totalAmount: number;
  };
  filterInfo: {
    year: number;
    quarter: number;
    budgetCategory: string;
    budgetSubcategory: string;
    budgetDetail: string;
    committee: string | null;
    department: string | null;
  };
}

interface SelectedDetailInfo {
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail: string;
  committee?: string;
  department?: string;
}

interface ExpenseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  data: DetailModalData | null;
  detailInfo: SelectedDetailInfo | null;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

function getPaymentStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: '지급대기',
    HOLD: '지급보류',
    CANCELLED: '지급취소',
    COMPLETED: '지급완료',
  };
  return statusMap[status] || status;
}

function getPaymentStatusClass(status: string): string {
  const classMap: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    HOLD: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-green-100 text-green-800',
  };
  return classMap[status] || 'bg-gray-100 text-gray-800';
}

export function ExpenseDetailModal({
  isOpen,
  onClose,
  loading,
  data,
  detailInfo,
}: ExpenseDetailModalProps) {
  // ESC 키로 모달 닫기
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // 배경 클릭 시 모달 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={MODAL_OVERLAY} onClick={handleBackdropClick}>
      <div className={`${MODAL_CONTAINER} ${MODAL_LG} max-h-[85vh] flex flex-col`}>
        {/* 헤더 */}
        <div className={MODAL_HEADER}>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              세목 상세: {detailInfo?.budgetDetail || '-'}
            </h2>
            {detailInfo && (
              <p className="text-sm text-gray-500 mt-1">
                {detailInfo.committee && detailInfo.department
                  ? `${detailInfo.committee} > ${detailInfo.department} > `
                  : ''}
                {detailInfo.budgetCategory} &gt; {detailInfo.budgetSubcategory}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className={`${MODAL_BODY} flex-1 overflow-y-auto`}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={SPINNER_MD} />
              <p className="text-gray-500 mt-4">데이터를 불러오는 중...</p>
            </div>
          ) : !data || data.expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">해당 세목의 지출 내역이 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 요약 카드 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-blue-600 mb-1">총 건수</div>
                  <div className="text-2xl font-bold text-blue-800">
                    {data.summary.totalCount}건
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-green-600 mb-1">합계 금액</div>
                  <div className="text-2xl font-bold text-green-800">
                    {formatAmount(data.summary.totalAmount)}
                  </div>
                </div>
              </div>

              {/* 상세 테이블 */}
              <div className="overflow-x-auto border rounded-lg">
                <table className={TABLE_BASE}>
                  <thead className={TABLE_HEADER}>
                    <tr>
                      <th className={TABLE_HEADER_CELL} style={{ width: '12%' }}>
                        청구일
                      </th>
                      <th className={TABLE_HEADER_CELL} style={{ width: '12%' }}>
                        신청자
                      </th>
                      <th className={TABLE_HEADER_CELL} style={{ width: '18%' }}>
                        부서
                      </th>
                      <th className={TABLE_HEADER_CELL}>적요</th>
                      <th className={TABLE_HEADER_CELL} style={{ width: '14%' }}>
                        금액
                      </th>
                      <th className={TABLE_HEADER_CELL} style={{ width: '10%' }}>
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_BODY}>
                    {data.expenses.map((expense) =>
                      expense.items.map((item, itemIdx) => (
                        <tr
                          key={`${expense.id}-${itemIdx}`}
                          className="hover:bg-gray-50"
                        >
                          <td className={TABLE_CELL}>{expense.requestDate}</td>
                          <td className={TABLE_CELL}>
                            <Link
                              href={`/expenses/${expense.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              onClick={onClose}
                            >
                              {expense.applicantName}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                          <td className={TABLE_CELL}>
                            <div className="text-xs text-gray-500">
                              {expense.committee}
                            </div>
                            <div>{expense.department}</div>
                          </td>
                          <td className={TABLE_CELL}>{item.description}</td>
                          <td className={TABLE_CELL_RIGHT}>
                            {formatAmount(item.amount)}
                          </td>
                          <td className={TABLE_CELL}>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusClass(
                                expense.paymentStatus
                              )}`}
                            >
                              {getPaymentStatusText(expense.paymentStatus)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className={MODAL_FOOTER}>
          <button type="button" onClick={onClose} className={BTN_OUTLINE}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExpenseDetailModal;
