import { describe, it, expect } from 'vitest';
import {
  canApprove,
  getRoleDisplayName,
  ROLE_STEP_MAP,
  ROLE_NAMES,
  type UserRole,
} from '../users';

/**
 * 사용자 관련 테스트
 *
 * 참고: findUserById, findUserByUserid, findUserByUsername, findUsersByRole
 * 함수들은 이제 비동기 함수이며 DB에서 데이터를 조회합니다.
 * 이러한 함수들의 테스트는 통합 테스트로 이동되었습니다.
 *
 * USERS 상수는 deprecated되었으며 빈 배열입니다.
 * 새 코드에서는 API (/api/users)를 통해 사용자 목록을 가져와야 합니다.
 */

describe('users', () => {
  describe('canApprove', () => {
    it('should allow team leader to approve step 1', () => {
      const user = { id: '1', userid: 'test', username: 'Test', role: 'team_leader' as UserRole, department: '테스트팀' };
      expect(canApprove(user, 1)).toBe(true);
    });

    it('should not allow team leader to approve step 2', () => {
      const user = { id: '1', userid: 'test', username: 'Test', role: 'team_leader' as UserRole, department: '테스트팀' };
      expect(canApprove(user, 2)).toBe(false);
    });

    it('should allow accountant to approve step 2', () => {
      const user = { id: '1', userid: 'test', username: 'Test', role: 'accountant' as UserRole, department: null };
      expect(canApprove(user, 2)).toBe(true);
    });

    it('should not allow accountant to approve step 1', () => {
      const user = { id: '1', userid: 'test', username: 'Test', role: 'accountant' as UserRole, department: null };
      expect(canApprove(user, 1)).toBe(false);
    });

    it('should allow finance head to approve step 3', () => {
      const user = { id: '1', userid: 'test', username: 'Test', role: 'finance_head' as UserRole, department: null };
      expect(canApprove(user, 3)).toBe(true);
    });

    it('should not allow finance head to approve step 1', () => {
      const user = { id: '1', userid: 'test', username: 'Test', role: 'finance_head' as UserRole, department: null };
      expect(canApprove(user, 1)).toBe(false);
    });

    it('should not allow regular user to approve any step', () => {
      const user = { id: '1', userid: 'test', username: 'Test', role: 'user' as UserRole, department: null };
      expect(canApprove(user, 1)).toBe(false);
      expect(canApprove(user, 2)).toBe(false);
      expect(canApprove(user, 3)).toBe(false);
    });

    it('should not allow admin to approve any step (admin has different permissions)', () => {
      const user = { id: '1', userid: 'test', username: 'Test', role: 'admin' as UserRole, department: null };
      expect(canApprove(user, 1)).toBe(false);
      expect(canApprove(user, 2)).toBe(false);
      expect(canApprove(user, 3)).toBe(false);
    });

    it('should not allow admin_assistant to approve any step', () => {
      const user = { id: '1', userid: 'test', username: 'Test', role: 'admin_assistant' as UserRole, department: null };
      expect(canApprove(user, 1)).toBe(false);
      expect(canApprove(user, 2)).toBe(false);
      expect(canApprove(user, 3)).toBe(false);
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

    it('should return correct display name for admin', () => {
      expect(getRoleDisplayName('admin')).toBe('관리자');
    });

    it('should return correct display name for admin_assistant', () => {
      expect(getRoleDisplayName('admin_assistant')).toBe('행정간사');
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

    it('should map admin to null (admin has different permissions)', () => {
      expect(ROLE_STEP_MAP.admin).toBe(null);
    });

    it('should map admin_assistant to null (no approval rights)', () => {
      expect(ROLE_STEP_MAP.admin_assistant).toBe(null);
    });
  });

  describe('ROLE_NAMES constant', () => {
    it('should have Korean names for all roles', () => {
      const roles: UserRole[] = ['admin', 'finance_head', 'accountant', 'team_leader', 'admin_assistant', 'user'];
      roles.forEach((role) => {
        expect(ROLE_NAMES[role]).toBeTruthy();
        expect(typeof ROLE_NAMES[role]).toBe('string');
        expect(ROLE_NAMES[role].length).toBeGreaterThan(0);
      });
    });

    it('should have correct Korean names', () => {
      expect(ROLE_NAMES.admin).toBe('관리자');
      expect(ROLE_NAMES.finance_head).toBe('재정팀장');
      expect(ROLE_NAMES.accountant).toBe('회계');
      expect(ROLE_NAMES.team_leader).toBe('팀장');
      expect(ROLE_NAMES.admin_assistant).toBe('행정간사');
      expect(ROLE_NAMES.user).toBe('사용자');
    });
  });
});
