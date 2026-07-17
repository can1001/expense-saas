'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import AdminSidebar from './AdminSidebar';
import { Menu } from 'lucide-react';
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-gray-500">권한 확인 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* 모바일 상단 바 (햄버거 메뉴) */}
      <div className="lg:hidden sticky top-16 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="관리 메뉴 열기"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-medium text-gray-900">관리</span>
      </div>

      <div className="flex">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 p-4 sm:p-6 overflow-auto min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
