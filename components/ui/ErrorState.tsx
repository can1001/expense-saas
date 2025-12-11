'use client';

import React from 'react';
import { FLEX_CENTER, BTN_PRIMARY } from '@/lib/constants/styles';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  fullScreen?: boolean;
}

export default function ErrorState({
  title = '오류가 발생했습니다',
  message,
  onRetry,
  retryLabel = '다시 시도',
  fullScreen = true,
}: ErrorStateProps) {
  const containerClass = fullScreen
    ? `min-h-screen ${FLEX_CENTER}`
    : FLEX_CENTER;

  return (
    <div className={containerClass}>
      <div className="text-center">
        <div className="text-red-500 text-5xl mb-4">!</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-600 mb-4">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className={BTN_PRIMARY}>
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
