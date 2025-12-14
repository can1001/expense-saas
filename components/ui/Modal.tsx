'use client';

import { useEffect, useCallback } from 'react';
import {
  MODAL_OVERLAY,
  MODAL_CONTAINER,
  MODAL_HEADER,
  MODAL_BODY,
  MODAL_SM,
  MODAL_MD,
  MODAL_LG,
} from '@/lib/constants/styles';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: MODAL_SM,
  md: MODAL_MD,
  lg: MODAL_LG,
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  // ESC 키로 닫기
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
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

  return (
    <div className={MODAL_OVERLAY} onClick={onClose}>
      <div
        className={`${MODAL_CONTAINER} ${sizeClasses[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className={MODAL_HEADER}>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
        <div className={MODAL_BODY}>{children}</div>
      </div>
    </div>
  );
}
