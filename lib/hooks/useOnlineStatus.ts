'use client';

import { useState, useEffect, useCallback } from 'react';

interface NetworkInfo {
  effectiveType?: string;  // '4g', '3g', '2g', 'slow-2g'
  downlink?: number;       // 예상 대역폭 (Mbps)
  rtt?: number;            // Round-Trip Time (ms)
  saveData?: boolean;      // 데이터 절약 모드
}

interface UseOnlineStatusReturn {
  /** 현재 온라인 상태 */
  isOnline: boolean;

  /** 이전에 오프라인이었다가 복귀했는지 */
  wasOffline: boolean;

  /** 네트워크 정보 (지원하는 브라우저만) */
  networkInfo: NetworkInfo;

  /** 네트워크 상태가 변경되었을 때 호출되는 콜백 등록 */
  onStatusChange: (callback: (isOnline: boolean) => void) => () => void;
}

/**
 * 네트워크 온라인/오프라인 상태를 감지하는 훅
 *
 * @example
 * const { isOnline, wasOffline, networkInfo } = useOnlineStatus();
 *
 * if (!isOnline) {
 *   return <OfflineBanner />;
 * }
 *
 * if (wasOffline) {
 *   // 오프라인에서 복귀함 - 동기화 필요
 *   syncData();
 * }
 */
export function useOnlineStatus(): UseOnlineStatusReturn {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // SSR에서는 기본값 true
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({});
  const [listeners] = useState<Set<(isOnline: boolean) => void>>(new Set());

  // 네트워크 정보 업데이트
  const updateNetworkInfo = useCallback(() => {
    if (typeof navigator === 'undefined') return;

    // Network Information API (Chrome, Edge, Opera 지원)
    const connection = (navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    }).connection;

    if (connection) {
      setNetworkInfo({
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      });
    }
  }, []);

  // 온라인 이벤트 핸들러
  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setWasOffline(true);
    updateNetworkInfo();

    // 등록된 리스너들 호출
    listeners.forEach((callback) => callback(true));

    console.log('[Network] 온라인 상태로 전환됨');
  }, [listeners, updateNetworkInfo]);

  // 오프라인 이벤트 핸들러
  const handleOffline = useCallback(() => {
    setIsOnline(false);

    // 등록된 리스너들 호출
    listeners.forEach((callback) => callback(false));

    console.log('[Network] 오프라인 상태로 전환됨');
  }, [listeners]);

  // 상태 변경 콜백 등록
  const onStatusChange = useCallback(
    (callback: (isOnline: boolean) => void) => {
      listeners.add(callback);

      // cleanup 함수 반환
      return () => {
        listeners.delete(callback);
      };
    },
    [listeners]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 초기 네트워크 정보 설정
    updateNetworkInfo();

    // 이벤트 리스너 등록
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API 이벤트 (지원하는 브라우저만)
    const connection = (navigator as Navigator & {
      connection?: EventTarget & {
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      };
    }).connection;

    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
    };
  }, [handleOnline, handleOffline, updateNetworkInfo]);

  // wasOffline 플래그 리셋 (5초 후)
  useEffect(() => {
    if (wasOffline) {
      const timer = setTimeout(() => {
        setWasOffline(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [wasOffline]);

  return {
    isOnline,
    wasOffline,
    networkInfo,
    onStatusChange,
  };
}

export default useOnlineStatus;
