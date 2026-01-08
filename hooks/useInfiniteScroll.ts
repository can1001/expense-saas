'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions<T> {
  fetchFn: (cursor?: string) => Promise<{
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;
  initialData?: T[];
  enabled?: boolean;
}

interface UseInfiniteScrollResult<T> {
  data: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => void;
  refresh: () => void;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
}

export function useInfiniteScroll<T>({
  fetchFn,
  initialData = [],
  enabled = true,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
  const [data, setData] = useState<T[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  const isFetchingRef = useRef(false);

  // 초기 로드
  const loadInitial = useCallback(async () => {
    if (!enabled || isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      setData(result.data);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch'));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [fetchFn, enabled]);

  // 더 불러오기
  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || isFetchingRef.current || !cursor) return;

    isFetchingRef.current = true;
    setIsLoadingMore(true);
    setError(null);

    try {
      const result = await fetchFn(cursor);
      setData(prev => [...prev, ...result.data]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch more'));
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [fetchFn, enabled, hasMore, cursor]);

  // 새로고침
  const refresh = useCallback(() => {
    setCursor(null);
    setHasMore(true);
    loadInitial();
  }, [loadInitial]);

  // 초기 로드 실행
  useEffect(() => {
    if (initialData.length === 0) {
      loadInitial();
    }
  }, [loadInitial, initialData.length]);

  return {
    data,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    setData,
  };
}

// Intersection Observer 기반 무한 스크롤 훅
interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
}

export function useIntersectionObserver(
  callback: () => void,
  options: UseIntersectionObserverOptions = {}
) {
  const { threshold = 0.1, rootMargin = '100px' } = options;
  const targetRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(callback);

  // 콜백 업데이트
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callbackRef.current();
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  return targetRef;
}

// 결합된 훅 - 무한 스크롤 + Intersection Observer
export function useInfiniteScrollWithObserver<T>(
  options: UseInfiniteScrollOptions<T>
) {
  const infiniteScroll = useInfiniteScroll(options);

  const loadMoreRef = useIntersectionObserver(
    () => {
      if (!infiniteScroll.isLoadingMore && infiniteScroll.hasMore) {
        infiniteScroll.loadMore();
      }
    },
    { rootMargin: '200px' }
  );

  return {
    ...infiniteScroll,
    loadMoreRef,
  };
}
