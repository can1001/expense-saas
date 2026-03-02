'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseSystemSettingReturn<T> {
  value: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * 시스템 설정 값을 가져오는 훅
 * @param key 설정 키
 * @param defaultValue 기본값 (설정이 없을 때)
 */
export function useSystemSetting<T = unknown>(
  key: string,
  defaultValue: T | null = null
): UseSystemSettingReturn<T> {
  const [value, setValue] = useState<T | null>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSetting = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/settings?key=${encodeURIComponent(key)}`);

      if (!response.ok) {
        throw new Error('설정을 불러올 수 없습니다.');
      }

      const data = await response.json();
      setValue(data.value ?? defaultValue);
    } catch (err) {
      console.error('Failed to fetch system setting:', err);
      setError(err instanceof Error ? err.message : '설정을 불러오는 중 오류가 발생했습니다.');
      setValue(defaultValue);
    } finally {
      setIsLoading(false);
    }
  }, [key, defaultValue]);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  return { value, isLoading, error, refetch: fetchSetting };
}

/**
 * 출납 서명 필수 여부 설정을 가져오는 훅
 */
export function usePaymentSignatureRequired(): UseSystemSettingReturn<boolean> {
  return useSystemSetting<boolean>('paymentSignatureRequired', false);
}
