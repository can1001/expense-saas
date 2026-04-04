/**
 * getDisplayRole 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  getDisplayRole,
  ROLE_PRIORITY_ORDER,
  UserWithYearRoles,
  YearRole,
} from '../utils/getDisplayRole';

describe('getDisplayRole', () => {
  const createYearRole = (role: string, department: string | null = null): YearRole => ({
    id: `yr-${role}`,
    role,
    department,
    year: 2026,
  });

  describe('yearRoles가 없는 경우', () => {
    it('user.role을 반환한다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
      };

      const result = getDisplayRole(user);

      expect(result).toEqual({ role: 'user', department: null });
    });

    it('user.department를 함께 반환한다', () => {
      const user: UserWithYearRoles = {
        role: 'admin',
        department: '재정팀',
      };

      const result = getDisplayRole(user);

      expect(result).toEqual({ role: 'admin', department: '재정팀' });
    });

    it('빈 yearRoles 배열이면 user.role을 반환한다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
        yearRoles: [],
      };

      const result = getDisplayRole(user);

      expect(result).toEqual({ role: 'user', department: null });
    });
  });

  describe('yearRoles가 있는 경우', () => {
    it('단일 yearRole이 있으면 해당 역할을 반환한다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
        yearRoles: [createYearRole('accountant')],
      };

      const result = getDisplayRole(user);

      expect(result).toEqual({ role: 'accountant', department: null });
    });

    it('yearRole의 department를 반환한다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
        yearRoles: [createYearRole('team_leader', '기획팀')],
      };

      const result = getDisplayRole(user);

      expect(result).toEqual({ role: 'team_leader', department: '기획팀' });
    });
  });

  describe('우선순위 정렬', () => {
    it('finance_head가 가장 높은 우선순위를 가진다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
        yearRoles: [
          createYearRole('team_leader', '기획팀'),
          createYearRole('finance_head'),
          createYearRole('accountant'),
        ],
      };

      const result = getDisplayRole(user);

      expect(result.role).toBe('finance_head');
    });

    it('accountant가 finance_head 다음 우선순위를 가진다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
        yearRoles: [
          createYearRole('team_leader', '기획팀'),
          createYearRole('accountant'),
          createYearRole('admin_assistant'),
        ],
      };

      const result = getDisplayRole(user);

      expect(result.role).toBe('accountant');
    });

    it('admin_assistant가 team_leader보다 높은 우선순위를 가진다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
        yearRoles: [
          createYearRole('team_leader', '기획팀'),
          createYearRole('admin_assistant'),
        ],
      };

      const result = getDisplayRole(user);

      expect(result.role).toBe('admin_assistant');
    });

    it('team_leader가 정의된 역할 중 가장 낮은 우선순위를 가진다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
        yearRoles: [createYearRole('team_leader', '기획팀')],
      };

      const result = getDisplayRole(user);

      expect(result.role).toBe('team_leader');
      expect(result.department).toBe('기획팀');
    });

    it('미정의 역할은 가장 낮은 우선순위를 가진다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
        yearRoles: [
          createYearRole('unknown_role'),
          createYearRole('team_leader', '기획팀'),
        ],
      };

      const result = getDisplayRole(user);

      expect(result.role).toBe('team_leader');
    });

    it('모두 미정의 역할이면 첫 번째 역할을 반환한다', () => {
      const user: UserWithYearRoles = {
        role: 'user',
        department: null,
        yearRoles: [
          createYearRole('custom_role_1'),
          createYearRole('custom_role_2'),
        ],
      };

      const result = getDisplayRole(user);

      // 둘 다 999 인덱스이므로 원본 순서 유지
      expect(result.role).toBe('custom_role_1');
    });
  });

  describe('ROLE_PRIORITY_ORDER 상수', () => {
    it('올바른 순서로 정의되어 있다', () => {
      expect(ROLE_PRIORITY_ORDER).toEqual([
        'finance_head',
        'accountant',
        'admin_assistant',
        'team_leader',
      ]);
    });
  });
});
