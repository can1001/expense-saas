'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 결재함 대기 건수 등 뱃지 (0이면 숨김) */
  badgeCount?: number;
}

export interface SidebarGroup {
  /** admin 컨텍스트의 그룹 타이틀. 전역은 title 없는 단일 그룹 */
  title?: string;
  items: SidebarItem[];
}

export interface SidebarConfig {
  variant: 'global' | 'admin';
  /** admin 컨텍스트 상단 백링크 (예: "← 홈으로") */
  backLink?: { href: string; label: string };
  groups: SidebarGroup[];
}

interface SidebarProps {
  config: SidebarConfig;
  /** 모바일 드로어 열림 상태 */
  isOpen?: boolean;
  onClose?: () => void;
  /** 상단 로고/브랜드 슬롯 */
  header?: ReactNode;
  /** 하단 사용자 카드 슬롯 */
  footer?: ReactNode;
}

/** 현재 경로 활성 판정 — /admin은 정확일치, 그 외는 하위 경로 포함 (기존 AdminSidebar 규칙 유지) */
function isActivePath(pathname: string, href: string): boolean {
  if (href === '/admin' || href === '/') {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * 공용 사이드바 — 딥그린 (docs/DESIGN_SYSTEM_2026-07-18.md 5절)
 * 메뉴 config 주입형: 전역(AppShell)과 관리자(/admin) 컨텍스트가 같은 컴포넌트를 사용한다.
 * 데스크톱(lg+)은 고정 240px, 모바일은 오버레이 드로어(ESC·페이지 이동 시 닫힘).
 */
export default function Sidebar({ config, isOpen = false, onClose, header, footer }: SidebarProps) {
  const pathname = usePathname();

  // ESC 키로 드로어 닫기 + 열림 중 배경 스크롤 잠금 (기존 AdminSidebar 동작 이식)
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
      {(header || config.backLink || onClose) && (
        <div className="flex items-center justify-between gap-2 border-b border-brand-900 p-4">
          {header}
          {config.backLink && (
            <Link
              href={config.backLink.href}
              className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-side-dim transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{config.backLink.label}</span>
            </Link>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-side-dim transition-colors hover:bg-brand-900 hover:text-white lg:hidden"
              aria-label="메뉴 닫기"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-3">
        {config.groups.map((group, groupIndex) => (
          <div key={group.title ?? groupIndex} className="mb-5 last:mb-0">
            {group.title && (
              <h3 className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-side-dim">
                {group.title}
              </h3>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                        active
                          ? 'bg-brand-900 font-semibold text-white shadow-[inset_3px_0_0_var(--color-brand-500)]'
                          : 'text-side-text hover:bg-brand-900 hover:text-white'
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {item.badgeCount != null && item.badgeCount > 0 && (
                        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                          {item.badgeCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {footer && <div className="border-t border-brand-900 p-3">{footer}</div>}
    </>
  );

  return (
    <>
      {/* 모바일 오버레이 */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      {/* 모바일 드로어 */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full w-72 transform flex-col bg-brand-950 shadow-xl transition-transform duration-300 ease-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* 데스크톱 고정 사이드바 */}
      <aside className="hidden w-60 flex-shrink-0 bg-brand-950 lg:flex lg:flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}
