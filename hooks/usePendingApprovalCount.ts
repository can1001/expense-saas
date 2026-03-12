'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePendingApprovalCountOptions {
  /** 폴링 간격 (ms). 기본값: 60000 (1분) */
  pollingInterval?: number;
  /** 훅 활성화 여부. 기본값: true */
  enabled?: boolean;
}

interface UsePendingApprovalCountReturn {
  /** 결재 대기 건수 */
  count: number;
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 */
  error: Error | null;
  /** 수동으로 건수 갱신 */
  refetch: () => Promise<void>;
}

/**
 * 결재 대기 건수를 조회하고 주기적으로 갱신하는 커스텀 훅
 *
 * @example
 * const { count, loading, refetch } = usePendingApprovalCount({
 *   pollingInterval: 60000,
 *   enabled: !!user,
 * });
 */
export function usePendingApprovalCount(
  options?: UsePendingApprovalCountOptions
): UsePendingApprovalCountReturn {
  const { pollingInterval = 60000, enabled = true } = options || {};

  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const response = await fetch('/api/approvals/pending-count');
      if (response.ok) {
        const data = await response.json();
        setCount(data.count ?? 0);
        setError(null);
      } else {
        throw new Error('Failed to fetch pending count');
      }
    } catch (err) {
      setError(err as Error);
      // 에러 시에도 count는 0으로 유지 (배지 숨김)
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드 및 폴링 설정
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setCount(0);
      return;
    }

    // 초기 로드
    fetchCount();

    // 폴링 설정
    intervalRef.current = setInterval(fetchCount, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, pollingInterval, fetchCount]);

  // 페이지 가시성 변경 시 처리
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 페이지 비활성화 시 폴링 중단
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // 페이지 활성화 시 즉시 갱신 + 폴링 재개
        fetchCount();
        intervalRef.current = setInterval(fetchCount, pollingInterval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, pollingInterval, fetchCount]);

  return {
    count,
    loading,
    error,
    refetch: fetchCount,
  };
}
