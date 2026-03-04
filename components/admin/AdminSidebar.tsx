'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_SIDEBAR_MENU } from '@/lib/constants/admin-menu';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminSidebar({ isOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  // 현재 경로가 메뉴 항목과 일치하는지 확인 (하위 경로 포함)
  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // 페이지 변경 시 드로어 닫기
  useEffect(() => {
    if (onClose) onClose();
  }, [pathname, onClose]);

  const sidebarContent = (
    <>
      {/* 헤더 (모바일에서만 닫기 버튼 표시) */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <Home className="w-4 h-4" />
          <span className="text-sm font-medium">홈으로</span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 메뉴 그룹 */}
      <nav className="p-4 overflow-y-auto flex-1">
        {ADMIN_SIDEBAR_MENU.map((group) => (
          <div key={group.title} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors min-h-[44px]',
                        active
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* 모바일 오버레이 */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 lg:hidden',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* 모바일 드로어 사이드바 */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-xl transform transition-transform duration-300 ease-out lg:hidden flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* 데스크톱 고정 사이드바 */}
      <aside className="hidden lg:flex lg:flex-col w-60 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] flex-shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}
