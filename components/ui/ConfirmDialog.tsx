'use client';

import { useEffect, useCallback } from 'react';
import {
  MODAL_OVERLAY,
  MODAL_CONTAINER,
  MODAL_HEADER,
  MODAL_BODY,
  MODAL_SM,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_DANGER,
  SPINNER,
} from '@/lib/constants/styles';
import { AlertTriangle, XCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'warning',
  isLoading = false,
}: ConfirmDialogProps) {
  // ESC 키로 닫기
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const Icon = variant === 'danger' ? XCircle : AlertTriangle;
  const iconColorClass = variant === 'danger' ? 'text-red-500' : 'text-yellow-500';
  const iconBgClass = variant === 'danger' ? 'bg-red-100' : 'bg-yellow-100';
  const confirmButtonClass = variant === 'danger' ? BTN_DANGER : BTN_PRIMARY;

  return (
    <div className={MODAL_OVERLAY} onClick={isLoading ? undefined : onClose}>
      <div
        className={`${MODAL_CONTAINER} ${MODAL_SM}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        {/* 헤더 */}
        <div className={MODAL_HEADER}>
          <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className={MODAL_BODY}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-10 h-10 ${iconBgClass} rounded-full flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconColorClass}`} />
            </div>
            <p id="confirm-dialog-message" className="text-gray-600 pt-2">
              {message}
            </p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className={`${BTN_OUTLINE} disabled:opacity-50`}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`${confirmButtonClass} disabled:opacity-50`}
          >
            {isLoading ? (
              <>
                <div className={SPINNER}></div>
                처리 중...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
