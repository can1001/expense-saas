'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import AdminSidebar from './AdminSidebar';
import { Menu } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
