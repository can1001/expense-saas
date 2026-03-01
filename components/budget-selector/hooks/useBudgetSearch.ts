'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface BudgetSearchResult {
  id: string;
  detail: string;
  subcategory: string;
  category: string;
  fullPath: string;
  managerId: string | null;
  managerName: string | null;
  hierarchy: {
    committee: string;
    department: string;
    category: string;
    subcategory: string;
    detail: string;
  };
}

interface UseBudgetSearchOptions {
  departmentId?: string;
  year?: number;
  limit?: number;
  debounceMs?: number;
}

interface UseBudgetSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: BudgetSearchResult[];
  isLoading: boolean;
  error: string | null;
  clearResults: () => void;
}

export function useBudgetSearch(options: UseBudgetSearchOptions = {}): UseBudgetSearchReturn {
  const {
    departmentId,
    year = new Date().getFullYear(),
    limit = 20,
    debounceMs = 300,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BudgetSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 빈 검색어면 결과 초기화
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        year: year.toString(),
        limit: limit.toString(),
      });

      if (departmentId) {
        params.set('departmentId', departmentId);
      }

      const response = await fetch(`/api/budget/search?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('검색 중 오류가 발생했습니다.');
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 요청이 취소된 경우 무시
        return;
      }
      setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [departmentId, year, limit]);

  // Debounced 검색
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      search(query);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, search, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const clearResults = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearResults,
  };
}
