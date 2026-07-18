'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import AdminSidebar from './AdminSidebar';
import AppShell from '@/components/layout/AppShell';
import { canAccessAdminMenuPathWithRoles, canAccessAdminMenuWithRoles } from '@/lib/constants/menu-permissions';
import { apiBase } from '@/lib/api/api-base';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
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

        setIsAuthorized(true);
      } catch {
        router.push('/login');
      }
    };

    checkAuthorization();
  }, [pathname, router]);

  // 권한 확인 중 로딩
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-surface-bg">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-gray-500">권한 확인 중...</div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      withHeader
      title="관리"
      onOpenMobileMenu={() => setIsSidebarOpen(true)}
      sidebar={
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      }
    >
      {children}
    </AppShell>
  );
}
