'use client';

import React from 'react';
import { FLEX_CENTER, SPINNER_LG } from '@/lib/constants/styles';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingState({
  message = '로딩 중...',
  fullScreen = true,
}: LoadingStateProps) {
  const containerClass = fullScreen
    ? `min-h-screen ${FLEX_CENTER}`
    : FLEX_CENTER;

  return (
    <div className={containerClass}>
      <div className="text-center">
        <div className={`${SPINNER_LG} mx-auto mb-4`}></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
