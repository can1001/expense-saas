/**
 * 로그아웃 공통 훅
 *
 * `/auth/logout` POST 후 `/login`으로 이동하는 로직을 훅으로 추출해
 * 사이드바 카드·탑바 사용자 메뉴 등 여러 진입점에서 재사용한다.
 */

'use client';

import { useRouter } from 'next/navigation';
import { apiBase } from '@/lib/api/api-base';

export function useLogout() {
  const router = useRouter();

  return async () => {
    try {
      await fetch(`${apiBase('auth')}/auth/logout`, { method: 'POST' });
      router.push('/login');
    } catch {
      // 에러 처리
    }
  };
}

export default useLogout;
