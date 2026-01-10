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
    title: '조직',
    items: [
      { href: '/admin/committees', label: '위원회 관리', icon: Building2 },
      { href: '/admin/departments', label: '사역팀(부) 관리', icon: Users2 },
      { href: '/admin/leaders-upload', label: '팀장 일괄 등록', icon: Upload },
    ],
  },
  {
    title: '사용자',
    items: [
      { href: '/admin/users', label: '사용자 관리', icon: Users },
      { href: '/admin/users-upload', label: '사용자 일괄 등록', icon: Upload },
      { href: '/admin/year-roles', label: '연도별 역할 관리', icon: CalendarCog },
      { href: '/admin/roles', label: '역할 안내', icon: Shield },
    ],
  },
  {
    title: '예산',
    items: [
      { href: '/admin/budget-upload', label: '예산 마스터 관리', icon: FileSpreadsheet },
      { href: '/admin/budget-managers', label: '세목별 담당자 관리', icon: UserCog },
      { href: '/admin/memo-examples', label: '적요 예제 관리', icon: FileText },
      { href: '/admin/budget-view', label: '예산 현황 조회', icon: Eye },
    ],
  },
  {
    title: '현황',
    items: [
      { href: '/admin/year-roles-summary', label: '연도별 팀장 현황', icon: BarChart3 },
    ],
  },
];
