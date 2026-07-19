'use client';

import Link from 'next/link';
import GlobalShell from '@/components/layout/GlobalShell';
import DashboardClient from '@/components/dashboard/DashboardClient';

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
  return (
    <GlobalShell
      title="회계 대시보드"
      user={user}
      actions={
        <Link
          href="/expenses/new"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800"
        >
          + 지출결의서 작성
        </Link>
      }
    >
      <DashboardClient />
    </GlobalShell>
  );
}
