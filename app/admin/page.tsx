'use client';

import Link from 'next/link';
import { Users, FileSpreadsheet, Upload, Settings } from 'lucide-react';
import { SECTION_CARD } from '@/lib/constants/styles';

interface AdminMenuItem {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const menuItems: AdminMenuItem[] = [
  {
    href: '/admin/users',
    title: '사용자 관리',
    description: '사용자 목록 조회, 추가, 수정, 비활성화',
    icon: Users,
    color: 'bg-blue-500',
  },
  {
    href: '/admin/users-upload',
    title: '사용자 일괄 등록',
    description: 'Excel 파일로 사용자 일괄 등록/수정',
    icon: Upload,
    color: 'bg-green-500',
  },
  {
    href: '/admin/budget-upload',
    title: '예산 마스터 관리',
    description: 'Excel 파일로 예산 항목 일괄 등록/수정',
    icon: FileSpreadsheet,
    color: 'bg-purple-500',
  },
];

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-gray-700" />
          <h1 className="text-2xl font-bold">관리</h1>
        </div>
        <p className="text-gray-600">시스템 관리 기능을 선택하세요.</p>
      </div>

      {/* 메뉴 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${SECTION_CARD} hover:shadow-md transition-shadow group`}
            >
              <div className="flex items-start gap-4">
                <div className={`${item.color} p-3 rounded-lg text-white group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {item.title}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
