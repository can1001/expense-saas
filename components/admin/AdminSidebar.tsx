'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_SIDEBAR_MENU } from '@/lib/constants/admin-menu';

export default function AdminSidebar() {
  const pathname = usePathname();

  // 현재 경로가 메뉴 항목과 일치하는지 확인 (하위 경로 포함)
  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 bg-white border-r border-gray-200 min-h-screen flex-shrink-0">
      {/* 홈 링크 */}
      <div className="p-4 border-b border-gray-200">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <Home className="w-4 h-4" />
          <span className="text-sm font-medium">홈으로</span>
        </Link>
      </div>

      {/* 메뉴 그룹 */}
      <nav className="p-4">
        {ADMIN_SIDEBAR_MENU.map((group) => (
          <div key={group.title} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        active
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
