/**
 * 현재 로그인 사용자 정보를 가져오는 훅
 *
 * /api/auth/me 호출하여 사용자 정보를 반환합니다.
 * 새 지출결의서 작성 시 청구인 이름 자동 입력에 사용됩니다.
 */

'use client';

import { useEffect, useState } from 'react';
import { User } from '@/lib/types';

interface UseFetchCurrentUserOptions {
  /** 수정 모드인 경우 skip */
  skip?: boolean;
  /** 사용자 정보 로드 후 콜백 */
  onSuccess?: (user: User) => void;
}

interface UseFetchCurrentUserResult {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useFetchCurrentUser(
  options: UseFetchCurrentUserOptions = {}
): UseFetchCurrentUserResult {
  const { skip = false, onSuccess } = options;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skip) return;

    const fetchCurrentUser = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setUser(data.user);
            onSuccess?.(data.user);
          }
        }
      } catch {
        // 로그인되지 않은 경우 무시
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps

  return { user, loading, error };
}

export default useFetchCurrentUser;
