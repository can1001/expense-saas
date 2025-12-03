'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { pdf } from '@react-pdf/renderer';
import { ExpensePDFDocument } from '@/components/PDFDocument';
import Image from 'next/image';

interface ExpenseItem {
  id: string;
  budgetDetail: string;
  description: string;
  unitPrice: number;
  quantity: number;
  amount: number;
  order: number;
}

interface ExpenseAttachment {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  createdAt: string;
}

interface Expense {
  id: string;
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  expenseDate?: string;
  requestAmount: number;
  requestDate: string;
  requestTeam: string;
  applicantName: string;
  applicantTitle?: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  items: ExpenseItem[];
  attachments?: ExpenseAttachment[];
  createdAt: string;
  updatedAt: string;
}

export default function ExpenseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchExpense();
    }
  }, [id]);

  const fetchExpense = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/expenses/${id}`);

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

  const handleDelete = async () => {
    if (!confirm('정말로 이 지출결의서를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다.');
      }

      alert('지출결의서가 삭제되었습니다.');
      router.push('/expenses');
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!expense) return;

    try {
      const blob = await pdf(<ExpensePDFDocument expense={expense} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `지출결의서_${expense.applicantName}_${format(new Date(expense.requestDate), 'yyyyMMdd')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF 생성 중 오류가 발생했습니다.');
      console.error('PDF generation error:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">오류 발생</h2>
          <p className="text-gray-600 mb-4">{error || '지출결의서를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/expenses')}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">지출결의서 상세</h1>
            <p className="mt-2 text-gray-600">
              작성일: {format(new Date(expense.createdAt), 'yyyy-MM-dd HH:mm')}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
            >
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              PDF 다운로드
            </button>
            <button
              onClick={() => router.push(`/expenses/${id}/edit`)}
              disabled={deleteLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              수정
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {deleteLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              삭제
            </button>
          </div>
        </div>

        {/* 예산 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">예산 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">위원회</label>
              <p className="text-gray-900">{expense.committee}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사역팀(부)</label>
              <p className="text-gray-900">{expense.department}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">예산(항)</label>
              <p className="text-gray-900">{expense.budgetCategory}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">예산(목)</label>
              <p className="text-gray-900">{expense.budgetSubcategory}</p>
            </div>
          </div>
        </div>

        {/* 지출 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">지출 정보</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">지출일자</label>
            <p className="text-gray-900">
              {expense.expenseDate
                ? format(new Date(expense.expenseDate), 'yyyy-MM-dd')
                : '미정'}
            </p>
          </div>
        </div>

        {/* 세부 항목 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">세부 항목</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    순서
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    예산(세목)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    적요
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    단가
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    수량
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    금액
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expense.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.order}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.budgetDetail}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {item.unitPrice.toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                    총 청구금액
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-blue-500">
                    {formatCurrency(expense.requestAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 신청 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">신청 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">청구 일자</label>
              <p className="text-gray-900">
                {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">청구팀</label>
              <p className="text-gray-900">{expense.requestTeam}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">청구인</label>
              <p className="text-gray-900">{expense.applicantName}</p>
            </div>
            {expense.applicantTitle && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">직책</label>
                <p className="text-gray-900">{expense.applicantTitle}</p>
              </div>
            )}
          </div>
        </div>

        {/* 은행 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">은행 정보</h2>
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
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">첨부파일</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {expense.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow group"
                >
                  {/* 이미지 미리보기 */}
                  <a
                    href={attachment.secureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative w-full h-40 bg-gray-100"
                  >
                    <Image
                      src={attachment.secureUrl}
                      alt={attachment.fileName}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                    {/* 호버 시 확대 아이콘 */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                        />
                      </svg>
                    </div>
                  </a>

                  {/* 파일 정보 */}
                  <div className="p-2">
                    <p className="text-xs text-gray-700 truncate" title={attachment.fileName}>
                      {attachment.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(attachment.fileSize / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-4">
          <button
            onClick={() => router.push('/expenses')}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            목록으로
          </button>
        </div>
      </div>
    </div>
  );
}
