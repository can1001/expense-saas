'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftRight } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import AppShell from '@/components/layout/AppShell';
import TopbarBell from '@/components/layout/TopbarBell';
import TopbarUserMenu, { TopbarUserMenuUser } from '@/components/layout/TopbarUserMenu';
import TenantSwitcher, { useMemberships } from '@/components/TenantSwitcher';
import { canAccessAdminMenuPathWithRoles, canAccessAdminMenuWithRoles } from '@/lib/constants/menu-permissions';
import { apiBase } from '@/lib/api/api-base';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [topbarUser, setTopbarUser] = useState<TopbarUserMenuUser | null>(null);
  const [isTenantSwitcherOpen, setIsTenantSwitcherOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // 페이지 접근 권한 확인
  useEffect(() => {
    const checkAuthorization = async () => {
      try {
        const response = await fetch(`${apiBase('auth')}/auth/me`);
        const data = await response.json();

        if (!response.ok || !data.user) {
          router.push('/login');
          return;
        }

        // 사용자의 모든 역할 (다중 역할 지원)
        const userRoles: string[] = data.user.roles || [data.user.role];

        // 관리 메뉴 접근 권한 자체가 없는 경우
        if (!canAccessAdminMenuWithRoles(userRoles)) {
          router.push('/');
          return;
        }

        // 특정 페이지 접근 권한 확인
        const hasAccess = canAccessAdminMenuPathWithRoles(userRoles, pathname);
        if (!hasAccess) {
          router.push('/admin');
          return;
        }

        setTopbarUser(data.user);
        setIsAuthorized(true);
      } catch {
        router.push('/login');
      }
    };

    checkAuthorization();
  }, [pathname, router]);

  const { memberships } = useMemberships(!!topbarUser);
  const canSwitchTenant = memberships.length > 1;

  // 권한 확인 중 로딩
  if (isAuthorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-bg">
        <div className="text-gray-500">권한 확인 중...</div>
      </div>
    );
  }

  return (
    <AppShell
      title="관리"
      onOpenMobileMenu={() => setIsSidebarOpen(true)}
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
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
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
