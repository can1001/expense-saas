'use client';

import { useEffect, useState, useCallback } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { useOfflineExpense } from '@/lib/hooks/useOfflineExpense';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

interface SyncStatusIndicatorProps {
  /** 텍스트 표시 여부 */
  showText?: boolean;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 동기화 상태 인디케이터
 * 현재 동기화 상태를 시각적으로 표시합니다.
 */
export function SyncStatusIndicator({
  showText = true,
  size = 'md',
  className = '',
}: SyncStatusIndicatorProps) {
  const { isOnline, wasOffline } = useOnlineStatus();
  const { pendingCount, isSyncing, syncAll } = useOfflineExpense();

  const [status, setStatus] = useState<SyncStatus>('idle');

  // 동기화 실행
  const handleSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setStatus('syncing');

    try {
      const results = await syncAll();
      const hasError = results.some((r) => !r.success);

      if (hasError) {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [isOnline, isSyncing, syncAll]);

  // 상태 업데이트
  useEffect(() => {
    if (!isOnline) {
      setStatus('offline');
    } else if (isSyncing) {
      setStatus('syncing');
    } else if (pendingCount > 0) {
      setStatus('idle');
    } else {
      setStatus('idle');
    }
  }, [isOnline, isSyncing, pendingCount]);

  // 온라인 복귀 시 자동 동기화
  useEffect(() => {
    if (wasOffline && isOnline && pendingCount > 0) {
      handleSync();
    }
  }, [wasOffline, isOnline, pendingCount, handleSync]);

  // 아이콘 크기
  const iconSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }[size];

  // 상태별 스타일
  const statusConfig = {
    idle: {
      icon: <Cloud className={iconSize} />,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      text: pendingCount > 0 ? `${pendingCount}개 대기 중` : '동기화됨',
    },
    syncing: {
      icon: <RefreshCw className={`${iconSize} animate-spin`} />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100',
      text: '동기화 중...',
    },
    success: {
      icon: <Check className={iconSize} />,
      color: 'text-green-500',
      bgColor: 'bg-green-100',
      text: '동기화 완료',
    },
    error: {
      icon: <AlertCircle className={iconSize} />,
      color: 'text-red-500',
      bgColor: 'bg-red-100',
      text: '동기화 실패',
    },
    offline: {
      icon: <CloudOff className={iconSize} />,
      color: 'text-amber-500',
      bgColor: 'bg-amber-100',
      text: '오프라인',
    },
  };

  const config = statusConfig[status];

  return (
    <button
      onClick={handleSync}
      disabled={!isOnline || isSyncing || pendingCount === 0}
      className={`
        inline-flex items-center gap-2
        px-3 py-1.5 rounded-full
        ${config.bgColor} ${config.color}
        transition-all duration-200
        disabled:cursor-default
        ${isOnline && pendingCount > 0 && !isSyncing ? 'hover:opacity-80 cursor-pointer' : ''}
        ${className}
      `}
      title={
        isOnline && pendingCount > 0 && !isSyncing
          ? '클릭하여 동기화'
          : undefined
      }
    >
      {config.icon}

      {showText && (
        <span className="text-sm font-medium">{config.text}</span>
      )}

      {pendingCount > 0 && status !== 'syncing' && (
        <span
          className={`
            inline-flex items-center justify-center
            min-w-[20px] h-5 px-1.5
            text-xs font-bold
            bg-white/50 rounded-full
          `}
        >
          {pendingCount}
        </span>
      )}
    </button>
  );
}

export default SyncStatusIndicator;
