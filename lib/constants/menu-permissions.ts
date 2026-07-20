/**
 * 역할별 메뉴 접근 권한 정의 (클라이언트 안전)
 *
 * ⚠️ 단일 출처: 모든 판정은 lib/auth/permissions.ts 의 권한 프리셋으로부터 파생된다.
 * 하드코딩된 역할 배열/경로 화이트리스트를 두지 않고, permission 으로부터 계산한다(AC2).
 * 서버 가드(withAdminMenu)와 클라이언트 메뉴가 동일한 permission 을 사용한다(AC1).
 */

import {
  ROLE_CODES,
  RoleCode,
  PERMISSIONS,
  Permission,
  ROLE_NAMES as PERMISSION_ROLE_NAMES,
  ROLE_PERMISSION_PRESETS,
  isRoleCode,
  hasPermission,
  resolvePermissions,
  presetResolver,
} from '@/lib/auth/permissions';

// 역할 코드 타입 (하위 호환)
export type UserRole = RoleCode;

// 역할 한글명 — permissions.ts 단일 출처를 재노출
export const ROLE_NAMES: Record<string, string> = PERMISSION_ROLE_NAMES;

/** 특정 permission 을 프리셋으로 보유한 역할 목록 (ROLE_CODES 순서 유지) */
function rolesWithPermission(permission: Permission): RoleCode[] {
  return ROLE_CODES.filter((role) =>
    ROLE_PERMISSION_PRESETS[role].includes(permission)
  );
}

/** 단일/다중 역할을 permission 집합으로 (프리셋 기준) */
function permsForRoles(roles: string[]) {
  return resolvePermissions(roles, { resolver: presetResolver });
}

// ========================================
// 파생 역할 그룹 (하위 호환용 — 전부 permission 에서 계산)
// ========================================

/** 확장 메뉴(간편 지출결의서) 접근 역할 */
export const EXTENDED_MENU_ROLES: UserRole[] = rolesWithPermission(
  PERMISSIONS.SIMPLE_EXPENSE_USE
);

/** 결재함 접근 역할 */
export const APPROVAL_MENU_ROLES: UserRole[] = rolesWithPermission(
  PERMISSIONS.EXPENSE_APPROVE
);

/** 관리 메뉴 접근 역할 */
export const ADMIN_MENU_ROLES: UserRole[] = rolesWithPermission(
  PERMISSIONS.ADMIN_DASHBOARD_READ
);

/** 자동이체 메뉴 접근 역할 */
export const RECURRING_EXPENSE_MENU_ROLES: UserRole[] = rolesWithPermission(
  PERMISSIONS.RECURRING_READ
);

/** 자동이체 전체 관리 역할 */
export const RECURRING_EXPENSE_FULL_ACCESS_ROLES: UserRole[] = rolesWithPermission(
  PERMISSIONS.RECURRING_MANAGE_ALL
);

/** 최종승인+지급대기 수정 가능 역할 */
export const APPROVED_EDIT_ROLES: UserRole[] = rolesWithPermission(
  PERMISSIONS.EXPENSE_EDIT_APPROVED
);

// ========================================
// 관리자 메뉴 경로 → permission 매핑 (단일 출처)
// 클라이언트 메뉴 필터와 서버 withAdminMenu 가드가 공유한다.
// ========================================
export const MENU_PERMISSIONS: ReadonlyArray<{ path: string; permission: Permission }> = [
  { path: '/admin', permission: PERMISSIONS.ADMIN_DASHBOARD_READ },
  { path: '/admin/committees', permission: PERMISSIONS.COMMITTEE_MANAGE },
  { path: '/admin/departments', permission: PERMISSIONS.DEPARTMENT_MANAGE },
  { path: '/admin/budget-managers', permission: PERMISSIONS.BUDGET_MANAGER_MANAGE },
  { path: '/admin/budget-view', permission: PERMISSIONS.BUDGET_VIEW },
  { path: '/admin/budget-execution', permission: PERMISSIONS.REPORT_BUDGET_EXEC_READ },
  { path: '/admin/hr-admin-execution', permission: PERMISSIONS.REPORT_HR_ADMIN_READ },
  { path: '/admin/quarterly-report', permission: PERMISSIONS.REPORT_QUARTERLY_READ },
  { path: '/admin/cumulative-report', permission: PERMISSIONS.REPORT_CUMULATIVE_READ },
  { path: '/reports/financial', permission: PERMISSIONS.REPORT_FINANCIAL_READ },
  { path: '/admin/offerings', permission: PERMISSIONS.OFFERING_MANAGE },
  { path: '/admin/expense-upload', permission: PERMISSIONS.EXPENSE_BULK_UPLOAD },
  { path: '/receipts', permission: PERMISSIONS.RECEIPT_READ },
  // admin 전용(관리 민감) 경로
  { path: '/admin/users', permission: PERMISSIONS.USER_MANAGE },
  { path: '/admin/roles', permission: PERMISSIONS.ROLE_MANAGE },
  { path: '/admin/settings', permission: PERMISSIONS.SETTINGS_MANAGE },
  { path: '/admin/notifications', permission: PERMISSIONS.NOTIFICATION_SEND },
];

