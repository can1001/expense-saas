'use client';

import Link from 'next/link';
import {
  Building2,
  Users2,
  Users,
  Upload,
  CalendarCog,
  Shield,
  FileSpreadsheet,
  UserCog,
  BarChart3,
  Eye,
  Wand2,
  ClipboardCheck,
  Settings
} from 'lucide-react';

interface QuickLinkItem {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const quickLinks: QuickLinkItem[] = [
  {
    href: '/admin/committees',
    title: '위원회 관리',
    description: '위원회 추가, 수정, 비활성화',
    icon: Building2,
    color: 'bg-cyan-500',
  },
  {
    href: '/admin/departments',
    title: '사역팀(부) 관리',
    description: '위원회별 사역팀 관리',
    icon: Users2,
    color: 'bg-teal-500',
  },
  {
    href: '/admin/budget-wizard',
    title: '예산 등록 마법사',
    description: '위원회 → 사역팀 → 예산 순서로 등록',
    icon: Wand2,
    color: 'bg-violet-500',
  },
  {
    href: '/admin/users',
    title: '사용자 관리',
    description: '사용자 목록 조회, 추가, 수정',
    icon: Users,
    color: 'bg-blue-500',
  },
  {
    href: '/admin/users-upload',
    title: '사용자 일괄 등록',
    description: 'Excel 파일로 사용자 등록',
    icon: Upload,
    color: 'bg-green-500',
  },
  {
    href: '/admin/year-roles',
    title: '연도별 역할 관리',
    description: '연도별 결재 역할 설정',
    icon: CalendarCog,
    color: 'bg-orange-500',
  },
  {
    href: '/admin/roles',
    title: '역할 안내',
    description: '역할별 권한 안내',
    icon: Shield,
    color: 'bg-purple-500',
  },
  {
    href: '/admin/budget-upload',
    title: '예산 마스터 관리',
    description: 'Excel 파일로 예산 항목 등록',
    icon: FileSpreadsheet,
    color: 'bg-indigo-500',
  },
  {
    href: '/admin/budget-managers',
    title: '세목별 담당자 관리',
    description: '예산 세목 담당자 및 예산금액 설정',
    icon: UserCog,
    color: 'bg-pink-500',
  },
  {
    href: '/admin/budget-view',
    title: '예산 현황 조회',
    description: '조직별 예산 세목 현황 조회',
    icon: Eye,
    color: 'bg-emerald-500',
  },
  {
    href: '/admin/year-roles-summary',
    title: '연도별 팀장 현황',
    description: '위원회/사역팀별 팀장 현황',
    icon: BarChart3,
    color: 'bg-amber-500',
  },
  {
    href: '/admin/year-setup-status',
    title: '연도별 설정 현황',
    description: '역할/담당자/예산 설정 완료율 확인',
    icon: ClipboardCheck,
    color: 'bg-red-500',
  },
  {
    href: '/admin/settings',
    title: '시스템 설정',
    description: '출납 서명 필수 여부 등 시스템 설정',
    icon: Settings,
    color: 'bg-gray-500',
  },
];

export default function AdminPage() {
  return (
    <div>
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="text-gray-600 mt-1">시스템 관리 기능을 선택하세요.</p>
      </div>

      {/* 빠른 링크 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow group flex items-start gap-4"
            >
              <div className={`${item.color} p-3 rounded-lg text-white group-hover:scale-110 transition-transform flex-shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
