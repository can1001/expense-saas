/**
 * 어드민 사이드바 메뉴 구조 정의
 */

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
  FileText,
  LayoutDashboard,
  Wand2,
  CheckCircle,
  LucideIcon,
} from 'lucide-react';

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

export const ADMIN_SIDEBAR_MENU: SidebarGroup[] = [
  {
    title: '대시보드',
    items: [
      { href: '/admin', label: '홈', icon: LayoutDashboard },
    ],
  },
  {
    title: '연도 설정',
    items: [
      { href: '/admin/budget-wizard', label: '설정 마법사', icon: Wand2 },
      { href: '/admin/committees', label: '위원회 관리', icon: Building2 },
      { href: '/admin/departments', label: '사역팀(부) 관리', icon: Users2 },
      { href: '/admin/budget-upload', label: '예산 마스터 업로드', icon: FileSpreadsheet },
    ],
  },
  {
    title: '인원 관리',
    items: [
      { href: '/admin/users', label: '사용자 관리', icon: Users },
      { href: '/admin/users-upload', label: '사용자 일괄 등록', icon: Upload },
      { href: '/admin/leaders-upload', label: '팀장 일괄 등록', icon: Upload },
      { href: '/admin/year-roles', label: '연도별 역할 관리', icon: CalendarCog },
    ],
  },
  {
    title: '예산 관리',
    items: [
      { href: '/admin/budget-managers', label: '세목별 담당자 관리', icon: UserCog },
      { href: '/admin/memo-examples', label: '적요 예제 관리', icon: FileText },
      { href: '/admin/budget-view', label: '예산 현황 조회', icon: Eye },
    ],
  },
  {
    title: '현황/리포트',
    items: [
      { href: '/admin/year-setup-status', label: '연도별 설정 현황', icon: CheckCircle },
      { href: '/admin/year-roles-summary', label: '연도별 팀장 현황', icon: BarChart3 },
      { href: '/admin/roles', label: '역할 안내', icon: Shield },
    ],
  },
];
