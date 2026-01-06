/**
 * 역할별 메뉴 접근 권한 정의
 * 클라이언트 컴포넌트에서 안전하게 사용 가능
 */

import { UserRole } from '@prisma/client';

// 역할 한글명 (클라이언트 안전)
export const ROLE_NAMES: Record<UserRole, string> = {
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
export function canAccessExtendedMenu(role: UserRole): boolean {
  return EXTENDED_MENU_ROLES.includes(role);
}

/**
 * 결재함 접근 권한 체크
 */
export function canAccessApprovalMenu(role: UserRole): boolean {
  return APPROVAL_MENU_ROLES.includes(role);
}

/**
 * 관리 메뉴 접근 권한 체크
 */
export function canAccessAdminMenu(role: UserRole): boolean {
  return ADMIN_MENU_ROLES.includes(role);
}
