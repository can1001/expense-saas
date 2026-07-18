'use client';

/**
 * 탑바 사용자 드롭다운 (docs/SPEC_APPROVALS_HEADER_PHASE3_2026-07-19.md, 태스크 H2)
 *
 * `Header.tsx` 데스크톱 사용자 드롭다운과 항목·노출 조건을 1:1 동일하게 유지한다
 * (조직 전환만 예외 — AppShell 탑바에 별도 TenantSwitcher 슬롯으로 배치, H4).
 * 로그아웃은 `useLogout` 공통 훅(H1) 재사용.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Key, PenLine, Bell, Send, History, UserPlus, LogOut, ChevronDown } from 'lucide-react';
import { useRoles } from '@/hooks/useRoles';
import { canShowUserRegisterMenu } from '@/lib/constants/menu-permissions';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';
import { useLogout } from '@/lib/hooks/useLogout';
import QuickUserRegister from '@/components/QuickUserRegister';

export interface TopbarUserMenuUser {
  username: string;
  role: string;
  canRegisterUsers?: boolean;
  roleRef?: { canRegisterUsers?: boolean } | null;
}

interface TopbarUserMenuProps {
  user: TopbarUserMenuUser;
}

export default function TopbarUserMenu({ user }: TopbarUserMenuProps) {
  const handleLogout = useLogout();
  const { getRoleName } = useRoles();
  const [isOpen, setIsOpen] = useState(false);
  const [isUserRegisterOpen, setIsUserRegisterOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const initial = user.username.charAt(0);

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
            {initial}
          </span>
          <span className="hidden sm:inline">{user.username}</span>
          <span className="hidden rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 sm:inline">
            {getRoleName(user.role)}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <Link
              href="/mypage/password"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <Key className="h-4 w-4" />
              비밀번호 변경
            </Link>
            <Link
              href="/mypage/signatures"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <PenLine className="h-4 w-4" />
              서명/도장 관리
            </Link>
            <Link
              href="/mypage/notifications"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <Bell className="h-4 w-4" />
              알림 설정
            </Link>
            <Link
              href="/mypage/notification-history"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <History className="h-4 w-4" />
              알림 히스토리
            </Link>
            {roleHasPermission(user.role, PERMISSIONS.NOTIFICATION_SEND) && (
              <Link
                href="/mypage/send-notification"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                <Send className="h-4 w-4" />
                알림 발송
              </Link>
            )}
            {canShowUserRegisterMenu(user) && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsUserRegisterOpen(true);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <UserPlus className="h-4 w-4" />
                사용자 등록
              </button>
            )}
            <div className="my-1 border-t border-gray-200" />
            <button
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        )}
      </div>

      <QuickUserRegister
        isOpen={isUserRegisterOpen}
        onClose={() => setIsUserRegisterOpen(false)}
      />
    </>
  );
}
