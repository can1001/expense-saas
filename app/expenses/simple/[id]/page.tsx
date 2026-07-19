'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import ImagePreview from '@/components/ImagePreview';
import GlobalShell from '@/components/layout/GlobalShell';
import SimplePrintableExpense from '@/components/SimplePrintableExpense';
import { formatCurrency } from '@/lib/utils';
import {
  SECTION_CARD,
  SECTION_TITLE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  BTN_OUTLINE,
  BTN_LG,
  SPINNER,
  SPINNER_LG,
  FLEX_CENTER,
} from '@/lib/constants/styles';

interface SimpleExpenseItem {
  id: string;
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail: string;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  order: number;
}

interface SimpleExpenseAttachment {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
}

interface SimpleExpense {
  id: string;
  expenseDate: string | null;
  requestAmount: number;
  requestDate: string;
  applicantName: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  version: string;
  createdAt: string;
  items: SimpleExpenseItem[];
  attachments: SimpleExpenseAttachment[];
}

export default function SimpleExpenseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [expense, setExpense] = useState<SimpleExpense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchExpense = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/simple-expenses/${id}`);

      if (!response.ok) {
        throw new Error('지출결의서를 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setExpense(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchExpense();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('정말로 이 지출결의서를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/simple-expenses/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다.');
      }

      alert('지출결의서가 삭제되었습니다.');
      router.push('/expenses/simple');
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gray-50 ${FLEX_CENTER}`}>
        <div className="text-center">
          <div className={`inline-block ${SPINNER_LG}`}></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className={`min-h-screen bg-gray-50 ${FLEX_CENTER}`}>
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">오류 발생</h2>
          <p className="text-gray-600 mb-4">{error || '지출결의서를 찾을 수 없습니다.'}</p>
          <button onClick={() => router.push('/expenses/simple')} className={BTN_PRIMARY}>
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 프린트용 양식 (화면에서는 숨김, 프린트 시에만 표시) */}
      <SimplePrintableExpense expense={expense} />

      {/* 웹 화면용 (프린트 시 숨김) */}
      <div className="screen-only">
      <GlobalShell
        title="지출결의서 상세 (간편)"
        actions={
          <div className="flex gap-2 no-print">
            <button onClick={handlePrint} className={BTN_PRIMARY} title="페이지 프린트">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              프린트
            </button>
            <button
              onClick={() => router.push(`/expenses/simple/${id}/edit`)}
              disabled={deleteLoading}
              className={BTN_SECONDARY}
            >
              수정
            </button>
            <button onClick={handleDelete} disabled={deleteLoading} className={BTN_DANGER}>
              {deleteLoading && <div className={SPINNER}></div>}
              삭제
            </button>
          </div>
        }
      >
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <p className="text-gray-600">
              작성일: {format(new Date(expense.createdAt), 'yyyy-MM-dd HH:mm')}
            </p>
            <p className="text-sm text-blue-600">
              예산항목: 하단 예산항목 참조 ({expense.version})
            </p>
          </div>

          {/* 지출 정보 */}
          {/* <div className={SECTION_CARD}>
            <h2 className={SECTION_TITLE}>지출 정보</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지출일자</label>
              <p className="text-gray-900">
                {expense.expenseDate
                  ? format(new Date(expense.expenseDate), 'yyyy-MM-dd')
                  : '미정'}
              </p>
            </div>
          </div> */}

          {/* 세부 항목 */}
          <div className={SECTION_CARD}>
            <h2 className={SECTION_TITLE}>세부 항목</h2>
            <p className="text-sm text-gray-500 mb-4">
              예산항목: 하단 예산항목 참조 - 각 항목별 예산(항/목/세목) 선택
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      순서
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      예산(항)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      예산(목)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      예산(세목)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      적요
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      단가
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      수량
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      금액
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expense.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3 text-sm text-gray-900">{item.order}</td>
                      <td className="px-3 py-3 text-sm text-gray-900">{item.budgetCategory}</td>
                      <td className="px-3 py-3 text-sm text-gray-900">{item.budgetSubcategory}</td>
                      <td className="px-3 py-3 text-sm text-gray-900">{item.budgetDetail}</td>
                      <td className="px-3 py-3 text-sm text-gray-900">{item.description}</td>
                      <td className="px-3 py-3 text-sm text-right text-gray-900">
                        {item.unitPrice.toLocaleString('ko-KR')}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-3 text-right text-sm font-semibold text-gray-900"
                    >
                      총 청구금액
                    </td>
                    <td className="px-3 py-3 text-right text-lg font-bold text-blue-500">
                      {formatCurrency(expense.requestAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 청구 정보 */}
          <div className={SECTION_CARD}>
            <h2 className={SECTION_TITLE}>청구 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">청구 일자</label>
                <p className="text-gray-900">
                  {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">청구인</label>
                <p className="text-gray-900">{expense.applicantName}</p>
              </div>
            </div>
          </div>

          {/* 은행 정보 */}
          <div className={SECTION_CARD}>
            <h2 className={SECTION_TITLE}>은행 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">은행명</label>
                <p className="text-gray-900">{expense.bankName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
                <p className="text-gray-900">{expense.accountNumber}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">예금주</label>
                <p className="text-gray-900">{expense.accountHolder}</p>
              </div>
            </div>
          </div>

          {/* 첨부파일 */}
          {expense.attachments && expense.attachments.length > 0 && (
            <div className={SECTION_CARD}>
              <h2 className={SECTION_TITLE}>첨부파일</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {expense.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.secureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <ImagePreview file={attachment} disabled={true} showDetails={true} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-4 no-print">
            <button
              onClick={() => router.push('/expenses/simple')}
              className={`${BTN_OUTLINE} ${BTN_LG}`}
            >
              목록으로
            </button>
          </div>
        </div>
      </GlobalShell>
      </div>
    </>
  );
}
