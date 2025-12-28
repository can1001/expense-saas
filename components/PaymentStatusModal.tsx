'use client';

import { useState } from 'react';

interface PaymentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  currentStatus: 'PENDING' | 'COMPLETED';
  isProcessing: boolean;
}

export function PaymentStatusModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  isProcessing,
}: PaymentStatusModalProps) {
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const isCompleting = currentStatus === 'PENDING';
  const title = isCompleting ? '지출완료 처리' : '지출예정으로 되돌리기';
  const message = isCompleting
    ? '이 지출결의서를 지출완료로 처리하시겠습니까?'
    : '이 지출결의서를 지출예정으로 되돌리시겠습니까?';
  const buttonText = isCompleting ? '지출완료 처리' : '지출예정으로 변경';
  const buttonColor = isCompleting
    ? 'bg-blue-600 hover:bg-blue-700'
    : 'bg-yellow-600 hover:bg-yellow-700';

  const handleConfirm = () => {
    onConfirm(note);
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
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {title}
        </h2>

        <p className="text-gray-600 mb-4">
          {message}
        </p>

        {/* 메모 입력 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            메모 (선택)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isCompleting ? '예: 12월 28일 이체 완료' : '예: 이체 취소로 인한 되돌리기'}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className={`px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}
            disabled={isProcessing}
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
              buttonText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
