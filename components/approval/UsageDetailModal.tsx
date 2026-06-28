'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import { ExternalLink, Receipt, Loader2 } from 'lucide-react';

interface UsageDetailItem {
  id: string;
  expenseId: string;
  requestDate: string;
  applicantName: string;
  description: string;
  amount: number;
  status: string;
}

interface UsageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetailName: string;
  year: number;
  excludeExpenseId?: string; // 현재 지출결의서 ID (이중 차감 방지용)
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-');
  return `${year}.${month}.${day}`;
}

function getStatusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case 'APPROVED_STEP_1':
      return { label: '1차 승인', className: 'bg-yellow-100 text-yellow-800' };
    case 'APPROVED_STEP_2':
      return { label: '2차 승인', className: 'bg-blue-100 text-blue-800' };
    case 'APPROVED_FINAL':
      return { label: '최종 승인', className: 'bg-green-100 text-green-800' };
    default:
      return { label: status, className: 'bg-gray-100 text-gray-800' };
  }
}

export function UsageDetailModal({
  isOpen,
  onClose,
  budgetCategory,
  budgetSubcategory,
  budgetDetailName,
  year,
  excludeExpenseId,
}: UsageDetailModalProps) {
  const [items, setItems] = useState<UsageDetailItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        budgetCategory,
        budgetSubcategory,
        budgetDetail: budgetDetailName,
        year: year.toString(),
      });

      // 현재 지출결의서 제외 (이중 차감 방지)
      if (excludeExpenseId) {
        params.set('excludeExpenseId', excludeExpenseId);
      }

      const response = await fetch(`/api/budget/usage-details?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '데이터를 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setItems(data.items);
      setTotalAmount(data.totalAmount);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && budgetDetailName && budgetCategory && budgetSubcategory) {
      fetchUsageDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, budgetCategory, budgetSubcategory, budgetDetailName, year, excludeExpenseId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${budgetDetailName} - 사용 내역`}
      size="lg"
    >
      <div className="min-h-[200px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Receipt className="mb-2 h-12 w-12" />
            <p>사용 내역이 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 데스크톱 테이블 */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      청구일자
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      청구인
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      적요
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      금액
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      상태
                    </th>
                    <th className="w-10 px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map((item) => {
                    const statusInfo = getStatusLabel(item.status);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900">
                          {formatDate(item.requestDate)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900">
                          {item.applicantName}
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-3 text-sm text-gray-600">
                          {item.description}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-medium text-gray-900">
                          {formatAmount(item.amount)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/expenses/${item.expenseId}`}
                            className="text-blue-600 hover:text-blue-800"
                            title="상세보기"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <div className="space-y-3 md:hidden">
              {items.map((item) => {
                const statusInfo = getStatusLabel(item.status);
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {formatDate(item.requestDate)}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {item.applicantName}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {formatAmount(item.amount)}
                      </span>
                    </div>
                    <p className="mb-2 truncate text-sm text-gray-600">
                      {item.description}
                    </p>
                    <Link
                      href={`/expenses/${item.expenseId}`}
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      상세보기
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                );
              })}
            </div>

            {/* 합계 */}
            <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
              <span className="text-sm font-medium text-gray-700">
                총 {items.length}건
              </span>
              <span className="text-lg font-bold text-gray-900">
                합계: {formatAmount(totalAmount)}
              </span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
