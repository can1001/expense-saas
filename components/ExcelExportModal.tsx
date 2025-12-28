'use client';

import { useState } from 'react';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: { date: string | null; useSameDate: boolean }) => void;
  selectedCount: number;
  isExporting: boolean;
}

export function ExcelExportModal({
  isOpen,
  onClose,
  onExport,
  selectedCount,
  isExporting,
}: ExcelExportModalProps) {
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [useSameDate, setUseSameDate] = useState(true);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({
      date: useSameDate ? date : null,
      useSameDate,
    });
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
          엑셀 다운로드
        </h2>

        <p className="text-sm text-gray-600 mb-6">
          {selectedCount}건의 지출결의서를 내보냅니다.
        </p>

        {/* 날짜 옵션 */}
        <div className="space-y-4 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="dateOption"
              checked={useSameDate}
              onChange={() => setUseSameDate(true)}
              className="mt-1"
            />
            <div className="flex-1">
              <span className="text-gray-900">모든 항목에 동일 날짜 적용</span>
              {useSameDate && (
                <div className="mt-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="dateOption"
              checked={!useSameDate}
              onChange={() => setUseSameDate(false)}
            />
            <span className="text-gray-900">각 항목의 기존 날짜 유지</span>
          </label>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
            disabled={isExporting}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isExporting || (useSameDate && !date)}
          >
            {isExporting ? (
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
                다운로드 중...
              </span>
            ) : (
              '다운로드'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
