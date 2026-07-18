'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, LogOut } from 'lucide-react';
import { apiBase } from '@/lib/api/api-base';

interface SidebarUserInfo {
  username: string;
  userid: string;
  email?: string;
}

/**
 * 전역 사이드바 footer 슬롯용 사용자 카드 (docs/SPEC_DASHBOARD_PHASE2_2026-07-18.md, 태스크 P4)
 * `Header.tsx`의 `/auth/me` 조회·로그아웃 패턴을 그대로 따른다.
 */
export default function SidebarUserCard() {
  const router = useRouter();
  const [user, setUser] = useState<SidebarUserInfo | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${apiBase('auth')}/auth/me`);
        const data = await response.json();
        if (response.ok && data.user) {
          setUser(data.user);
        }
      } catch {
        setUser(null);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('keydown', handleEsc);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    try {
      await fetch(`${apiBase('auth')}/auth/logout`, { method: 'POST' });
      router.push('/login');
    } catch {
      // 에러 처리
    }
  };

  if (!user) return null;

  const initial = user.username.charAt(0);
  const secondaryText = user.email || user.userid;

  return (
    <div className="relative" ref={cardRef}>
      {isMenuOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-full rounded-lg border border-brand-900 bg-brand-950 py-1 shadow-lg">
          <Link
            href="/mypage"
            onClick={() => setIsMenuOpen(false)}
            className="flex min-h-[44px] items-center gap-2 px-3 text-sm text-side-text transition-colors hover:bg-brand-900 hover:text-white"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            마이페이지
          </Link>
          <button
            onClick={() => {
              setIsMenuOpen(false);
              handleLogout();
            }}
            className="flex min-h-[44px] w-full items-center gap-2 px-3 text-sm text-side-text transition-colors hover:bg-brand-900 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            로그아웃
          </button>
        </div>
      )}
      <button
        onClick={() => setIsMenuOpen((open) => !open)}
        aria-expanded={isMenuOpen}
        className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-brand-900"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{user.username}</span>
          <span className="block truncate text-xs text-side-dim">{secondaryText}</span>
        </span>
      </button>
    </div>
  );
}
