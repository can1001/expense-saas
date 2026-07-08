'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Shield, Building2, Users, LogOut, BarChart3, Menu, X } from 'lucide-react';

interface AdminInfo {
  id: string;
  email: string;
  name: string;
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 로그인 페이지는 인증 체크 제외
  const isLoginPage = pathname === '/platform/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/platform/auth/me');
        if (response.ok) {
          const data = await response.json();
          setAdmin(data.admin);
        } else {
          router.push('/platform/login');
        }
      } catch {
        router.push('/platform/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router, isLoginPage]);

  const handleLogout = async () => {
    try {
      await fetch('/api/platform/auth/logout', { method: 'POST' });
      router.push('/platform/login');
    } catch {
      // 에러 무시
    }
  };

  // 로그인 페이지는 레이아웃 없이 렌더링
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 인증 안됨
  if (!admin) {
    return null;
  }

  const navItems = [
    { href: '/platform/dashboard', label: '대시보드', icon: BarChart3 },
    { href: '/platform/tenants', label: '테넌트 관리', icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 모바일 사이드바 오버레이 */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white transform transition-transform duration-300 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* 로고 */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-indigo-400" />
              <span className="text-lg font-bold">Platform Admin</span>
            </div>
            <button
              className="lg:hidden p-2 text-slate-400 hover:text-white"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 네비게이션 */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* 하단 사용자 정보 */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{admin.name}</p>
                <p className="text-xs text-slate-400">{admin.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <div className="lg:pl-64">
        {/* 모바일 헤더 */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              <span className="font-bold text-gray-900">Platform Admin</span>
            </div>
            <div className="w-10" /> {/* 균형을 위한 공간 */}
          </div>
        </header>

        {/* 페이지 컨텐츠 */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
