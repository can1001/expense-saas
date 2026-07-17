'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, RotateCcw, Send } from 'lucide-react';
import { SignatureSelector } from '@/components/signature';
import { apiBase } from '@/lib/api/api-base';

interface SignatureData {
  type: 'signature' | 'stamp' | 'realtime';
  data?: string;
  signatureId?: string;
}

/**
 * 결재 액션 버튼 컴포넌트
 */

interface ApprovalActionButtonsProps {
  expenseId: string;
  status: string;
  currentUserName: string; // 현재 로그인한 사용자 (임시: 나중에 인증 시스템 추가)
  currentApproverName?: string; // 현재 결재 대기 중인 결재자
  applicantName: string; // 작성자
  onSuccess?: () => void;
}

export default function ApprovalActionButtons({
  expenseId,
  status,
  currentUserName,
  currentApproverName,
  applicantName,
  onSuccess,
}: ApprovalActionButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [submitSignatureData, setSubmitSignatureData] = useState<SignatureData | null>(null);
  const [showNoSignatureModal, setShowNoSignatureModal] = useState(false);

  const isApplicant = currentUserName === applicantName;
  const isCurrentApprover = currentUserName === currentApproverName;

  // 사용자의 기본 서명/도장 조회
  const fetchDefaultSignature = async (): Promise<SignatureData | null> => {
    try {
      const response = await fetch('/api/users/me/signatures');
      if (!response.ok) return null;

      const data = await response.json();
      const defaultSig = data.signatures?.find((s: { isDefault: boolean }) => s.isDefault);

      if (defaultSig) {
        return {
          type: defaultSig.type as 'signature' | 'stamp',
          signatureId: defaultSig.id,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // 서명 데이터로 제출 처리
  const submitWithSignature = async (signature: SignatureData) => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase('approvals')}/expenses/${expenseId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '제출 실패');
      }

      alert('제출되었습니다.');
      router.refresh();
      onSuccess?.();
    } catch (error: any) {
      alert(error.message || '제출 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 제출 처리 (기본 서명 자동 적용)
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const defaultSignature = await fetchDefaultSignature();

      if (defaultSignature) {
        // 기본 서명이 있으면 자동 제출
        await submitWithSignature(defaultSignature);
      } else {
        // 서명이 없으면 안내 모달 표시
        setShowNoSignatureModal(true);
      }
    } catch {
      alert('서명 정보를 확인하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 제출 확정 처리
  const handleSubmitConfirm = async () => {
    if (!submitSignatureData) {
      alert('서명 또는 도장을 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBase('approvals')}/expenses/${expenseId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: submitSignatureData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '제출 실패');
      }

      alert('제출되었습니다.');
      setShowSubmitModal(false);
      router.refresh();
      onSuccess?.();
    } catch (error: any) {
      alert(error.message || '제출 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 회수 버튼 (작성자 + PENDING/IN_PROGRESS 상태)
  const handleWithdraw = async () => {
    if (!confirm('지출결의서를 회수하시겠습니까?\n회수 후 수정하여 다시 제출할 수 있습니다.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBase('approvals')}/expenses/${expenseId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName: currentUserName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '회수 실패');
      }

      alert('회수되었습니다. 수정 후 다시 제출할 수 있습니다.');
      router.refresh();
      onSuccess?.();
    } catch (error: any) {
      alert(error.message || '회수 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 승인/반려 모달 열기
  const openCommentModal = (actionType: 'approve' | 'reject') => {
    setAction(actionType);
    setComment('');
    setSignatureData(null);
    setShowCommentModal(true);
  };

  // 승인/반려 처리
  const handleApprovalAction = async () => {
    if (!action) return;

    if (action === 'reject' && !comment.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }

    if (action === 'approve' && !signatureData) {
      alert('서명 또는 도장을 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        action === 'approve'
          ? `${apiBase('approvals')}/expenses/${expenseId}/approve`
          : `${apiBase('approvals')}/expenses/${expenseId}/reject`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverName: currentUserName,
          comment: comment.trim() || undefined,
          ...(action === 'approve' && signatureData && { signature: signatureData }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `${action === 'approve' ? '승인' : '반려'} 실패`);
      }

      alert(data.message);
      setShowCommentModal(false);
      router.refresh();
      onSuccess?.();
    } catch (error: any) {
      alert(error.message || `${action === 'approve' ? '승인' : '반려'} 중 오류가 발생했습니다.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* 제출 버튼 (DRAFT는 항상, WITHDRAWN은 작성자만) */}
        {(status === 'DRAFT' || (isApplicant && status === 'WITHDRAWN')) && (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            제출
          </button>
        )}

        {/* 회수 버튼 (작성자 + 결재 진행 중 상태) */}
        {isApplicant && ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'].includes(status) && (
          <button
            onClick={handleWithdraw}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            회수
          </button>
        )}

        {/* 승인/반려 버튼 (현재 결재자 + 결재 진행 중 상태) */}
        {isCurrentApprover && ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'].includes(status) && (
          <>
            <button
              onClick={() => openCommentModal('approve')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              승인
            </button>
            <button
              onClick={() => openCommentModal('reject')}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="w-4 h-4" />
              반려
            </button>
          </>
        )}
      </div>

      {/* 제출 서명 선택 모달 */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              지출결의서 제출
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              제출 후에는 수정할 수 없습니다. 청구인 서명/도장을 선택해주세요.
            </p>

            {/* 서명/도장 선택 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                청구인 서명/도장 <span className="text-red-500">*</span>
              </label>
              <SignatureSelector
                onSelect={setSubmitSignatureData}
                selectedData={submitSignatureData}
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleSubmitConfirm}
                disabled={loading || !submitSignatureData}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '처리 중...' : '제출'}
              </button>
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 서명 미등록 안내 모달 */}
      {showNoSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">서명 등록이 필요합니다</h3>
              <p className="text-gray-600 text-sm">
                지출결의서 제출을 위해 먼저 서명 또는 도장을 등록해주세요.
                <br />
                마이페이지에서 등록 후 다시 시도해주세요.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNoSignatureModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => router.push('/mypage/signatures')}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                서명 등록하러 가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 승인/반려 의견 입력 모달 */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              결재 {action === 'approve' ? '승인' : '반려'}
            </h3>

            {/* 승인 시 서명/도장 선택 */}
            {action === 'approve' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  서명/도장 <span className="text-red-500">*</span>
                </label>
                <SignatureSelector
                  onSelect={setSignatureData}
                  selectedData={signatureData}
                />
              </div>
            )}

            {/* 의견 입력 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {action === 'approve' ? '승인 의견' : '반려 사유'}
                {action === 'reject' && <span className="text-red-500"> *</span>}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  action === 'approve'
                    ? '승인 의견을 입력하세요 (선택사항)'
                    : '반려 사유를 입력하세요 (필수)'
                }
                className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
                required={action === 'reject'}
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleApprovalAction}
                disabled={
                  loading ||
                  (action === 'reject' && !comment.trim()) ||
                  (action === 'approve' && !signatureData)
                }
                className={`flex-1 px-4 py-2 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ${
                  action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? '처리 중...' : action === 'approve' ? '승인' : '반려'}
              </button>
              <button
                onClick={() => setShowCommentModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
