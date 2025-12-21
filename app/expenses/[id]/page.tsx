'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { pdf } from '@react-pdf/renderer';
import { ExpensePDFDocument } from '@/components/PDFDocument';
import { generateExpenseExcel } from '@/lib/excel';
import ImagePreview from '@/components/ImagePreview';
import Header from '@/components/Header';
import PrintableExpense from '@/components/PrintableExpense';
import ApprovalStatusBadge from '@/components/approval/ApprovalStatusBadge';
import ApprovalLineDisplay from '@/components/approval/ApprovalLineDisplay';
import ApprovalActionButtons from '@/components/approval/ApprovalActionButtons';
import { Expense } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { SECTION_CARD, SECTION_TITLE, BTN_PRIMARY, BTN_SECONDARY, BTN_SUCCESS, BTN_DANGER, BTN_EMERALD, BTN_OUTLINE, BTN_LG, SPINNER, SPINNER_LG, FLEX_CENTER } from '@/lib/constants/styles';

export default function ExpenseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [expense, setExpense] = useState<Expense | null>(null);
  const [approvalData, setApprovalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  // 로그인한 사용자 정보 가져오기
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch {
        // 로그인되지 않은 경우 무시
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 지출결의서와 결재 정보를 함께 조회
      const [expenseRes, approvalRes] = await Promise.all([
        fetch(`/api/expenses/${id}`),
        fetch(`/api/expenses/${id}/approval`),
      ]);

      if (!expenseRes.ok) {
        throw new Error('지출결의서를 불러오는데 실패했습니다.');
      }

      const expenseData = await expenseRes.json();
      setExpense(expenseData);

      // 결재 정보는 없을 수도 있음 (DRAFT 상태)
      if (approvalRes.ok) {
        const approvalInfo = await approvalRes.json();
        setApprovalData(approvalInfo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 현재 결재자 이름 가져오기
  const getCurrentApproverName = () => {
    if (!approvalData?.approvalLine) return undefined;
    const currentStep = approvalData.approvalLine.steps.find(
      (step: any) => step.stepNumber === approvalData.approvalLine.currentStep
    );
    return currentStep?.approverName;
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

    setPdfLoading(true);
    try {
      const blob = await pdf(<ExpensePDFDocument expense={expense} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `지출결의서_${expense.applicantName}_${format(new Date(expense.requestDate), 'yyyyMMdd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
      console.error('PDF generation error:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!expense) return;

    setExcelLoading(true);
    try {
      await generateExpenseExcel(expense);
    } catch (err) {
      alert('엑셀 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
      console.error('Excel generation error:', err);
    } finally {
      setExcelLoading(false);
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
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">오류 발생</h2>
          <p className="text-gray-600 mb-4">{error || '지출결의서를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/expenses')}
            className={BTN_PRIMARY}
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 프린트용 양식 (화면에서는 숨김, 프린트 시에만 표시) */}
      <PrintableExpense expense={expense} />

      {/* 웹 화면용 (프린트 시 숨김) */}
      <div className="min-h-screen bg-gray-50 screen-only">
        <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">지출결의서 상세</h1>
              <ApprovalStatusBadge status={expense.status || 'DRAFT'} size="lg" />
            </div>
            <p className="mt-2 text-gray-600">
              작성일: {format(new Date(expense.createdAt), 'yyyy-MM-dd HH:mm')}
            </p>
          </div>

          <div className="flex gap-2 no-print">
            {/* 프린트 버튼 */}
            <button
              onClick={handlePrint}
              className={BTN_PRIMARY}
              title="페이지 프린트"
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
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              프린트
            </button>
            {/* PDF 다운로드 버튼 - 임시 숨김 */}
            {/* <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className={BTN_SUCCESS}
              title="PDF 파일로 다운로드"
            >
              {pdfLoading ? (
                <>
                  <div className={SPINNER}></div>
                  생성 중...
                </>
              ) : (
                <>
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
                  PDF
                </>
              )}
            </button> */}
            {/* 엑셀 다운로드 버튼 - 임시 숨김 */}
            {/* <button
              onClick={handleDownloadExcel}
              disabled={excelLoading}
              className={BTN_EMERALD}
              title="엑셀 파일로 다운로드"
            >
              {excelLoading ? (
                <>
                  <div className={SPINNER}></div>
                  생성 중...
                </>
              ) : (
                <>
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
                      d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  엑셀
                </>
              )}
            </button> */}
            <button
              onClick={() => router.push(`/expenses/${id}/edit`)}
              disabled={deleteLoading}
              className={BTN_SECONDARY}
            >
              수정
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className={BTN_DANGER}
            >
              {deleteLoading && (
                <div className={SPINNER}></div>
              )}
              삭제
            </button>
          </div>
        </div>

        {/* 예산 정보 */}
        <div className={SECTION_CARD}>
          <h2 className={SECTION_TITLE}>예산 정보</h2>
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
        <div className={SECTION_CARD}>
          <h2 className={SECTION_TITLE}>지출 정보</h2>
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
        <div className={SECTION_CARD}>
          <h2 className={SECTION_TITLE}>세부 항목</h2>
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
        <div className={SECTION_CARD}>
          <h2 className={SECTION_TITLE}>신청 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">청구 일자</label>
              <p className="text-gray-900">
                {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">청구팀</label>
              <p className="text-gray-900">{expense.committee} {expense.department}</p>
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
                  <ImagePreview
                    file={attachment}
                    disabled={true}
                    showDetails={true}
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 결재 정보 */}
        <div className={SECTION_CARD}>
          <h2 className={SECTION_TITLE}>결재 정보</h2>

          {/* 현재 로그인 사용자 정보 */}
          {currentUser && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                현재 로그인: <strong>{currentUser.username}</strong>
                {getCurrentApproverName() && (
                  <span className="ml-4">
                    | 현재 결재 대기자: <strong>{getCurrentApproverName()}</strong>
                  </span>
                )}
              </p>
            </div>
          )}

          {/* 결재 액션 버튼 */}
          <div className="mb-6">
            <ApprovalActionButtons
              expenseId={id}
              status={expense.status || 'DRAFT'}
              currentUserName={currentUser?.username || expense.applicantName}
              currentApproverName={getCurrentApproverName()}
              applicantName={expense.applicantName}
              onSuccess={fetchData}
            />
            {expense.status === 'DRAFT' && (
              <p className="mt-3 text-sm text-gray-500">
                제출 버튼을 클릭하면 결재선이 자동 생성되고 결재 프로세스가 시작됩니다.
              </p>
            )}
          </div>

          {/* 결재선 표시 */}
          <ApprovalLineDisplay
            approvalLine={approvalData?.approvalLine}
            expenseStatus={expense.status || 'DRAFT'}
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-4 no-print">
          <button
            onClick={() => router.push('/expenses')}
            className={`${BTN_OUTLINE} ${BTN_LG}`}
          >
            목록으로
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
