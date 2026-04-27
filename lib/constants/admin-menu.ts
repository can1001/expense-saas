/**
 * 어드민 사이드바 메뉴 구조 정의
 *
 * 7개 그룹 (업무 흐름 기반 IA 재설계):
 * 대시보드 / 조직 관리 / 예산 관리 / 수입 관리 / 지출 관리 / 결산 관리 / 시스템 설정
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
  Bell,
  PieChart,
  HandCoins,
  Settings,
  GitBranch,
  AlertTriangle,
  TrendingUp,
  Wallet,
  ListTree,
  LucideIcon,
  Calendar,
  CalendarDays,
  CalendarRange,
  FileBarChart,
  CreditCard,
  ClipboardList,
  Clock,
  Banknote,
  Receipt,
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
      { href: '/admin', label: '재정 현황', icon: LayoutDashboard },
    ],
  },
  {
    title: '조직 관리',
    items: [
      { href: '/admin/org/committees', label: '위원회 관리', icon: Building2 },
      { href: '/admin/org/departments', label: '사역팀(부) 관리', icon: Users2 },
      { href: '/admin/org/users', label: '사용자 관리', icon: Users },
      { href: '/admin/org/users-upload', label: '사용자 일괄 등록', icon: Upload },
      { href: '/admin/org/roles', label: '역할 관리', icon: Shield },
      { href: '/admin/org/year-roles', label: '연도별 역할 설정', icon: CalendarCog },
      { href: '/admin/org/leaders-upload', label: '팀장 일괄 등록', icon: Upload },
      { href: '/admin/org/year-roles-summary', label: '팀장 현황', icon: BarChart3 },
    ],
  },
  {
    title: '예산 관리',
    items: [
      { href: '/admin/budget/wizard', label: '설정 마법사', icon: Wand2 },
      { href: '/admin/budget/upload', label: '예산 마스터 업로드', icon: FileSpreadsheet },
      { href: '/admin/budget/items', label: '예산 항목 관리', icon: ListTree },
      { href: '/admin/budget/managers', label: '세목별 담당자', icon: UserCog },
      { href: '/admin/budget/memo-examples', label: '적요 예제 관리', icon: FileText },
      { href: '/admin/budget/year-setup-status', label: '설정 완료 현황', icon: CheckCircle },
      { href: '/admin/budget/view', label: '예산 현황 조회', icon: Eye },
    ],
  },
  {
    title: '수입 관리',
    items: [
      { href: '/admin/income/offerings', label: '헌금 관리', icon: HandCoins },
      { href: '/admin/income/status', label: '수입 현황', icon: TrendingUp },
    ],
  },
  {
    title: '지출 관리',
    items: [
      { href: '/admin/expense/list', label: '지출결의서 목록', icon: ClipboardList },
      { href: '/admin/expense/pending', label: '결재 대기', icon: Clock },
      { href: '/admin/expense/payment', label: '지급 처리', icon: Banknote },
      { href: '/admin/expense/status', label: '지출 현황', icon: Receipt },
      { href: '/admin/expense/execution', label: '사역비 집행 현황', icon: PieChart },
      { href: '/admin/expense/hr-admin', label: '인사/행정비 현황', icon: BarChart3 },
    ],
  },
  {
    title: '결산 관리',
    items: [
      { href: '/admin/settlement/monthly', label: '월별 결산', icon: Calendar },
      { href: '/admin/settlement/quarterly', label: '분기별 결산', icon: CalendarDays },
      { href: '/admin/settlement/annual', label: '연간 결산', icon: CalendarRange },
      { href: '/admin/settlement/quarterly-report', label: '분기별 회계보고', icon: BarChart3 },
      { href: '/admin/settlement/cumulative', label: '분기별 누적 현황', icon: TrendingUp },
      { href: '/admin/settlement/report', label: '재정보고서', icon: FileBarChart },
    ],
  },
  {
    title: '시스템 설정',
    items: [
      { href: '/admin/settings/approval-rules', label: '결재라인 규칙', icon: GitBranch },
      { href: '/admin/settings/manager-exceptions', label: '담당자 예외 현황', icon: AlertTriangle },
      { href: '/admin/settings/system', label: '시스템 설정', icon: Settings },
      { href: '/admin/settings/notifications', label: '알림 발송', icon: Bell },
    ],
  },
];

// 기존 URL -> 새 URL 매핑 (리다이렉트용)
export const ADMIN_URL_REDIRECTS: Record<string, string> = {
  '/admin/committees': '/admin/org/committees',
  '/admin/departments': '/admin/org/departments',
  '/admin/users': '/admin/org/users',
  '/admin/users-upload': '/admin/org/users-upload',
  '/admin/roles': '/admin/org/roles',
  '/admin/year-roles': '/admin/org/year-roles',
  '/admin/leaders-upload': '/admin/org/leaders-upload',
  '/admin/year-roles-summary': '/admin/org/year-roles-summary',
  '/admin/budget-wizard': '/admin/budget/wizard',
  '/admin/budget-upload': '/admin/budget/upload',
  '/admin/budget-items': '/admin/budget/items',
  '/admin/budget-managers': '/admin/budget/managers',
  '/admin/memo-examples': '/admin/budget/memo-examples',
  '/admin/year-setup-status': '/admin/budget/year-setup-status',
  '/admin/budget-view': '/admin/budget/view',
  '/admin/offerings': '/admin/income/offerings',
  '/admin/budget-execution': '/admin/expense/execution',
  '/admin/hr-admin-execution': '/admin/expense/hr-admin',
  '/admin/quarterly-report': '/admin/settlement/quarterly-report',
  '/admin/cumulative-report': '/admin/settlement/cumulative',
  '/admin/account-report': '/admin/settlement/report',
  '/admin/approval-rules': '/admin/settings/approval-rules',
  '/admin/manager-exceptions': '/admin/settings/manager-exceptions',
  '/admin/settings': '/admin/settings/system',
  '/admin/notifications': '/admin/settings/notifications',
};
