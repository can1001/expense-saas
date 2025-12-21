'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import Header from '@/components/Header';
import ApprovalStatusBadge from '@/components/approval/ApprovalStatusBadge';
import ApprovalLineDisplay from '@/components/approval/ApprovalLineDisplay';
import ApprovalActionButtons from '@/components/approval/ApprovalActionButtons';
import { Expense } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Building2, User, Calendar, CreditCard, FileText, Clock } from 'lucide-react';

export default function ApprovalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [expense, setExpense] = useState<Expense | null>(null);
  const [approvalData, setApprovalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ userid: string; username: string; role: string } | null>(null);

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

  // 현재 결재자 정보
  const getCurrentApproverName = () => {
    if (!approvalData?.approvalLine) return undefined;
    const currentStep = approvalData.approvalLine.steps.find(
      (step: any) => step.stepNumber === approvalData.approvalLine.currentStep
    );
    return currentStep?.approverName;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">오류 발생</h2>
          <p className="text-gray-600 mb-4">{error || '지출결의서를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/approvals')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            결재함으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 뒤로가기 */}
        <button
          onClick={() => router.push('/approvals')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          결재함으로 돌아가기
        </button>

        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <ApprovalStatusBadge status={expense.status || 'DRAFT'} size="lg" />
                {approvalData?.approvalLine?.isUrgent && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
                    긴급
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {expense.budgetCategory} - {expense.budgetSubcategory}
              </h1>
              <p className="text-gray-500 mt-1">
                작성일: {format(new Date(expense.createdAt), 'yyyy-MM-dd HH:mm')}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500">청구금액</p>
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(expense.requestAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 지출결의서 정보 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 예산 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-500" />
                예산 정보
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500">위원회</label>
                  <p className="font-medium text-gray-900">{expense.committee}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">사역팀(부)</label>
                  <p className="font-medium text-gray-900">{expense.department}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">예산(항)</label>
                  <p className="font-medium text-gray-900">{expense.budgetCategory}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">예산(목)</label>
                  <p className="font-medium text-gray-900">{expense.budgetSubcategory}</p>
                </div>
              </div>
            </div>

            {/* 세부 항목 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                세부 항목
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        순서
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        예산(세목)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        적요
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        단가
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        수량
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
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
                      <td
                        colSpan={5}
                        className="px-4 py-3 text-right text-sm font-semibold text-gray-900"
                      >
                        총 청구금액
                      </td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-blue-600">
                        {formatCurrency(expense.requestAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 신청자 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-500" />
                신청자 정보
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-500">청구일자</label>
                  <p className="font-medium text-gray-900">
                    {format(new Date(expense.requestDate), 'yyyy-MM-dd')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">청구팀</label>
                  <p className="font-medium text-gray-900">{expense.requestTeam}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">청구인</label>
                  <p className="font-medium text-gray-900">{expense.applicantName}</p>
                </div>
                {expense.applicantTitle && (
                  <div>
                    <label className="block text-sm text-gray-500">직책</label>
                    <p className="font-medium text-gray-900">{expense.applicantTitle}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 은행 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-500" />
                은행 정보
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-500">은행명</label>
                  <p className="font-medium text-gray-900">{expense.bankName}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">계좌번호</label>
                  <p className="font-medium text-gray-900">{expense.accountNumber}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">예금주</label>
                  <p className="font-medium text-gray-900">{expense.accountHolder}</p>
                </div>
              </div>
            </div>

            {/* 첨부파일 */}
            {expense.attachments && expense.attachments.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">첨부파일</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {expense.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.secureUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <img
                        src={attachment.secureUrl}
                        alt={attachment.fileName}
                        className="w-full h-32 object-cover"
                      />
                      <p className="p-2 text-xs text-gray-600 truncate">{attachment.fileName}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 결재 정보 및 액션 */}
          <div className="space-y-6">
            {/* 결재자 선택 (임시 - 실제로는 인증 시스템 사용) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-500" />
                현재 로그인 사용자
              </h2>
              {currentUser ? (
                <p className="text-base font-medium text-gray-900">
                  {currentUser.username}
                </p>
              ) : (
                <p className="text-sm text-gray-500">로그인 정보를 불러오는 중...</p>
              )}
            </div>

            {/* 결재 액션 버튼 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                결재 처리
              </h2>

              {/* 결재 상태 정보 */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
                <p className="text-blue-800">
                  현재 결재 대기자: <strong>{getCurrentApproverName() || '(없음)'}</strong>
                </p>
                <p className="text-blue-600 text-xs mt-1">
                  결재 단계: {approvalData?.approvalLine?.currentStep || 0} / {approvalData?.approvalLine?.totalSteps || 3}
                </p>
              </div>

              <ApprovalActionButtons
                expenseId={id}
                status={expense.status || 'DRAFT'}
                currentUserName={currentUser?.userid || ''}
                currentApproverName={getCurrentApproverName()}
                applicantName={expense.applicantName}
                onSuccess={fetchData}
              />
              {currentUser && getCurrentApproverName() !== currentUser.userid &&
                ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'].includes(expense.status || '') && (
                  <p className="mt-4 text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                    현재 결재 대기자: <strong>{getCurrentApproverName()}</strong>
                    <br />
                    로그인한 사용자({currentUser.userid})의 결재 순서가 아닙니다.
                  </p>
                )}
            </div>

            {/* 결재선 표시 */}
            <ApprovalLineDisplay
              approvalLine={approvalData?.approvalLine}
              expenseStatus={expense.status || 'DRAFT'}
            />

            {/* 결재 로그 */}
            {approvalData?.logs && approvalData.logs.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">결재 이력</h2>
                <div className="space-y-3">
                  {approvalData.logs.map((log: any) => (
                    <div
                      key={log.id}
                      className="border-l-4 border-gray-300 pl-4 py-2"
                      style={{
                        borderColor:
                          log.action === 'APPROVE'
                            ? '#10B981'
                            : log.action === 'REJECT'
                            ? '#EF4444'
                            : log.action === 'SUBMIT'
                            ? '#3B82F6'
                            : '#6B7280',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{log.actorName}</span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(log.createdAt), 'MM/dd HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {log.action === 'SUBMIT'
                          ? '제출'
                          : log.action === 'APPROVE'
                          ? '승인'
                          : log.action === 'REJECT'
                          ? '반려'
                          : log.action === 'WITHDRAW'
                          ? '회수'
                          : log.action}
                        {log.stepNumber && ` (${log.stepNumber}차)`}
                      </p>
                      {log.comment && (
                        <p className="text-sm text-gray-500 mt-1 italic">"{log.comment}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
