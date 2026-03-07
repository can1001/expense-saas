'use client';

import { useState, useEffect } from 'react';

interface BulkExpenseDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (expenseDate: string, overwriteExisting: boolean) => void;
  selectedCount: number;
  isProcessing: boolean;
}

export function BulkExpenseDateModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  isProcessing,
}: BulkExpenseDateModalProps) {
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setOverwriteExisting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!expenseDate) return;
    onConfirm(expenseDate, overwriteExisting);
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
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          일괄 지출일자 설정
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          선택한 <span className="font-semibold text-blue-600">{selectedCount}건</span>의 지출일자를 변경합니다.
        </p>

        {/* 지출일자 입력 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            지출일자 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 덮어쓰기 옵션 */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              기존 지출일자가 있는 항목도 변경
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            체크하지 않으면 지출일자가 비어있는 항목만 변경됩니다.
          </p>
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
            className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessing || !expenseDate}
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
              '지출일자 설정'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
