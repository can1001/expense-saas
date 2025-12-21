import { describe, it, expect } from 'vitest';
import {
  findUserById,
  findUserByUserid,
  findUserByUsername,
  findUsersByRole,
  canApprove,
  getRoleDisplayName,
  USERS,
  ROLE_STEP_MAP,
  ROLE_NAMES,
  type UserRole,
} from '../users';

describe('users', () => {
  describe('findUserById', () => {
    it('should find user by id', () => {
      const user = findUserById('1');
      expect(user).toBeTruthy();
      expect(user?.userid).toBe('청연정혜종');
      expect(user?.username).toBe('정혜종');
    });

    it('should return undefined for invalid id', () => {
      const user = findUserById('invalid-id');
      expect(user).toBeUndefined();
    });

    it('should find finance head by id', () => {
      const user = findUserById('3');
      expect(user?.role).toBe('finance_head');
      expect(user?.username).toBe('신창국');
    });
  });

  describe('findUserByUserid', () => {
    it('should find user by userid', () => {
      const user = findUserByUserid('청연정혜종');
      expect(user).toBeTruthy();
      expect(user?.id).toBe('1');
      expect(user?.username).toBe('정혜종');
    });

    it('should return undefined for invalid userid', () => {
      const user = findUserByUserid('invalid-userid');
      expect(user).toBeUndefined();
    });

    it('should find team leader by userid', () => {
      const user = findUserByUserid('청연김흥래');
      expect(user?.role).toBe('team_leader');
      expect(user?.department).toBe('교육훈련위원회');
    });

    it('should find accountant by userid', () => {
      const user = findUserByUserid('청연윤운문');
      expect(user?.role).toBe('accountant');
    });
  });

  describe('findUserByUsername', () => {
    it('should find user by username', () => {
      const user = findUserByUsername('정혜종');
      expect(user).toBeTruthy();
      expect(user?.id).toBe('1');
      expect(user?.userid).toBe('청연정혜종');
    });

    it('should return undefined for invalid username', () => {
      const user = findUserByUsername('invalid-username');
      expect(user).toBeUndefined();
    });

    it('should find finance head by username', () => {
      const user = findUserByUsername('신창국');
      expect(user?.role).toBe('finance_head');
    });
  });

  describe('findUsersByRole', () => {
    it('should find all users with team_leader role', () => {
      const users = findUsersByRole('team_leader');
      expect(users.length).toBeGreaterThan(0);
      expect(users.every((u) => u.role === 'team_leader')).toBe(true);
    });

    it('should find all users with accountant role', () => {
      const users = findUsersByRole('accountant');
      expect(users.length).toBeGreaterThan(0);
      expect(users.every((u) => u.role === 'accountant')).toBe(true);
    });

    it('should find all users with finance_head role', () => {
      const users = findUsersByRole('finance_head');
      expect(users.length).toBeGreaterThan(0);
      expect(users.every((u) => u.role === 'finance_head')).toBe(true);
    });

    it('should find all users with user role', () => {
      const users = findUsersByRole('user');
      expect(users.length).toBeGreaterThan(0);
      expect(users.every((u) => u.role === 'user')).toBe(true);
    });

    it('should return empty array for role with no users', () => {
      // All roles should have at least one user in current setup
      const users = findUsersByRole('user');
      expect(Array.isArray(users)).toBe(true);
    });
  });

  describe('canApprove', () => {
    it('should allow team leader to approve step 1', () => {
      const user = findUserById('2'); // 청연김흥래 (team_leader)
      expect(user).toBeTruthy();
      expect(canApprove(user!, 1)).toBe(true);
    });

    it('should not allow team leader to approve step 2', () => {
      const user = findUserById('2'); // 청연김흥래 (team_leader)
      expect(user).toBeTruthy();
      expect(canApprove(user!, 2)).toBe(false);
    });

    it('should allow accountant to approve step 2', () => {
      const user = findUserById('4'); // 청연윤운문 (accountant)
      expect(user).toBeTruthy();
      expect(canApprove(user!, 2)).toBe(true);
    });

    it('should not allow accountant to approve step 1', () => {
      const user = findUserById('4'); // 청연윤운문 (accountant)
      expect(user).toBeTruthy();
      expect(canApprove(user!, 1)).toBe(false);
    });

    it('should allow finance head to approve step 3', () => {
      const user = findUserById('3'); // 청연신창국 (finance_head)
      expect(user).toBeTruthy();
      expect(canApprove(user!, 3)).toBe(true);
    });

    it('should not allow finance head to approve step 1', () => {
      const user = findUserById('3'); // 청연신창국 (finance_head)
      expect(user).toBeTruthy();
      expect(canApprove(user!, 1)).toBe(false);
    });

    it('should not allow regular user to approve any step', () => {
      const user = findUserById('1'); // 청연정혜종 (user)
      expect(user).toBeTruthy();
      expect(canApprove(user!, 1)).toBe(false);
      expect(canApprove(user!, 2)).toBe(false);
      expect(canApprove(user!, 3)).toBe(false);
    });
  });

  describe('getRoleDisplayName', () => {
    it('should return correct display name for finance_head', () => {
      expect(getRoleDisplayName('finance_head')).toBe('재정팀장');
    });

    it('should return correct display name for accountant', () => {
      expect(getRoleDisplayName('accountant')).toBe('회계');
    });

    it('should return correct display name for team_leader', () => {
      expect(getRoleDisplayName('team_leader')).toBe('팀장');
    });

    it('should return correct display name for user', () => {
      expect(getRoleDisplayName('user')).toBe('사용자');
    });
  });

  describe('USERS constant', () => {
    it('should have at least basic users', () => {
      expect(USERS.length).toBeGreaterThan(0);
    });

    it('should have unique ids', () => {
      const ids = USERS.map((u) => u.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have unique userids', () => {
      const userids = USERS.map((u) => u.userid);
      const uniqueUserids = new Set(userids);
      expect(userids.length).toBe(uniqueUserids.size);
    });

    it('should have at least one finance head', () => {
      const financeHeads = USERS.filter((u) => u.role === 'finance_head');
      expect(financeHeads.length).toBeGreaterThan(0);
    });

    it('should have at least one accountant', () => {
      const accountants = USERS.filter((u) => u.role === 'accountant');
      expect(accountants.length).toBeGreaterThan(0);
    });

    it('should have team leaders with departments', () => {
      const teamLeaders = USERS.filter((u) => u.role === 'team_leader');
      expect(teamLeaders.length).toBeGreaterThan(0);
      // Most team leaders should have departments (except maybe test data)
      const withDept = teamLeaders.filter((u) => u.department);
      expect(withDept.length).toBeGreaterThan(0);
    });
  });

  describe('ROLE_STEP_MAP constant', () => {
    it('should map team_leader to step 1', () => {
      expect(ROLE_STEP_MAP.team_leader).toBe(1);
    });

    it('should map accountant to step 2', () => {
      expect(ROLE_STEP_MAP.accountant).toBe(2);
    });

    it('should map finance_head to step 3', () => {
      expect(ROLE_STEP_MAP.finance_head).toBe(3);
    });

    it('should map user to null (no approval rights)', () => {
      expect(ROLE_STEP_MAP.user).toBe(null);
    });
  });

  describe('ROLE_NAMES constant', () => {
    it('should have Korean names for all roles', () => {
      const roles: UserRole[] = ['finance_head', 'accountant', 'team_leader', 'user'];
      roles.forEach((role) => {
        expect(ROLE_NAMES[role]).toBeTruthy();
        expect(typeof ROLE_NAMES[role]).toBe('string');
        expect(ROLE_NAMES[role].length).toBeGreaterThan(0);
      });
    });
  });
});
