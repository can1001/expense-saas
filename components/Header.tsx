'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, CheckSquare, Home } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === '/';

  const navItems = [
    {
      href: '/expenses',
      label: '지출결의서',
      icon: FileText,
      active: pathname.startsWith('/expenses'),
    },
    {
      href: '/approvals',
      label: '결재함',
      icon: CheckSquare,
      active: pathname.startsWith('/approvals'),
    },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
            >
              <Home className="w-6 h-6" />
              <span className="hidden sm:inline">지출결의서 관리</span>
            </Link>

            {/* 메인 네비게이션 */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                      item.active
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* 오른쪽 영역 (추후 사용자 정보 등) */}
          <div className="flex items-center gap-4">
            {isHome && (
              <Link
                href="/expenses"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                시작하기
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

