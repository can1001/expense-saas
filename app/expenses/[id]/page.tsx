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
import { PaymentStatusModal } from '@/components/PaymentStatusModal';
import Accordion, { InfoRow, MobileItemCard } from '@/components/ui/Accordion';
import { Expense } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { SECTION_CARD, SECTION_TITLE, BTN_PRIMARY, BTN_SECONDARY, BTN_SUCCESS, BTN_DANGER, BTN_EMERALD, BTN_OUTLINE, BTN_LG, SPINNER, SPINNER_LG, FLEX_CENTER } from '@/lib/constants/styles';
import { ArrowLeft, Printer, FileSpreadsheet, Edit2, Trash2 } from 'lucide-react';

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
  const [webExcelLoading, setWebExcelLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ userid: string; username: string; role: string } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStatusLoading, setPaymentStatusLoading] = useState(false);

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

  // 프린트용: 1차 결재자(팀장) 이름
  const getTeamLeaderNameForPrint = () => {
    const steps = approvalData?.approvalLine?.steps;
    if (!Array.isArray(steps)) return null;
    const teamStep = steps.find((step: any) =>
      step?.stepName === '팀장' || step?.approverTitle === '팀장'
    );
    return typeof teamStep?.approverName === 'string' ? teamStep.approverName : null;
  };

  // 프린트용: 3차 결재자(재정팀장) 이름
  const getFinanceManagerNameForPrint = () => {
    const steps = approvalData?.approvalLine?.steps;
    if (!Array.isArray(steps)) return null;
    const financeStep = steps.find((step: any) =>
      step?.stepName === '재정팀장' || step?.approverTitle === '재정팀장'
    );
    return typeof financeStep?.approverName === 'string' ? financeStep.approverName : null;
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

  // 웹 교적용 엑셀 다운로드
  const handleDownloadWebExcel = async () => {
    if (!expense) return;

    setWebExcelLoading(true);
    try {
      const response = await fetch(`/api/expenses/export/excel?ids=${id}&status=all`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '엑셀 내보내기에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Content-Disposition 헤더에서 파일명 추출
      const disposition = response.headers.get('Content-Disposition');
      let filename = `지출재정_${expense.applicantName}.xlsx`;
      if (disposition) {
        const filenameMatch = disposition.match(/filename\*=UTF-8''(.+)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : '엑셀 내보내기 중 오류가 발생했습니다.');
      console.error('Web Excel generation error:', err);
    } finally {
      setWebExcelLoading(false);
    }
  };

  // 지출 상태 변경 핸들러
  const handlePaymentStatusChange = async (note: string) => {
    if (!expense) return;

    const newStatus = expense.paymentStatus === 'PENDING' ? 'COMPLETED' : 'PENDING';

    setPaymentStatusLoading(true);
    try {
      const response = await fetch(`/api/expenses/${id}/payment-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: newStatus,
          note,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '지출 상태 변경에 실패했습니다.');
      }

      // 상태 업데이트
      setExpense({
        ...expense,
        paymentStatus: data.data.paymentStatus,
        paymentCompletedAt: data.data.paymentCompletedAt,
        paymentCompletedBy: data.data.paymentCompletedBy,
        paymentNote: data.data.paymentNote,
      });

      setShowPaymentModal(false);
      alert(data.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : '지출 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setPaymentStatusLoading(false);
    }
  };

  // 관리자 또는 재정팀장인지 확인
  const canChangePaymentStatus = currentUser &&
    (currentUser.role === 'admin' || currentUser.role === '재정팀장');

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
      <PrintableExpense
        expense={expense}
        teamLeaderName={getTeamLeaderNameForPrint()}
        financeManagerName={getFinanceManagerNameForPrint()}
      />

      {/* 웹 화면용 (프린트 시 숨김) */}
      <div className="min-h-screen bg-gray-50 screen-only">
        <Header />

        {/* 모바일 상단 바 */}
        <div className="md:hidden sticky top-16 z-20 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/expenses')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 min-h-[44px]"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>목록</span>
            </button>
            <div className="flex items-center gap-2">
              <ApprovalStatusBadge status={expense.status || 'DRAFT'} size="sm" />
              {expense.status === 'APPROVED_FINAL' && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  expense.paymentStatus === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {expense.paymentStatus === 'COMPLETED' ? '지출완료' : '지출예정'}
                </span>
              )}
            </div>
          </div>
        </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-32 md:pb-8">

        {/* 모바일 요약 카드 */}
        <div className="md:hidden mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">
                {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
              </span>
              <span className="text-sm text-gray-500">{expense.committee}</span>
            </div>
            <div className="mb-3">
              <h2 className="text-lg font-bold text-gray-900">{expense.applicantName}</h2>
              <p className="text-sm text-gray-600">{expense.budgetCategory} &gt; {expense.budgetSubcategory}</p>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">총 청구금액</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(expense.requestAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 데스크톱 헤더 */}
        <div className="hidden md:flex mb-8 justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">지출결의서 상세</h1>
              <ApprovalStatusBadge status={expense.status || 'DRAFT'} size="lg" />
              {expense.status === 'APPROVED_FINAL' && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  expense.paymentStatus === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {expense.paymentStatus === 'COMPLETED' ? '지출완료' : '지출예정'}
                </span>
              )}
            </div>
            <p className="mt-2 text-gray-600">
              작성일: {format(new Date(expense.createdAt), 'yyyy-MM-dd HH:mm')}
            </p>
          </div>

          <div className="flex gap-2 no-print">
            <button
              onClick={handlePrint}
              className={BTN_PRIMARY}
              title="페이지 프린트"
            >
              <Printer className="w-5 h-5" />
              프린트
            </button>
            <button
              onClick={handleDownloadWebExcel}
              disabled={webExcelLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              title="웹 교적 등록용 엑셀 다운로드"
            >
              {webExcelLoading ? (
                <>
                  <div className={SPINNER}></div>
                  생성 중...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-5 h-5" />
                  엑셀 다운로드
                </>
              )}
            </button>
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
              {deleteLoading && <div className={SPINNER}></div>}
              삭제
            </button>
          </div>
        </div>

        {/* 모바일 아코디언 섹션들 */}
        <div className="md:hidden space-y-3">
          {/* 세부 항목 */}
          <Accordion
            title="세부 항목"
            defaultOpen={true}
            badge={<span className="text-sm text-gray-500">{expense.items.length}건</span>}
          >
            <div className="pt-3 space-y-3">
              {expense.items.map((item) => (
                <MobileItemCard
                  key={item.id}
                  order={item.order}
                  budgetDetail={item.budgetDetail}
                  description={item.description}
                  unitPrice={item.unitPrice}
                  quantity={item.quantity}
                  amount={item.amount}
                />
              ))}
            </div>
          </Accordion>

          {/* 예산 정보 */}
          <Accordion title="예산 정보">
            <div className="pt-3 grid grid-cols-2 gap-x-4">
              <InfoRow label="위원회" value={expense.committee} />
              <InfoRow label="사역팀(부)" value={expense.department} />
              <InfoRow label="예산(항)" value={expense.budgetCategory} />
              <InfoRow label="예산(목)" value={expense.budgetSubcategory} />
            </div>
          </Accordion>

          {/* 신청 정보 */}
          <Accordion title="신청 정보">
            <div className="pt-3 grid grid-cols-2 gap-x-4">
              <InfoRow label="청구일자" value={format(new Date(expense.requestDate), 'yyyy-MM-dd')} />
              <InfoRow label="지출일자" value={expense.expenseDate ? format(new Date(expense.expenseDate), 'yyyy-MM-dd') : '미정'} />
              <InfoRow label="청구인" value={expense.applicantName} />
              {expense.applicantTitle && <InfoRow label="직책" value={expense.applicantTitle} />}
            </div>
          </Accordion>

          {/* 은행 정보 */}
          <Accordion title="은행 정보">
            <div className="pt-3">
              <InfoRow label="은행명" value={expense.bankName} />
              <InfoRow label="계좌번호" value={expense.accountNumber} />
              <InfoRow label="예금주" value={expense.accountHolder} />
            </div>
          </Accordion>
        </div>

        {/* 데스크톱 섹션들 */}
        <div className="hidden md:block space-y-6">
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
            {(expense.status === 'DRAFT' || expense.status === 'WITHDRAWN') && (
              <p className="mt-3 text-sm text-gray-500">
                {expense.status === 'WITHDRAWN'
                  ? '제출 버튼을 클릭하면 새로운 결재선이 생성되고 결재 프로세스가 다시 시작됩니다.'
                  : '제출 버튼을 클릭하면 결재선이 자동 생성되고 결재 프로세스가 시작됩니다.'}
              </p>
            )}
          </div>

          {/* 결재선 표시 */}
          <ApprovalLineDisplay
            approvalLine={approvalData?.approvalLine}
            expenseStatus={expense.status || 'DRAFT'}
          />

          {/* 지출 상태 관리 (최종 승인된 경우에만 표시) */}
          {expense.status === 'APPROVED_FINAL' && (
            <div className={`${SECTION_CARD} mt-6 no-print`}>
              <h2 className={SECTION_TITLE}>지출 상태 관리</h2>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-full text-base font-medium ${
                      expense.paymentStatus === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {expense.paymentStatus === 'COMPLETED' ? '지출완료' : '지출예정'}
                    </span>
                  </div>
                  {expense.paymentStatus === 'COMPLETED' && expense.paymentCompletedAt && (
                    <p className="mt-2 text-sm text-gray-500">
                      {format(new Date(expense.paymentCompletedAt), 'yyyy-MM-dd HH:mm')}에
                      {expense.paymentCompletedBy && ` ${expense.paymentCompletedBy}님이`} 처리
                      {expense.paymentNote && ` (${expense.paymentNote})`}
                    </p>
                  )}
                </div>
                {canChangePaymentStatus && (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className={expense.paymentStatus === 'PENDING'
                      ? 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
                      : 'px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors'
                    }
                  >
                    {expense.paymentStatus === 'PENDING' ? '지출완료 처리' : '지출예정으로 되돌리기'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 데스크톱 버튼 */}
        <div className="hidden md:flex justify-end gap-4 no-print">
          <button
            onClick={() => router.push('/expenses')}
            className={`${BTN_OUTLINE} ${BTN_LG}`}
          >
            목록으로
          </button>
        </div>
      </div>

      {/* 모바일 하단 고정 액션 바 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 flex gap-2 z-30 shadow-lg no-print">
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[48px]"
        >
          <Printer className="w-5 h-5" />
          <span className="text-sm font-medium">프린트</span>
        </button>
        <button
          onClick={handleDownloadWebExcel}
          disabled={webExcelLoading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors min-h-[48px]"
        >
          {webExcelLoading ? (
            <div className={SPINNER}></div>
          ) : (
            <FileSpreadsheet className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">엑셀</span>
        </button>
        <button
          onClick={() => router.push(`/expenses/${id}/edit`)}
          disabled={deleteLoading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors min-h-[48px]"
        >
          <Edit2 className="w-5 h-5" />
          <span className="text-sm font-medium">수정</span>
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteLoading}
          className="flex items-center justify-center px-3 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors min-h-[48px] min-w-[48px]"
        >
          {deleteLoading ? (
            <div className={SPINNER}></div>
          ) : (
            <Trash2 className="w-5 h-5" />
          )}
        </button>
      </div>
      </div>

      {/* 지출 상태 변경 모달 */}
      <PaymentStatusModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handlePaymentStatusChange}
        currentStatus={expense.paymentStatus || 'PENDING'}
        isProcessing={paymentStatusLoading}
      />
    </>
  );
}
