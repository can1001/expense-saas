/**
 * @jest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  ROLE_NAMES,
  EXTENDED_MENU_ROLES,
  APPROVAL_MENU_ROLES,
  ADMIN_MENU_ROLES,
  canAccessExtendedMenu,
  canAccessApprovalMenu,
  canAccessAdminMenu,
  canShowUserRegisterMenu,
} from '../menu-permissions';

describe('menu-permissions', () => {
  describe('ROLE_NAMES', () => {
    it('should contain all role names in Korean', () => {
      expect(ROLE_NAMES).toEqual({
        admin: '관리자',
        finance_head: '재정팀장',
        accountant: '회계',
        team_leader: '팀장',
        admin_assistant: '행정간사',
        user: '사용자',
      });
    });
  });

  describe('EXTENDED_MENU_ROLES', () => {
    it('should include admin, finance_head, accountant, admin_assistant', () => {
      expect(EXTENDED_MENU_ROLES).toEqual([
        'admin',
        'finance_head',
        'accountant',
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
    it('should only include admin', () => {
      expect(ADMIN_MENU_ROLES).toEqual(['admin']);
    });

    it('should have length of 1', () => {
      expect(ADMIN_MENU_ROLES).toHaveLength(1);
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

    it('should return false for finance_head', () => {
      expect(canAccessAdminMenu('finance_head')).toBe(false);
    });

    it('should return false for accountant', () => {
      expect(canAccessAdminMenu('accountant')).toBe(false);
    });

    it('should return false for team_leader', () => {
      expect(canAccessAdminMenu('team_leader')).toBe(false);
    });

    it('should return false for admin_assistant', () => {
      expect(canAccessAdminMenu('admin_assistant')).toBe(false);
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
});
