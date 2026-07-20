/**
 * 전역 사이드바 메뉴 config (Phase 2 대비 — 아직 미사용)
 *
 * 권한 판정은 menu-permissions.ts 파생 함수만 사용한다 (하드코딩 금지, AC 준수).
 * 매핑 근거: docs/DESIGN_SYSTEM_2026-07-18.md 5.2절 (기존 메뉴 → 새 사이드바 매핑)
 *
 * - "예산 관리"는 전역 라우트가 없어 /admin/budget-view(BUDGET_VIEW 권한)로 연결
 * - "정기 지출"은 기존 "자동이체"(/recurring-expenses)의 새 라벨
 * - "영수증 관리"(/receipts)는 RECEIPT_READ permission 기반 (Phase 5)
 */
import {
  Home,
  FileText,
  CheckSquare,
  PiggyBank,
  Repeat,
  Receipt,
  BarChart3,
  Settings,
} from 'lucide-react';
import {
  canAccessApprovalMenu,
  canAccessAdminMenuWithRoles,
  canAccessRecurringExpenseMenuWithRoles,
  canAccessAdminMenuPathWithRoles,
} from '@/lib/constants/menu-permissions';
import type { SidebarConfig, SidebarItem } from '@/components/layout/Sidebar';

interface GlobalMenuUser {
  roles: string[];
  /** 세목 담당자 여부 — 결재함 접근 확장 (기존 HomeClient 규칙) */
  isBudgetManager?: boolean;
}

interface GlobalMenuOptions {
  /** 결재함 대기 건수 (usePendingApprovalCount) */
  pendingApprovalCount?: number;
}

export function getGlobalSidebarMenu(
  user: GlobalMenuUser,
  options: GlobalMenuOptions = {}
): SidebarConfig {
  const roles = user.roles;
  const canApprove =
    roles.some((role) => canAccessApprovalMenu(role)) || user.isBudgetManager === true;

  const items: SidebarItem[] = [
    { href: '/', label: '대시보드', icon: Home },
    { href: '/expenses', label: '지출결의서', icon: FileText },
  ];

  if (canApprove) {
    items.push({
      href: '/approvals',
      label: '결재함',
      icon: CheckSquare,
      badgeCount: options.pendingApprovalCount,
    });
  }

  if (canAccessAdminMenuPathWithRoles(roles, '/admin/budget-view')) {
    items.push({ href: '/admin/budget-view', label: '예산 관리', icon: PiggyBank });
  }

  if (canAccessRecurringExpenseMenuWithRoles(roles)) {
    items.push({ href: '/recurring-expenses', label: '정기 지출', icon: Repeat });
  }

  if (canAccessAdminMenuPathWithRoles(roles, '/receipts')) {
    items.push({ href: '/receipts', label: '영수증 관리', icon: Receipt });
  }

  if (canAccessAdminMenuPathWithRoles(roles, '/reports/financial')) {
    items.push({ href: '/reports/financial', label: '보고서', icon: BarChart3 });
  }

  if (canAccessAdminMenuWithRoles(roles)) {
    items.push({ href: '/admin', label: '관리자 콘솔', icon: Settings });
  }

  return {
    variant: 'global',
    groups: [{ items }],
  };
}
