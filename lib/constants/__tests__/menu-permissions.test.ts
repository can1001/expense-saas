/**
 * @jest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  ROLE_NAMES,
  EXTENDED_MENU_ROLES,
  APPROVAL_MENU_ROLES,
  ADMIN_MENU_ROLES,
  RECURRING_EXPENSE_MENU_ROLES,
  ROLE_ADMIN_MENU_PATHS,
  canAccessExtendedMenu,
  canAccessApprovalMenu,
  canAccessAdminMenu,
  canAccessAdminMenuPath,
  filterAdminMenuByRole,
  canShowUserRegisterMenu,
  canAccessAdminMenuWithRoles,
  canAccessAdminMenuPathWithRoles,
  filterAdminMenuByRoles,
  canAccessRecurringExpenseMenu,
  canAccessRecurringExpenseMenuWithRoles,
  checkRecurringExpenseAccess,
} from '../menu-permissions';

describe('menu-permissions', () => {
  describe('ROLE_NAMES', () => {
    it('should contain all role names in Korean', () => {
      expect(ROLE_NAMES).toEqual({
        admin: '관리자',
        finance_head: '재정팀장',
        accountant: '회계',
        finance_member: '재정팀원',
        team_leader: '팀장',
        admin_assistant: '행정간사',
        user: '사용자',
      });
    });
  });

  describe('EXTENDED_MENU_ROLES', () => {
    it('should include admin, finance_head, accountant, finance_member, admin_assistant', () => {
      expect(EXTENDED_MENU_ROLES).toEqual([
        'admin',
        'finance_head',
        'accountant',
        'finance_member',
        'admin_assistant',
      ]);
    });

    it('should not include team_leader and user', () => {
      expect(EXTENDED_MENU_ROLES).not.toContain('team_leader');
      expect(EXTENDED_MENU_ROLES).not.toContain('user');
    });
  });

  describe('APPROVAL_MENU_ROLES', () => {
    it('should include admin, finance_head, accountant, team_leader', () => {
      expect(APPROVAL_MENU_ROLES).toEqual([
        'admin',
        'finance_head',
        'accountant',
        'team_leader',
      ]);
    });

    it('should not include admin_assistant and user', () => {
      expect(APPROVAL_MENU_ROLES).not.toContain('admin_assistant');
      expect(APPROVAL_MENU_ROLES).not.toContain('user');
    });
  });

  describe('ADMIN_MENU_ROLES', () => {
    it('should include admin, finance_head, accountant, finance_member, admin_assistant', () => {
      expect(ADMIN_MENU_ROLES).toEqual([
        'admin',
        'finance_head',
        'accountant',
        'finance_member',
        'admin_assistant',
      ]);
    });

    it('should have length of 5', () => {
      expect(ADMIN_MENU_ROLES).toHaveLength(5);
    });

    it('should not include team_leader and user', () => {
      expect(ADMIN_MENU_ROLES).not.toContain('team_leader');
      expect(ADMIN_MENU_ROLES).not.toContain('user');
    });
  });

  describe('canAccessExtendedMenu', () => {
    it('should return true for admin', () => {
      expect(canAccessExtendedMenu('admin')).toBe(true);
    });

    it('should return true for finance_head', () => {
      expect(canAccessExtendedMenu('finance_head')).toBe(true);
    });

    it('should return true for accountant', () => {
      expect(canAccessExtendedMenu('accountant')).toBe(true);
    });

    it('should return true for admin_assistant', () => {
      expect(canAccessExtendedMenu('admin_assistant')).toBe(true);
    });

    it('should return true for finance_member', () => {
      expect(canAccessExtendedMenu('finance_member')).toBe(true);
    });

    it('should return false for team_leader', () => {
      expect(canAccessExtendedMenu('team_leader')).toBe(false);
    });

    it('should return false for user', () => {
      expect(canAccessExtendedMenu('user')).toBe(false);
    });

    it('should return false for unknown role', () => {
      expect(canAccessExtendedMenu('unknown_role')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(canAccessExtendedMenu('')).toBe(false);
    });
  });

  describe('canAccessApprovalMenu', () => {
    it('should return true for admin', () => {
      expect(canAccessApprovalMenu('admin')).toBe(true);
    });

    it('should return true for finance_head', () => {
      expect(canAccessApprovalMenu('finance_head')).toBe(true);
    });

    it('should return true for accountant', () => {
      expect(canAccessApprovalMenu('accountant')).toBe(true);
    });

    it('should return true for team_leader', () => {
      expect(canAccessApprovalMenu('team_leader')).toBe(true);
    });

    it('should return false for admin_assistant', () => {
      expect(canAccessApprovalMenu('admin_assistant')).toBe(false);
    });

    it('should return false for user', () => {
      expect(canAccessApprovalMenu('user')).toBe(false);
    });

    it('should return false for unknown role', () => {
      expect(canAccessApprovalMenu('unknown_role')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(canAccessApprovalMenu('')).toBe(false);
    });
  });

  describe('canAccessAdminMenu', () => {
    it('should return true for admin', () => {
      expect(canAccessAdminMenu('admin')).toBe(true);
    });

    it('should return true for finance_head', () => {
      expect(canAccessAdminMenu('finance_head')).toBe(true);
    });

    it('should return true for accountant', () => {
      expect(canAccessAdminMenu('accountant')).toBe(true);
    });

    it('should return true for admin_assistant', () => {
      expect(canAccessAdminMenu('admin_assistant')).toBe(true);
    });

    it('should return true for finance_member', () => {
      expect(canAccessAdminMenu('finance_member')).toBe(true);
    });

    it('should return false for team_leader', () => {
      expect(canAccessAdminMenu('team_leader')).toBe(false);
    });

    it('should return false for user', () => {
      expect(canAccessAdminMenu('user')).toBe(false);
    });

    it('should return false for unknown role', () => {
      expect(canAccessAdminMenu('unknown_role')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(canAccessAdminMenu('')).toBe(false);
    });
  });

  describe('canShowUserRegisterMenu', () => {
    it('should return false for null user', () => {
      expect(canShowUserRegisterMenu(null)).toBe(false);
    });

    it('should return true for admin role', () => {
      expect(canShowUserRegisterMenu({ role: 'admin' })).toBe(true);
    });

    it('should return true when user has canRegisterUsers flag', () => {
      expect(canShowUserRegisterMenu({ role: 'user', canRegisterUsers: true })).toBe(true);
    });

    it('should return true when roleRef has canRegisterUsers flag', () => {
      expect(
        canShowUserRegisterMenu({
          role: 'finance_head',
          roleRef: { canRegisterUsers: true },
        })
      ).toBe(true);
    });

    it('should return false for user without canRegisterUsers', () => {
      expect(canShowUserRegisterMenu({ role: 'user', canRegisterUsers: false })).toBe(false);
    });

    it('should return false when roleRef has canRegisterUsers false', () => {
      expect(
        canShowUserRegisterMenu({
          role: 'finance_head',
          roleRef: { canRegisterUsers: false },
        })
      ).toBe(false);
    });

    it('should return false when roleRef is null', () => {
      expect(
        canShowUserRegisterMenu({
          role: 'finance_head',
          roleRef: null,
        })
      ).toBe(false);
    });

    it('should return false for user with no role or flags', () => {
      expect(canShowUserRegisterMenu({})).toBe(false);
    });

    it('should prioritize direct canRegisterUsers over roleRef', () => {
      expect(
        canShowUserRegisterMenu({
          role: 'user',
          canRegisterUsers: true,
          roleRef: { canRegisterUsers: false },
        })
      ).toBe(true);
    });

    it('should return true for admin regardless of flags', () => {
      expect(
        canShowUserRegisterMenu({
          role: 'admin',
          canRegisterUsers: false,
          roleRef: { canRegisterUsers: false },
        })
      ).toBe(true);
    });

    it('should return false for non-admin without canRegisterUsers', () => {
      expect(
        canShowUserRegisterMenu({
          role: 'finance_head',
        })
      ).toBe(false);
    });

    it('should return false when only roleRef is provided without canRegisterUsers', () => {
      expect(
        canShowUserRegisterMenu({
          role: 'user',
          roleRef: {},
        })
      ).toBe(false);
    });
  });

  describe('ROLE_ADMIN_MENU_PATHS', () => {
    it('should give admin access to all menus', () => {
      expect(ROLE_ADMIN_MENU_PATHS['admin']).toBe('all');
    });

    it('should give accountant access to specific menus', () => {
      const paths = ROLE_ADMIN_MENU_PATHS['accountant'];
      expect(Array.isArray(paths)).toBe(true);
      expect(paths).toContain('/admin');
      expect(paths).toContain('/admin/committees');
      expect(paths).toContain('/admin/departments');
      expect(paths).toContain('/admin/budget-managers');
      expect(paths).toContain('/admin/budget-view');
      expect(paths).toContain('/admin/offerings');
    });

    it('should give finance_head same access as accountant', () => {
      expect(ROLE_ADMIN_MENU_PATHS['finance_head']).toEqual(ROLE_ADMIN_MENU_PATHS['accountant']);
    });

    it('should give admin_assistant same access as accountant', () => {
      expect(ROLE_ADMIN_MENU_PATHS['admin_assistant']).toEqual(ROLE_ADMIN_MENU_PATHS['accountant']);
    });

    it('should not include team_leader', () => {
      expect(ROLE_ADMIN_MENU_PATHS['team_leader']).toBeUndefined();
    });

    it('should not include user', () => {
      expect(ROLE_ADMIN_MENU_PATHS['user']).toBeUndefined();
    });
  });

  describe('canAccessAdminMenuPath', () => {
    it('should return true for admin on any path', () => {
      expect(canAccessAdminMenuPath('admin', '/admin')).toBe(true);
      expect(canAccessAdminMenuPath('admin', '/admin/users')).toBe(true);
      expect(canAccessAdminMenuPath('admin', '/admin/settings')).toBe(true);
    });

    it('should return true for accountant on allowed paths', () => {
      expect(canAccessAdminMenuPath('accountant', '/admin')).toBe(true);
      expect(canAccessAdminMenuPath('accountant', '/admin/committees')).toBe(true);
      expect(canAccessAdminMenuPath('accountant', '/admin/budget-view')).toBe(true);
      expect(canAccessAdminMenuPath('accountant', '/admin/offerings')).toBe(true);
    });

    it('should return false for accountant on restricted paths', () => {
      expect(canAccessAdminMenuPath('accountant', '/admin/users')).toBe(false);
      expect(canAccessAdminMenuPath('accountant', '/admin/settings')).toBe(false);
      expect(canAccessAdminMenuPath('accountant', '/admin/roles')).toBe(false);
    });

    it('should return false for team_leader on any admin path', () => {
      expect(canAccessAdminMenuPath('team_leader', '/admin')).toBe(false);
      expect(canAccessAdminMenuPath('team_leader', '/admin/committees')).toBe(false);
    });

    it('should return false for user on any admin path', () => {
      expect(canAccessAdminMenuPath('user', '/admin')).toBe(false);
    });

    it('should return false for unknown role', () => {
      expect(canAccessAdminMenuPath('unknown', '/admin')).toBe(false);
    });
  });

  describe('filterAdminMenuByRole', () => {
    const mockMenu = [
      {
        title: '대시보드',
        items: [{ href: '/admin', label: '홈' }],
      },
      {
        title: '조직 관리',
        items: [
          { href: '/admin/committees', label: '위원회 관리' },
          { href: '/admin/departments', label: '사역팀(부) 관리' },
        ],
      },
      {
        title: '사용자/역할',
        items: [
          { href: '/admin/users', label: '사용자 관리' },
          { href: '/admin/roles', label: '역할 관리' },
        ],
      },
    ];

    it('should return all menu for admin', () => {
      const result = filterAdminMenuByRole(mockMenu, 'admin');
      expect(result).toEqual(mockMenu);
    });

    it('should filter menu for accountant', () => {
      const result = filterAdminMenuByRole(mockMenu, 'accountant');
      expect(result).toHaveLength(2); // 대시보드, 조직 관리
      expect(result[0].title).toBe('대시보드');
      expect(result[1].title).toBe('조직 관리');
    });

    it('should return empty array for team_leader', () => {
      const result = filterAdminMenuByRole(mockMenu, 'team_leader');
      expect(result).toEqual([]);
    });

    it('should return empty array for unknown role', () => {
      const result = filterAdminMenuByRole(mockMenu, 'unknown');
      expect(result).toEqual([]);
    });
  });

  // 다중 역할(Multi-role) 지원 테스트
  describe('canAccessAdminMenuWithRoles', () => {
    it('should return true if any role can access admin menu', () => {
      expect(canAccessAdminMenuWithRoles(['team_leader', 'finance_head'])).toBe(true);
      expect(canAccessAdminMenuWithRoles(['user', 'accountant'])).toBe(true);
      expect(canAccessAdminMenuWithRoles(['admin'])).toBe(true);
    });

    it('should return false if no role can access admin menu', () => {
      expect(canAccessAdminMenuWithRoles(['team_leader'])).toBe(false);
      expect(canAccessAdminMenuWithRoles(['user'])).toBe(false);
      expect(canAccessAdminMenuWithRoles(['team_leader', 'user'])).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(canAccessAdminMenuWithRoles([])).toBe(false);
    });

    it('should handle mixed known and unknown roles', () => {
      expect(canAccessAdminMenuWithRoles(['unknown', 'finance_head'])).toBe(true);
      expect(canAccessAdminMenuWithRoles(['unknown', 'invalid'])).toBe(false);
    });
  });

  describe('canAccessAdminMenuPathWithRoles', () => {
    it('should return true if any role can access the path', () => {
      // team_leader는 /admin 접근 불가, finance_head는 가능
      expect(canAccessAdminMenuPathWithRoles(['team_leader', 'finance_head'], '/admin')).toBe(true);
      expect(canAccessAdminMenuPathWithRoles(['team_leader', 'finance_head'], '/admin/committees')).toBe(true);
    });

    it('should return false if no role can access the path', () => {
      // finance_head는 /admin/users 접근 불가
      expect(canAccessAdminMenuPathWithRoles(['finance_head'], '/admin/users')).toBe(false);
      expect(canAccessAdminMenuPathWithRoles(['team_leader', 'user'], '/admin')).toBe(false);
    });

    it('should return true for admin on any path', () => {
      expect(canAccessAdminMenuPathWithRoles(['admin'], '/admin/users')).toBe(true);
      expect(canAccessAdminMenuPathWithRoles(['team_leader', 'admin'], '/admin/settings')).toBe(true);
    });

    it('should combine permissions from multiple roles', () => {
      // accountant는 /admin/committees 접근 가능
      expect(canAccessAdminMenuPathWithRoles(['accountant'], '/admin/committees')).toBe(true);
      // user + accountant 조합
      expect(canAccessAdminMenuPathWithRoles(['user', 'accountant'], '/admin/committees')).toBe(true);
    });

    it('should return false for empty roles array', () => {
      expect(canAccessAdminMenuPathWithRoles([], '/admin')).toBe(false);
    });
  });

  describe('filterAdminMenuByRoles', () => {
    const mockMenu = [
      {
        title: '대시보드',
        items: [{ href: '/admin', label: '홈' }],
      },
      {
        title: '조직 관리',
        items: [
          { href: '/admin/committees', label: '위원회 관리' },
          { href: '/admin/departments', label: '사역팀(부) 관리' },
        ],
      },
      {
        title: '사용자/역할',
        items: [
          { href: '/admin/users', label: '사용자 관리' },
          { href: '/admin/roles', label: '역할 관리' },
        ],
      },
    ];

    it('should return all menu if any role is admin', () => {
      const result = filterAdminMenuByRoles(mockMenu, ['team_leader', 'admin']);
      expect(result).toEqual(mockMenu);
    });

    it('should combine menu items from multiple roles', () => {
      // finance_head는 조직 관리 접근 가능, team_leader는 접근 불가
      const result = filterAdminMenuByRoles(mockMenu, ['team_leader', 'finance_head']);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(g => g.title === '대시보드')).toBe(true);
      expect(result.some(g => g.title === '조직 관리')).toBe(true);
    });

    it('should return empty array if no role has access', () => {
      const result = filterAdminMenuByRoles(mockMenu, ['team_leader', 'user']);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty roles', () => {
      const result = filterAdminMenuByRoles(mockMenu, []);
      expect(result).toEqual([]);
    });

    it('should filter to unique items when roles overlap', () => {
      // accountant와 finance_head는 같은 권한을 가짐
      const result = filterAdminMenuByRoles(mockMenu, ['accountant', 'finance_head']);
      // 중복 없이 결과가 나와야 함
      const allHrefs = result.flatMap(g => g.items.map(i => i.href));
      const uniqueHrefs = [...new Set(allHrefs)];
      expect(allHrefs.length).toBe(uniqueHrefs.length);
    });

    it('should handle real-world scenario: 재정팀장 with team_leader + finance_head', () => {
      // 재정팀장이 team_leader와 finance_head 두 역할을 가진 경우
      const roles = ['team_leader', 'finance_head'];
      const result = filterAdminMenuByRoles(mockMenu, roles);

      // finance_head 권한으로 조직 관리에 접근 가능해야 함
      expect(result.some(g => g.title === '대시보드')).toBe(true);
      expect(result.some(g => g.title === '조직 관리')).toBe(true);
      // 하지만 사용자/역할 메뉴는 접근 불가 (admin만 가능)
      expect(result.some(g => g.title === '사용자/역할')).toBe(false);
    });
  });

  // 자동이체 메뉴 권한 테스트
  describe('RECURRING_EXPENSE_MENU_ROLES', () => {
    it('should include admin, finance_head, accountant, finance_member, admin_assistant', () => {
      expect(RECURRING_EXPENSE_MENU_ROLES).toContain('admin');
      expect(RECURRING_EXPENSE_MENU_ROLES).toContain('finance_head');
      expect(RECURRING_EXPENSE_MENU_ROLES).toContain('accountant');
      expect(RECURRING_EXPENSE_MENU_ROLES).toContain('finance_member');
      expect(RECURRING_EXPENSE_MENU_ROLES).toContain('admin_assistant');
    });

    it('should have length of 5', () => {
      expect(RECURRING_EXPENSE_MENU_ROLES).toHaveLength(5);
    });

    it('should not include team_leader, user', () => {
      expect(RECURRING_EXPENSE_MENU_ROLES).not.toContain('team_leader');
      expect(RECURRING_EXPENSE_MENU_ROLES).not.toContain('user');
    });
  });

  describe('canAccessRecurringExpenseMenu', () => {
    it('should return true for admin', () => {
      expect(canAccessRecurringExpenseMenu('admin')).toBe(true);
    });

    it('should return true for finance_head', () => {
      expect(canAccessRecurringExpenseMenu('finance_head')).toBe(true);
    });

    it('should return true for accountant', () => {
      expect(canAccessRecurringExpenseMenu('accountant')).toBe(true);
    });

    it('should return true for finance_member', () => {
      expect(canAccessRecurringExpenseMenu('finance_member')).toBe(true);
    });

    it('should return true for admin_assistant', () => {
      expect(canAccessRecurringExpenseMenu('admin_assistant')).toBe(true);
    });

    it('should return false for team_leader', () => {
      expect(canAccessRecurringExpenseMenu('team_leader')).toBe(false);
    });

    it('should return false for user', () => {
      expect(canAccessRecurringExpenseMenu('user')).toBe(false);
    });

    it('should return false for unknown role', () => {
      expect(canAccessRecurringExpenseMenu('unknown_role')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(canAccessRecurringExpenseMenu('')).toBe(false);
    });
  });

  describe('canAccessRecurringExpenseMenuWithRoles', () => {
    it('should return true if any role can access recurring expense menu', () => {
      expect(canAccessRecurringExpenseMenuWithRoles(['team_leader', 'finance_head'])).toBe(true);
      expect(canAccessRecurringExpenseMenuWithRoles(['user', 'accountant'])).toBe(true);
      expect(canAccessRecurringExpenseMenuWithRoles(['admin'])).toBe(true);
      expect(canAccessRecurringExpenseMenuWithRoles(['finance_member'])).toBe(true);
    });

    it('should return true for admin_assistant', () => {
      expect(canAccessRecurringExpenseMenuWithRoles(['admin_assistant'])).toBe(true);
    });

    it('should return false if no role can access recurring expense menu', () => {
      expect(canAccessRecurringExpenseMenuWithRoles(['team_leader'])).toBe(false);
      expect(canAccessRecurringExpenseMenuWithRoles(['user'])).toBe(false);
      expect(canAccessRecurringExpenseMenuWithRoles(['team_leader', 'user'])).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(canAccessRecurringExpenseMenuWithRoles([])).toBe(false);
    });

    it('should handle mixed known and unknown roles', () => {
      expect(canAccessRecurringExpenseMenuWithRoles(['unknown', 'finance_head'])).toBe(true);
      expect(canAccessRecurringExpenseMenuWithRoles(['unknown', 'invalid'])).toBe(false);
    });

    it('should handle real-world scenario: 재정팀장 with team_leader + finance_head', () => {
      // 재정팀장이 team_leader와 finance_head 두 역할을 가진 경우
      const roles = ['team_leader', 'finance_head'];
      expect(canAccessRecurringExpenseMenuWithRoles(roles)).toBe(true);
    });

    it('should handle user with team_leader and admin_assistant roles', () => {
      // admin_assistant가 이제 자동이체 접근 권한이 있으므로 true 반환
      const roles = ['team_leader', 'admin_assistant'];
      expect(canAccessRecurringExpenseMenuWithRoles(roles)).toBe(true);
    });
  });

  describe('checkRecurringExpenseAccess', () => {
    it('should return null for admin (has access)', () => {
      expect(checkRecurringExpenseAccess('admin')).toBeNull();
    });

    it('should return null for finance_head (has access)', () => {
      expect(checkRecurringExpenseAccess('finance_head')).toBeNull();
    });

    it('should return null for accountant (has access)', () => {
      expect(checkRecurringExpenseAccess('accountant')).toBeNull();
    });

    it('should return null for finance_member (has access)', () => {
      expect(checkRecurringExpenseAccess('finance_member')).toBeNull();
    });

    it('should return null for admin_assistant (has access)', () => {
      expect(checkRecurringExpenseAccess('admin_assistant')).toBeNull();
    });

    it('should return error object for team_leader (no access)', () => {
      const result = checkRecurringExpenseAccess('team_leader');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
      expect(result?.error).toContain('권한');
    });

    it('should return error object for user (no access)', () => {
      const result = checkRecurringExpenseAccess('user');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
    });

    it('should return error object for unknown role (no access)', () => {
      const result = checkRecurringExpenseAccess('unknown_role');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
    });

    it('should return error object for empty string (no access)', () => {
      const result = checkRecurringExpenseAccess('');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
    });
  });
});
