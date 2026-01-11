'use client';

import { useState, useEffect } from 'react';

type PaymentStatusType = 'PENDING' | 'HOLD' | 'CANCELLED' | 'COMPLETED';

interface PaymentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newStatus: string, note: string, reason?: string) => void;
  currentStatus: PaymentStatusType;
  isProcessing: boolean;
}

const STATUS_OPTIONS: { value: PaymentStatusType; label: string; description: string; color: string }[] = [
  {
    value: 'PENDING',
    label: '지급 대기',
    description: '지급을 대기하는 상태입니다.',
    color: 'amber',
  },
  {
    value: 'HOLD',
    label: '지급 보류',
    description: '일시적으로 지급을 보류합니다. 사유를 입력해주세요.',
    color: 'orange',
  },
  {
    value: 'CANCELLED',
    label: '지급 취소',
    description: '지급을 취소합니다. 사유를 입력해주세요.',
    color: 'red',
  },
  {
    value: 'COMPLETED',
    label: '지급 완료',
    description: '지급이 완료되었습니다.',
    color: 'emerald',
  },
];

export function PaymentStatusModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
  isProcessing,
}: PaymentStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatusType>(currentStatus);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');

  // 모달이 열릴 때 현재 상태로 초기화
  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(currentStatus);
      setNote('');
      setReason('');
    }
  }, [isOpen, currentStatus]);

  if (!isOpen) return null;

  const needsReason = selectedStatus === 'HOLD' || selectedStatus === 'CANCELLED';
  const canSubmit = !needsReason || reason.trim().length > 0;
  const isStatusChanged = selectedStatus !== currentStatus;

  const handleConfirm = () => {
    if (!isStatusChanged) return;
    if (needsReason && !reason.trim()) return;
    onConfirm(selectedStatus, note, needsReason ? reason : undefined);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getRadioColorClass = (status: PaymentStatusType, isSelected: boolean) => {
    if (!isSelected) return 'border-gray-300';
    switch (status) {
      case 'PENDING': return 'border-amber-500 bg-amber-50';
      case 'HOLD': return 'border-orange-500 bg-orange-50';
      case 'CANCELLED': return 'border-red-500 bg-red-50';
      case 'COMPLETED': return 'border-emerald-500 bg-emerald-50';
      default: return 'border-gray-300';
    }
  };

  const getCheckColorClass = (status: PaymentStatusType) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-500';
      case 'HOLD': return 'bg-orange-500';
      case 'CANCELLED': return 'bg-red-500';
      case 'COMPLETED': return 'bg-emerald-500';
      default: return 'bg-gray-500';
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          지급 상태 변경
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          현재 상태: <span className="font-medium">{STATUS_OPTIONS.find(s => s.value === currentStatus)?.label}</span>
        </p>

        {/* 상태 선택 라디오 버튼 */}
        <div className="space-y-2 mb-4">
          {STATUS_OPTIONS.map((option) => {
            const isSelected = selectedStatus === option.value;
            const isCurrent = currentStatus === option.value;

            return (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  getRadioColorClass(option.value, isSelected)
                } ${isCurrent ? 'ring-2 ring-offset-2 ring-gray-300' : ''}`}
              >
                <input
                  type="radio"
                  name="paymentStatus"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setSelectedStatus(option.value)}
                  className="sr-only"
                />
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-transparent' : 'border-gray-300'
                } ${isSelected ? getCheckColorClass(option.value) : ''}`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{option.label}</span>
                    {isCurrent && (
                      <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                        현재
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                </div>
              </label>
            );
          })}
        </div>

        {/* 사유 입력 (HOLD, CANCELLED일 때만) */}
        {needsReason && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {selectedStatus === 'HOLD' ? '보류 사유' : '취소 사유'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={selectedStatus === 'HOLD' ? '예: 계좌 정보 확인 필요' : '예: 중복 결의서로 취소'}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
            />
          </div>
        )}

        {/* 메모 입력 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            메모 (선택)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="추가 메모를 입력하세요"
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
            className={`px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isStatusChanged && canSubmit
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
            disabled={isProcessing || !isStatusChanged || !canSubmit}
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
              '변경'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
