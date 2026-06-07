/**
 * 역할별 메뉴 접근 권한 정의
 * 클라이언트 컴포넌트에서 안전하게 사용 가능
 */

// 역할 코드 타입 (Role.code와 동일)
export type UserRole = 'admin' | 'finance_head' | 'accountant' | 'finance_member' | 'team_leader' | 'admin_assistant' | 'user';

// 역할 한글명 (클라이언트 안전)
export const ROLE_NAMES: Record<string, string> = {
  admin: '관리자',
  finance_head: '재정팀장',
  accountant: '회계',
  finance_member: '재정팀원',
  team_leader: '팀장',
  admin_assistant: '행정간사',
  user: '사용자',
};

// 확장 메뉴 접근 가능 역할 (간편 지출결의서 등)
export const EXTENDED_MENU_ROLES: UserRole[] = [
  'admin',
  'finance_head',
  'accountant',
  'finance_member',
  'admin_assistant',
];

// 결재함 접근 가능 역할
export const APPROVAL_MENU_ROLES: UserRole[] = [
  'admin',
  'finance_head',
  'accountant',
  'team_leader',
];

// 관리 메뉴 접근 가능 역할
export const ADMIN_MENU_ROLES: UserRole[] = [
  'admin',
  'finance_head',
  'accountant',
  'finance_member',
  'admin_assistant',
];

// 자동이체 메뉴 접근 가능 역할 (재정팀 + 행정간사)
export const RECURRING_EXPENSE_MENU_ROLES: UserRole[] = [
  'admin',
  'finance_head',
  'accountant',
  'finance_member',
  'admin_assistant',
];

// 자동이체 전체 관리 가능 역할 (본인 소유 외 모든 자동이체 조회/수정/삭제/생성)
export const RECURRING_EXPENSE_FULL_ACCESS_ROLES: UserRole[] = [
  'admin',
  'finance_head',
  'accountant',
  'finance_member',
  'admin_assistant',
];

// 최종승인 + 지급대기 상태 지출결의서 수정 가능 역할
export const APPROVED_EDIT_ROLES: UserRole[] = [
  'admin',
  'finance_head',
  'accountant',
  'admin_assistant',
];

// 역할별 접근 가능한 관리자 메뉴 경로 정의
export const ROLE_ADMIN_MENU_PATHS: Record<string, string[] | 'all'> = {
  admin: 'all', // 모든 메뉴 접근
  accountant: [
    '/admin',                      // 대시보드 홈
    '/admin/committees',           // 위원회 관리
    '/admin/departments',          // 사역팀(부) 관리
    '/admin/budget-managers',      // 세목별 담당자
    '/admin/budget-view',          // 예산 현황 조회
    '/admin/budget-execution',     // 사역비 집행 현황
    '/admin/hr-admin-execution',   // 인사/행정비 현황
    '/admin/quarterly-report',     // 분기별 회계보고
    '/admin/cumulative-report',    // 분기별 누적 현황
    '/admin/account-report',       // 재정보고서
    '/admin/offerings',            // 헌금 관리
  ],
  admin_assistant: [
    '/admin',
    '/admin/committees',
    '/admin/departments',
    '/admin/budget-managers',
    '/admin/budget-view',
    '/admin/budget-execution',
    '/admin/hr-admin-execution',
    '/admin/quarterly-report',
    '/admin/cumulative-report',
    '/admin/account-report',       // 재정보고서
    '/admin/offerings',
    '/admin/expense-upload',       // 지출결의서 일괄 업로드
  ],
  finance_head: [
    '/admin',
    '/admin/committees',
    '/admin/departments',
    '/admin/budget-managers',
    '/admin/budget-view',
    '/admin/budget-execution',
    '/admin/hr-admin-execution',
    '/admin/quarterly-report',
    '/admin/cumulative-report',
    '/admin/account-report',       // 재정보고서
    '/admin/offerings',
  ],
  finance_member: [
    '/admin',
    '/admin/committees',
    '/admin/departments',
    '/admin/budget-managers',
    '/admin/budget-view',
    '/admin/budget-execution',
    '/admin/hr-admin-execution',
    '/admin/quarterly-report',
    '/admin/cumulative-report',
    '/admin/account-report',       // 재정보고서
    '/admin/offerings',
  ],
};

/**
 * 확장 메뉴 접근 권한 체크
 * (간편 지출결의서 작성/목록)
 */
export function canAccessExtendedMenu(role: string): boolean {
  return EXTENDED_MENU_ROLES.includes(role as UserRole);
}

/**
 * 결재함 접근 권한 체크
 */
export function canAccessApprovalMenu(role: string): boolean {
  return APPROVAL_MENU_ROLES.includes(role as UserRole);
}

/**
 * 관리 메뉴 접근 권한 체크
 */
export function canAccessAdminMenu(role: string): boolean {
  return ADMIN_MENU_ROLES.includes(role as UserRole);
}

/**
 * 관리 메뉴 접근 권한 체크 (다중 역할 지원)
 * roles 배열 중 하나라도 관리 메뉴 접근 권한이 있으면 true
 */
