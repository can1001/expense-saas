'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { useOfflineExpense } from '@/lib/hooks/useOfflineExpense';

interface OfflineBannerProps {
  /** 배너 표시 위치 */
  position?: 'top' | 'bottom';
  /** 동기화 버튼 표시 여부 */
  showSyncButton?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 오프라인 상태 배너 컴포넌트
 * 네트워크 연결 상태와 동기화 대기 항목을 표시합니다.
 */
export function OfflineBanner({
  position = 'top',
  showSyncButton = true,
  className = '',
}: OfflineBannerProps) {
  const { isOnline, wasOffline } = useOnlineStatus();
  const { pendingCount, isSyncing, syncAll, refreshPendingCount } =
    useOfflineExpense();

  const [showReconnected, setShowReconnected] = useState(false);

  // 온라인 복귀 시 알림 표시
  useEffect(() => {
    if (wasOffline && isOnline) {
      setShowReconnected(true);
      refreshPendingCount();

      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline, refreshPendingCount]);

  // 동기화 실행
  const handleSync = async () => {
    if (isSyncing || !isOnline) return;
    await syncAll();
  };

  // 오프라인 상태
  if (!isOnline) {
    return (
      <div
        className={`
          ${position === 'top' ? 'top-0' : 'bottom-0'}
          fixed left-0 right-0 z-50
          bg-amber-500 text-white
          px-4 py-2
          flex items-center justify-center gap-2
          text-sm font-medium
          shadow-md
          ${className}
        `}
      >
        <WifiOff className="w-4 h-4" />
        <span>오프라인 상태입니다. 작성한 내용은 자동으로 저장됩니다.</span>
      </div>
    );
  }

  // 온라인 복귀 알림
  if (showReconnected) {
    return (
      <div
        className={`
          ${position === 'top' ? 'top-0' : 'bottom-0'}
          fixed left-0 right-0 z-50
          bg-green-500 text-white
          px-4 py-2
          flex items-center justify-center gap-2
          text-sm font-medium
          shadow-md
          animate-slide-down
          ${className}
        `}
      >
        <Wifi className="w-4 h-4" />
        <span>인터넷에 연결되었습니다.</span>
        {pendingCount > 0 && (
          <span className="ml-2">
            동기화 대기 중인 항목: {pendingCount}개
          </span>
        )}
      </div>
    );
  }

  // 동기화 대기 항목이 있는 경우
  if (pendingCount > 0) {
    return (
      <div
        className={`
          ${position === 'top' ? 'top-0' : 'bottom-0'}
          fixed left-0 right-0 z-50
          bg-blue-500 text-white
          px-4 py-2
          flex items-center justify-center gap-2
          text-sm font-medium
          shadow-md
          ${className}
        `}
      >
        <CloudOff className="w-4 h-4" />
        <span>동기화 대기 중인 항목: {pendingCount}개</span>
        {showSyncButton && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="
              ml-3 px-3 py-1
              bg-white/20 hover:bg-white/30
              rounded text-xs font-medium
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-1
            "
          >
            <RefreshCw
              className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`}
            />
            {isSyncing ? '동기화 중...' : '지금 동기화'}
          </button>
        )}
      </div>
    );
  }

  // 정상 상태에서는 아무것도 표시하지 않음
  return null;
}

export default OfflineBanner;
