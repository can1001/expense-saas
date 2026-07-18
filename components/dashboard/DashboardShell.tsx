'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Sidebar from '@/components/layout/Sidebar';
import SidebarUserCard from '@/components/layout/SidebarUserCard';
import TopbarBell from '@/components/layout/TopbarBell';
import TopbarUserMenu, { TopbarUserMenuUser } from '@/components/layout/TopbarUserMenu';
import TenantSwitcher, { useMemberships } from '@/components/TenantSwitcher';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { getGlobalSidebarMenu } from '@/lib/constants/global-menu';
import { canAccessApprovalMenu } from '@/lib/constants/menu-permissions';
import { usePendingApprovalCount } from '@/hooks/usePendingApprovalCount';
import { apiBase } from '@/lib/api/api-base';

interface DashboardShellUser {
  roles: string[];
  isBudgetManager?: boolean;
}

interface DashboardShellProps {
  user: DashboardShellUser;
}

/**
 * 관리 권한 사용자의 홈 — 전역 딥그린 사이드바 + 회계 대시보드
 * (docs/SPEC_DASHBOARD_PHASE2_2026-07-18.md 3절, 태스크 P3)
 */
export default function DashboardShell({ user }: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [topbarUser, setTopbarUser] = useState<TopbarUserMenuUser | null>(null);
  const [isTenantSwitcherOpen, setIsTenantSwitcherOpen] = useState(false);

  const canApprove =
    user.roles.some((role) => canAccessApprovalMenu(role)) || user.isBudgetManager === true;
  const { count: pendingApprovalCount } = usePendingApprovalCount({ enabled: canApprove });

  const sidebarConfig = getGlobalSidebarMenu(user, { pendingApprovalCount });

  // 탑바 사용자 메뉴용 상세 정보 — 기존 Header.tsx와 동일한 fetch 패턴 재사용
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${apiBase('auth')}/auth/me`);
        const data = await response.json();
        if (response.ok && data.user) {
          setTopbarUser(data.user);
        }
      } catch {
        setTopbarUser(null);
      }
    };
    fetchUser();
  }, []);

  const { memberships } = useMemberships(!!topbarUser);
  const canSwitchTenant = memberships.length > 1;

  return (
    <AppShell
      title="회계 대시보드"
      onOpenMobileMenu={() => setIsSidebarOpen(true)}
      actions={
        <Link
          href="/expenses/new"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800"
        >
          + 지출결의서 작성
        </Link>
      }
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
      <DashboardClient />
      <TenantSwitcher
        isOpen={isTenantSwitcherOpen}
        onClose={() => setIsTenantSwitcherOpen(false)}
        memberships={memberships}
      />
    </AppShell>
  );
}
