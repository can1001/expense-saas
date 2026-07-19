'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Sidebar from '@/components/layout/Sidebar';
import SidebarUserCard from '@/components/layout/SidebarUserCard';
import TopbarBell from '@/components/layout/TopbarBell';
import TopbarUserMenu, { TopbarUserMenuUser } from '@/components/layout/TopbarUserMenu';
import TenantSwitcher, { useMemberships } from '@/components/TenantSwitcher';
import { getGlobalSidebarMenu } from '@/lib/constants/global-menu';
import { canAccessApprovalMenu } from '@/lib/constants/menu-permissions';
import { usePendingApprovalCount } from '@/hooks/usePendingApprovalCount';
import { apiBase } from '@/lib/api/api-base';

export interface GlobalShellUser {
  roles: string[];
  isBudgetManager?: boolean;
}

interface GlobalShellProps {
  /** 탑바 타이틀 */
  title: string;
  /** 탑바 우측 액션 슬롯 (CTA 버튼 등) */
  actions?: ReactNode;
  /**
   * 사이드바 권한 파생용 사용자 정보. 서버에서 이미 조회한 값(예: isBudgetManager)이
   * 있으면 전달한다 — 생략 시 `/auth/me` 응답의 roles로 파생한다.
   */
  user?: GlobalShellUser;
  children: ReactNode;
}

/**
 * GlobalShell — 전역 딥그린 사이드바 + 탑바 + 사용자 fetch (DashboardShell 일반화)
 * (docs/SPEC_HEADER_CUTOVER_PHASE4_2026-07-20.md 2.1절)
 */
export default function GlobalShell({ title, actions, user, children }: GlobalShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [topbarUser, setTopbarUser] = useState<TopbarUserMenuUser | null>(null);
  const [fetchedRoles, setFetchedRoles] = useState<string[]>([]);
  const [isTenantSwitcherOpen, setIsTenantSwitcherOpen] = useState(false);

  // 탑바 사용자 메뉴용 상세 정보 — 기존 Header.tsx와 동일한 fetch 패턴 재사용
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${apiBase('auth')}/auth/me`);
        const data = await response.json();
        if (response.ok && data.user) {
          setTopbarUser(data.user);
          setFetchedRoles(
            data.user.roles && data.user.roles.length > 0 ? data.user.roles : [data.user.role]
          );
        }
      } catch {
        setTopbarUser(null);
      }
    };
    fetchUser();
  }, []);

  const effectiveUser: GlobalShellUser = user ?? { roles: fetchedRoles };

  const canApprove =
    effectiveUser.roles.some((role) => canAccessApprovalMenu(role)) ||
    effectiveUser.isBudgetManager === true;
  const { count: pendingApprovalCount } = usePendingApprovalCount({ enabled: canApprove });

  const sidebarConfig = getGlobalSidebarMenu(effectiveUser, { pendingApprovalCount });

  const { memberships } = useMemberships(!!topbarUser);
  const canSwitchTenant = memberships.length > 1;

  return (
    <AppShell
      title={title}
      onOpenMobileMenu={() => setIsSidebarOpen(true)}
      actions={actions}
      topbarExtra={
        <>
          {canSwitchTenant && (
            <button
              onClick={() => setIsTenantSwitcherOpen(true)}
              aria-label="조직 전환"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </button>
          )}
          <TopbarBell />
          {topbarUser && <TopbarUserMenu user={topbarUser} />}
        </>
      }
      sidebar={
        <Sidebar
          config={sidebarConfig}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          footer={<SidebarUserCard />}
        />
      }
    >
      {children}
      <TenantSwitcher
        isOpen={isTenantSwitcherOpen}
        onClose={() => setIsTenantSwitcherOpen(false)}
        memberships={memberships}
      />
    </AppShell>
  );
}
