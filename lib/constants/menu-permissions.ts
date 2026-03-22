/**
 * 역할별 메뉴 접근 권한 정의
 * 클라이언트 컴포넌트에서 안전하게 사용 가능
 */

// 역할 코드 타입 (Role.code와 동일)
type UserRole = 'admin' | 'finance_head' | 'accountant' | 'team_leader' | 'admin_assistant' | 'user';

// 역할 한글명 (클라이언트 안전)
export const ROLE_NAMES: Record<string, string> = {
  admin: '관리자',
  finance_head: '재정팀장',
  accountant: '회계',
  team_leader: '팀장',
  admin_assistant: '행정간사',
  user: '사용자',
};

// 확장 메뉴 접근 가능 역할 (간편 지출결의서 등)
export const EXTENDED_MENU_ROLES: UserRole[] = [
  'admin',
  'finance_head',
  'accountant',
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
];

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