export function canAccessAdminMenuWithRoles(roles: string[]): boolean {
  return roles.some(role => ADMIN_MENU_ROLES.includes(role as UserRole));
}

/**
 * 자동이체 메뉴 접근 권한 체크
 */
export function canAccessRecurringExpenseMenu(role: string): boolean {
  return RECURRING_EXPENSE_MENU_ROLES.includes(role as UserRole);
}

/**
 * 자동이체 전체 관리 권한 체크 (본인 소유 외 데이터 접근)
 */
export function canManageAllRecurringExpenses(role: string): boolean {
  return RECURRING_EXPENSE_FULL_ACCESS_ROLES.includes(role as UserRole);
}

/**
 * 자동이체 메뉴 접근 권한 체크 (다중 역할 지원)
 */
export function canAccessRecurringExpenseMenuWithRoles(roles: string[]): boolean {
  return roles.some(role => RECURRING_EXPENSE_MENU_ROLES.includes(role as UserRole));
}

/**
 * 자동이체 API 접근 권한 확인
 * 권한이 없으면 에러 객체 반환, 있으면 null 반환
 * (ApiError를 직접 throw하지 않음 - 순환 의존성 방지)
 */
export function checkRecurringExpenseAccess(userRole: string): { error: string; status: 403 } | null {
  if (!canAccessRecurringExpenseMenu(userRole)) {
    return { error: '자동이체 접근 권한이 없습니다.', status: 403 };
  }
  return null;
}

/**
 * 사용자 등록 메뉴 표시 여부 확인
 * - 역할의 canRegisterUsers 플래그 또는 개별 사용자 권한으로 확인
 * - 클라이언트에서는 user 객체에 canRegisterUsers 필드가 있어야 함
 */
export function canShowUserRegisterMenu(user: {
  role?: string;
  canRegisterUsers?: boolean;
  roleRef?: { canRegisterUsers?: boolean } | null;
} | null): boolean {
  if (!user) return false;

  // admin은 항상 권한 있음
  if (user.role === 'admin') return true;

  // 사용자에게 직접 부여된 권한 확인
  if (user.canRegisterUsers) return true;

  // 역할에 부여된 권한 확인
  if (user.roleRef?.canRegisterUsers) return true;

  return false;
}

/**
 * 특정 관리자 메뉴 경로 접근 권한 체크
 */
export function canAccessAdminMenuPath(role: string, path: string): boolean {
  const allowedPaths = ROLE_ADMIN_MENU_PATHS[role];
  if (!allowedPaths) return false;
  if (allowedPaths === 'all') return true;

  return allowedPaths.some(allowed => {
    // /admin 홈은 정확히 일치하는 경우에만 허용
    if (allowed === '/admin') {
      return path === '/admin';
    }
    // 다른 경로는 정확히 일치하거나 하위 경로인 경우 허용
    return path === allowed || path.startsWith(allowed + '/');
  });
}

/**
 * 특정 관리자 메뉴 경로 접근 권한 체크 (다중 역할 지원)
 * roles 배열 중 하나라도 해당 경로에 접근 권한이 있으면 true
 */
export function canAccessAdminMenuPathWithRoles(roles: string[], path: string): boolean {
  return roles.some(role => canAccessAdminMenuPath(role, path));
}

/**
 * 역할별 접근 가능한 메뉴 그룹 필터링
 */
export function filterAdminMenuByRole<T extends { items: { href: string }[] }>(
  menu: T[],
  role: string
): T[] {
  const allowedPaths = ROLE_ADMIN_MENU_PATHS[role];
  if (!allowedPaths) return [];
  if (allowedPaths === 'all') return menu;

  return menu
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        allowedPaths.some(allowed => {
          // /admin 홈은 정확히 일치하는 경우에만 허용
          if (allowed === '/admin') {
            return item.href === '/admin';
          }
          // 다른 경로는 정확히 일치하거나 하위 경로인 경우 허용
          return item.href === allowed || item.href.startsWith(allowed + '/');
        })
      ),
    }))
    .filter(group => group.items.length > 0) as T[];
}

/**
 * 역할별 접근 가능한 메뉴 그룹 필터링 (다중 역할 지원)
 * 모든 역할의 접근 가능한 경로를 합산하여 필터링
 */
export function filterAdminMenuByRoles<T extends { items: { href: string }[] }>(
  menu: T[],
  roles: string[]
): T[] {
  // admin 역할이 있으면 모든 메뉴 반환
  if (roles.includes('admin')) return menu;

  // 모든 역할의 허용 경로 합산
  const allAllowedPaths = new Set<string>();
  for (const role of roles) {
    const paths = ROLE_ADMIN_MENU_PATHS[role];
    if (paths === 'all') return menu;
    if (Array.isArray(paths)) {
      paths.forEach(p => allAllowedPaths.add(p));
    }
  }

  if (allAllowedPaths.size === 0) return [];

  return menu
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        Array.from(allAllowedPaths).some(allowed => {
          if (allowed === '/admin') {
            return item.href === '/admin';
          }
          return item.href === allowed || item.href.startsWith(allowed + '/');
        })
      ),
    }))
    .filter(group => group.items.length > 0) as T[];
}
