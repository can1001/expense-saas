/**
 * 어드민 사이드바 메뉴 구조 정의
 *
 * 8개 그룹:
 * 대시보드 / 조직 관리 / 사용자·역할 / 예산 편성 / 결산·실적 / 결재 관리 / 수입 관리 / 시스템
 *
 * 조직 유형(orgType)별 분기:
 * - 라벨: getOrgTerms()로 조직 유형에 맞는 용어 사용 (위원회/본부, 사역팀/팀 등)
 * - 노출: 교회 전용 메뉴(헌금 관리 등)는 CHURCH가 아닌 테넌트에서 숨김
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
} from 'lucide-react';
import { getOrgTerms, isChurchOnlyFeatureVisible } from '@/lib/org-terms';

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

/**
 * 조직 유형에 맞는 어드민 사이드바 메뉴 생성
 * - orgType 미지정 시 교회 기준(기존 동작)
 */
export function getAdminSidebarMenu(orgType?: string | null): SidebarGroup[] {
  const terms = getOrgTerms(orgType);

  const menu: SidebarGroup[] = [
    {
      title: '대시보드',
      items: [
        { href: '/admin', label: '홈', icon: LayoutDashboard },
      ],
    },
    {
      title: '조직 관리',
      items: [
        { href: '/admin/committees', label: `${terms.committee} 관리`, icon: Building2 },
        { href: '/admin/departments', label: `${terms.departmentFull} 관리`, icon: Users2 },
      ],
    },
    {
      title: '사용자/역할',
      items: [
        { href: '/admin/users', label: '사용자 관리', icon: Users },
        { href: '/admin/users-upload', label: '사용자 일괄 등록', icon: Upload },
        { href: '/admin/roles', label: '역할 관리', icon: Shield },
        { href: '/admin/year-roles', label: '연도별 역할 설정', icon: CalendarCog },
        { href: '/admin/leaders-upload', label: '팀장 일괄 등록', icon: Upload },
        { href: '/admin/year-roles-summary', label: '팀장 현황', icon: BarChart3 },
      ],
    },
    {
      title: '예산 편성',
      items: [
        { href: '/admin/budget-wizard', label: '설정 마법사', icon: Wand2 },
        { href: '/admin/budget-upload', label: '예산 마스터 업로드', icon: FileSpreadsheet },
        { href: '/admin/budget-items', label: '예산 항목 관리', icon: ListTree },
        { href: '/admin/budget-managers', label: '세목별 담당자', icon: UserCog },
        { href: '/admin/memo-examples', label: '적요 예제 관리', icon: FileText },
        { href: '/admin/year-setup-status', label: '설정 완료 현황', icon: CheckCircle },
      ],
    },
    {
      title: '결산/실적',
      items: [
        { href: '/admin/budget-view', label: '예산 현황 조회', icon: Eye },
        { href: '/admin/budget-execution', label: `${terms.operationalExpense} 집행 현황`, icon: PieChart },
        { href: '/admin/hr-admin-execution', label: '인사/행정비 현황', icon: BarChart3 },
        { href: '/admin/quarterly-report', label: '분기별 회계보고', icon: BarChart3 },
        { href: '/admin/cumulative-report', label: '분기별 누적 현황', icon: TrendingUp },
        // 재정보고서(제직용)는 정적 페이지 /reports/financial로 이전됨(교회 전용)
        ...(isChurchOnlyFeatureVisible(orgType)
          ? [{ href: '/reports/financial', label: '재정보고서', icon: Wallet }]
          : []),
      ],
    },
    {
      title: '결재 관리',
      items: [
        { href: '/admin/approval-rules', label: '결재라인 규칙', icon: GitBranch },
        { href: '/admin/manager-exceptions', label: '담당자 예외 현황', icon: AlertTriangle },
      ],
    },
    {
      title: '지출 관리',
      items: [
        { href: '/admin/expense-upload', label: '지출결의서 일괄 업로드', icon: Upload },
      ],
    },
    // 수입 관리(헌금)는 교회 전용
    ...(isChurchOnlyFeatureVisible(orgType)
      ? [
          {
            title: '수입 관리',
            items: [
              { href: '/admin/offerings', label: '헌금 관리', icon: HandCoins },
            ],
          },
        ]
      : []),
    {
      title: '시스템',
      items: [
        { href: '/admin/settings', label: '시스템 설정', icon: Settings },
        { href: '/admin/notifications', label: '알림 발송', icon: Bell },
      ],
    },
  ];

  return menu;
}

/**
 * 기존 호환용 상수 (교회 기준 메뉴)
 * @deprecated 조직 유형 분기가 필요하면 getAdminSidebarMenu(orgType)을 사용하세요.
 */
export const ADMIN_SIDEBAR_MENU: SidebarGroup[] = getAdminSidebarMenu('CHURCH');
