'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Sidebar from '@/components/layout/Sidebar';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { getGlobalSidebarMenu } from '@/lib/constants/global-menu';
import { canAccessApprovalMenu } from '@/lib/constants/menu-permissions';
import { usePendingApprovalCount } from '@/hooks/usePendingApprovalCount';

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

  const canApprove =
    user.roles.some((role) => canAccessApprovalMenu(role)) || user.isBudgetManager === true;
  const { count: pendingApprovalCount } = usePendingApprovalCount({ enabled: canApprove });

  const sidebarConfig = getGlobalSidebarMenu(user, { pendingApprovalCount });

  return (
    <AppShell
      withHeader
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
      sidebar={
        <Sidebar
          config={sidebarConfig}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      }
    >
      <DashboardClient />
    </AppShell>
  );
}