/** 요청 경로에 필요한 permission (매핑 규칙: /admin 은 정확일치, 그 외는 하위경로 포함) */
export function requiredPermissionForPath(path: string): Permission | null {
  for (const { path: allowed, permission } of MENU_PERMISSIONS) {
    if (allowed === '/admin') {
      if (path === '/admin') return permission;
    } else if (path === allowed || path.startsWith(allowed + '/')) {
      return permission;
    }
  }
  return null;
}

/**
 * 역할별 접근 가능한 관리자 경로 (파생). admin 은 'all'.
 * 접근 가능한 경로가 없는 역할은 키를 두지 않는다(하위 호환: undefined).
 */
export const ROLE_ADMIN_MENU_PATHS: Record<string, string[] | 'all'> = (() => {
  const result: Record<string, string[] | 'all'> = { admin: 'all' };
  for (const role of ROLE_CODES) {
    if (role === 'admin') continue;
    const preset = ROLE_PERMISSION_PRESETS[role];
    const paths = MENU_PERMISSIONS.filter((mp) =>
      preset.includes(mp.permission)
    ).map((mp) => mp.path);
    if (paths.length > 0) result[role] = paths;
  }
  return result;
})();

// ========================================
// 판정 함수 (전부 hasPermission 경유)
// ========================================

/** 확장 메뉴(간편 지출결의서) 접근 권한 */
export function canAccessExtendedMenu(role: string): boolean {
  return hasPermission(permsForRoles([role]), PERMISSIONS.SIMPLE_EXPENSE_USE);
}

/** 결재함 접근 권한 */
export function canAccessApprovalMenu(role: string): boolean {
  return hasPermission(permsForRoles([role]), PERMISSIONS.EXPENSE_APPROVE);
}

/** 관리 메뉴 접근 권한 */
export function canAccessAdminMenu(role: string): boolean {
  return hasPermission(permsForRoles([role]), PERMISSIONS.ADMIN_DASHBOARD_READ);
}

/** 관리 메뉴 접근 권한 (다중 역할) */
export function canAccessAdminMenuWithRoles(roles: string[]): boolean {
  return hasPermission(permsForRoles(roles), PERMISSIONS.ADMIN_DASHBOARD_READ);
}

/** 자동이체 메뉴 접근 권한 */
export function canAccessRecurringExpenseMenu(role: string): boolean {
  return hasPermission(permsForRoles([role]), PERMISSIONS.RECURRING_READ);
}

/** 자동이체 전체 관리 권한 (본인 소유 외 데이터 접근) */
export function canManageAllRecurringExpenses(role: string): boolean {
  return hasPermission(permsForRoles([role]), PERMISSIONS.RECURRING_MANAGE_ALL);
}

/** 자동이체 메뉴 접근 권한 (다중 역할) */
export function canAccessRecurringExpenseMenuWithRoles(roles: string[]): boolean {
  return hasPermission(permsForRoles(roles), PERMISSIONS.RECURRING_READ);
}

/**
 * 자동이체 API 접근 권한 확인
 * 권한 없으면 에러 객체 반환, 있으면 null
 */
export function checkRecurringExpenseAccess(
  userRole: string
): { error: string; status: 403 } | null {
  if (!canAccessRecurringExpenseMenu(userRole)) {
    return { error: '자동이체 접근 권한이 없습니다.', status: 403 };
  }
  return null;
}

/**
 * 사용자 등록 메뉴 표시 여부
 * - 역할이 user:register 권한을 갖거나(=admin), 개별/역할 플래그 canRegisterUsers
 */
export function canShowUserRegisterMenu(user: {
  role?: string;
  canRegisterUsers?: boolean;
  roleRef?: { canRegisterUsers?: boolean } | null;
} | null): boolean {
  if (!user) return false;
  if (user.role && hasPermission(permsForRoles([user.role]), PERMISSIONS.USER_REGISTER)) {
    return true;
  }
  if (user.canRegisterUsers) return true;
  if (user.roleRef?.canRegisterUsers) return true;
  return false;
}

/** 특정 관리자 메뉴 경로 접근 권한 */
export function canAccessAdminMenuPath(role: string, path: string): boolean {
  if (!isRoleCode(role)) return false;
  if (role === 'admin') return true; // admin = all
  const permission = requiredPermissionForPath(path);
  if (!permission) return false; // 매핑 없는 경로는 admin 전용
  return hasPermission(permsForRoles([role]), permission);
}

/** 특정 관리자 메뉴 경로 접근 권한 (다중 역할) */
export function canAccessAdminMenuPathWithRoles(roles: string[], path: string): boolean {
  return roles.some((role) => canAccessAdminMenuPath(role, path));
}

/** 역할별 접근 가능 메뉴 그룹 필터링 */
export function filterAdminMenuByRole<T extends { items: { href: string }[] }>(
  menu: T[],
  role: string
): T[] {
  return menu
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessAdminMenuPath(role, item.href)),
    }))
    .filter((group) => group.items.length > 0) as T[];
}

/** 역할별 접근 가능 메뉴 그룹 필터링 (다중 역할) */
export function filterAdminMenuByRoles<T extends { items: { href: string }[] }>(
  menu: T[],
  roles: string[]
): T[] {
  return menu
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canAccessAdminMenuPathWithRoles(roles, item.href)
      ),
    }))
    .filter((group) => group.items.length > 0) as T[];
}
