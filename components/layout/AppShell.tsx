'use client';

import { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { getFiscalYearLabel } from '@/lib/utils/fiscal-year';

interface AppShellProps {
  /** 사이드바 (AdminSidebar 또는 공용 Sidebar 인스턴스) — 드로어 상태는 호출부가 관리 */
  sidebar: ReactNode;
  /** 탑바 타이틀 (예: "관리", "회계 대시보드") */
  title: string;
  /** 탑바 우측 액션 슬롯 (CTA 버튼 등) */
  actions?: ReactNode;
  /** 탑바 최우측 슬롯 (벨·아바타 메뉴·테넌트 전환 등 — actions 오른쪽에 배치) */
  topbarExtra?: ReactNode;
  /** 모바일 햄버거 클릭 → 사이드바 드로어 열기 */
  onOpenMobileMenu?: () => void;
  children: ReactNode;
}

/**
 * AppShell — 딥그린 사이드바 + 탑바 + 본문 레이아웃
 * (docs/DESIGN_SYSTEM_2026-07-18.md 5절, SPEC T6)
 */
export default function AppShell({
  sidebar,
  title,
  actions,
  topbarExtra,
  onOpenMobileMenu,
  children,
}: AppShellProps) {
  const fiscalYearLabel = getFiscalYearLabel();

  return (
    <div className="min-h-screen bg-surface-bg">
      <div className="flex">
        {sidebar}

        <div className="min-w-0 flex-1">
          {/* 탑바 — 모바일에서는 햄버거 포함 */}
          <div className="sticky top-0 z-20 flex min-h-[56px] items-center gap-3 border-b border-surface-border bg-white px-4 py-2.5 sm:px-6">
            {onOpenMobileMenu && (
              <button
                onClick={onOpenMobileMenu}
                className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden"
                aria-label="메뉴 열기"
              >
                <Menu className="h-6 w-6" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-gray-900">{title}</h1>
              <p className="text-xs text-gray-500">{fiscalYearLabel}</p>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
            {topbarExtra && <div className="flex items-center gap-2">{topbarExtra}</div>}
          </div>

          <main className="min-h-[calc(100vh-56px)] overflow-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
