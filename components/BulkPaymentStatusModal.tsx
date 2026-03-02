'use client';

import { useState, useEffect } from 'react';
import { SignatureSelector } from './signature/SignatureSelector';
import { usePaymentSignatureRequired } from '@/hooks/useSystemSetting';

interface SignatureData {
  type: 'signature' | 'stamp' | 'realtime';
  data?: string;
  signatureId?: string;
}

interface BulkPaymentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (signature?: SignatureData | null) => void;
  selectedCount: number;
  isProcessing: boolean;
}

export function BulkPaymentStatusModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  isProcessing,
}: BulkPaymentStatusModalProps) {
  const [signature, setSignature] = useState<SignatureData | null>(null);

  // 출납 서명 필수 여부 설정 조회
  const { value: signatureRequired } = usePaymentSignatureRequired();

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setSignature(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasValidSignature = signature && (signature.signatureId || signature.data);
  const canConfirm = !signatureRequired || hasValidSignature;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(signature);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 모달 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          일괄 지급완료 처리
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          선택한 <span className="font-semibold text-blue-600">{selectedCount}건</span>을 지급완료로 변경합니다.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-800">
            ※ 최종 승인된 항목만 변경됩니다.
          </p>
        </div>

        {/* 출납 서명 선택 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            출납 서명 {signatureRequired ? <span className="text-red-500">*</span> : '(선택)'}
          </label>
          <p className="text-xs text-gray-500 mb-3">
            선택한 서명이 모든 지출결의서에 일괄 적용됩니다.
          </p>
          {signatureRequired && !hasValidSignature && (
            <p className="text-xs text-amber-600 mb-2">
              지급 완료 처리를 위해 출납 서명이 필요합니다.
            </p>
          )}
          <SignatureSelector
            onSelect={setSignature}
            selectedData={signature}
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            disabled={isProcessing}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessing || !canConfirm}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                처리 중...
              </span>
            ) : (
              '지급완료 처리'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
