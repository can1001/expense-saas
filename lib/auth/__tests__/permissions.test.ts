/**
 * @jest-environment node
 *
 * RBAC 권한 레지스트리 테스트
 * - AC4: finance_member 포함 7개 역할 전체 일관성(누락 0)
 * - AC6: 골든 매트릭스 스냅샷 안정(정책 단일 출처 고정)
 */

import { describe, it, expect } from 'vitest';
import {
  ROLE_CODES,
  ROLE_NAMES,
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSION_PRESETS,
  RoleCode,
  Permission,
  isRoleCode,
  isPermission,
  sanitizePermissions,
  PERMISSION_LABELS,
  PERMISSION_GROUPS,
  resolvePermissions,
  subjectPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  individualFlagPermissions,
  presetResolver,
  roleHasPermission,
} from '../permissions';

// ========================================
// AC6 골든 매트릭스 — 역할 × 권한 정본 스냅샷 (spec §4.4)
// 이 매트릭스가 정책의 단일 출처. 프리셋 변경이 여기와 어긋나면 테스트 실패 → 의도적 변경만 통과.
// ========================================
const GOLDEN: Record<Permission, RoleCode[]> = {
  'expense:read.own': ['admin', 'finance_head', 'accountant', 'finance_member', 'team_leader', 'admin_assistant', 'user'],
  'expense:read.department': ['admin', 'finance_head', 'accountant', 'finance_member', 'team_leader'],
  'expense:read.all': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'expense:create': ['admin', 'finance_head', 'accountant', 'finance_member', 'team_leader', 'admin_assistant', 'user'],
  'expense:approve': ['admin', 'finance_head', 'accountant', 'team_leader'],
  'expense:edit_approved': ['admin', 'finance_head', 'accountant', 'admin_assistant'],
  'expense:payment_manage': ['admin', 'finance_head', 'accountant', 'admin_assistant'],
  'expense:bulk_upload': ['admin', 'admin_assistant'],
  'expense:export': ['admin', 'finance_head'],
  'simple_expense:use': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'receipt:read': ['admin', 'finance_head', 'accountant'],
  'recurring:read': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'recurring:manage_all': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'admin:dashboard.read': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'report:budget_execution.read': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'report:hr_admin.read': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'report:quarterly.read': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'report:cumulative.read': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'report:financial.read': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'report:export': ['admin', 'finance_head', 'accountant', 'finance_member'],
  'committee:manage': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'department:manage': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'budget_manager:manage': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'budget_master:manage': ['admin', 'finance_head'],
  'budget:view': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'offering:manage': ['admin', 'finance_head', 'accountant', 'finance_member', 'admin_assistant'],
  'user:read': ['admin'],
  'user:register': ['admin'],
  'user:manage': ['admin'],
  'role:manage': ['admin'],
  'settings:manage': ['admin'],
  'notification:send': ['admin', 'finance_head', 'accountant', 'admin_assistant'],
  'youth:manage': ['admin', 'finance_head', 'accountant', 'team_leader'],
};

describe('permissions registry', () => {
  describe('ROLE_CODES / ROLE_NAMES (AC4)', () => {
    it('should define exactly 7 role codes', () => {
      expect(ROLE_CODES).toEqual([
        'admin', 'finance_head', 'accountant', 'finance_member',
        'team_leader', 'admin_assistant', 'user',
      ]);
    });

    it('should have a Korean name for every role code (누락 0)', () => {
      for (const code of ROLE_CODES) {
        expect(ROLE_NAMES[code]).toBeTruthy();
      }
      expect(Object.keys(ROLE_NAMES).sort()).toEqual([...ROLE_CODES].sort());
    });

    it('should have a preset for every role code including finance_member (AC4)', () => {
      for (const code of ROLE_CODES) {
        expect(ROLE_PERMISSION_PRESETS[code]).toBeDefined();
      }
      expect(Object.keys(ROLE_PERMISSION_PRESETS).sort()).toEqual([...ROLE_CODES].sort());
      // finance_member는 과거 누락 상습 지점 — 최소 관리 메뉴 권한을 가져야 함
      expect(ROLE_PERMISSION_PRESETS.finance_member).toContain(PERMISSIONS.ADMIN_DASHBOARD_READ);
    });

    it('isRoleCode guards correctly', () => {
      expect(isRoleCode('finance_member')).toBe(true);
      expect(isRoleCode('super_admin')).toBe(false);
    });
  });

  describe('PERMISSIONS catalog integrity', () => {
    it('all preset permissions exist in the catalog', () => {
      for (const code of ROLE_CODES) {
        for (const perm of ROLE_PERMISSION_PRESETS[code]) {
          expect(isPermission(perm)).toBe(true);
        }
      }
    });

    it('admin has every permission', () => {
      expect(new Set(ROLE_PERMISSION_PRESETS.admin)).toEqual(new Set(ALL_PERMISSIONS));
    });

    it('isPermission guards correctly', () => {
      expect(isPermission('expense:approve')).toBe(true);
      expect(isPermission('nonexistent:action')).toBe(false);
    });

    it('모든 permission 에 한글 라벨이 존재한다', () => {
      for (const p of ALL_PERMISSIONS) {
        expect(PERMISSION_LABELS[p], `${p} 라벨 누락`).toBeTruthy();
      }
      expect(Object.keys(PERMISSION_LABELS).sort()).toEqual([...ALL_PERMISSIONS].sort());
    });

    it('PERMISSION_GROUPS 가 모든 permission 을 정확히 한 번씩 포함', () => {
      const grouped = PERMISSION_GROUPS.flatMap((g) => g.permissions);
      expect(grouped.slice().sort()).toEqual([...ALL_PERMISSIONS].sort());
      expect(new Set(grouped).size).toBe(grouped.length); // 중복 없음
    });

    it('sanitizePermissions 는 유효 코드만 남기고 중복 제거', () => {
      expect(
        sanitizePermissions([
          'expense:approve',
          'bogus:perm',
          'expense:approve',
          123,
          null,
          'settings:manage',
        ])
      ).toEqual(['expense:approve', 'settings:manage']);
      expect(sanitizePermissions('not-array')).toEqual([]);
      expect(sanitizePermissions(undefined)).toEqual([]);
    });
  });

  describe('GOLDEN matrix (AC6) — 역할별 권한이 정책과 정확히 일치', () => {
    for (const perm of ALL_PERMISSIONS) {
      it(`${perm} → 정확히 정해진 역할만 보유`, () => {
        const expected = new Set(GOLDEN[perm]);
        for (const role of ROLE_CODES) {
          const has = ROLE_PERMISSION_PRESETS[role].includes(perm);
          expect(has, `${role} 의 ${perm}`).toBe(expected.has(role));
        }
      });
    }

    it('골든 매트릭스가 모든 permission을 커버(신규 permission 추가 시 매트릭스 갱신 강제)', () => {
      expect(Object.keys(GOLDEN).sort()).toEqual([...ALL_PERMISSIONS].sort());
    });
  });

  describe('resolvePermissions', () => {
    it('single role → preset', () => {
      const set = resolvePermissions(['user']);
      expect(set.has(PERMISSIONS.EXPENSE_CREATE)).toBe(true);
      expect(set.has(PERMISSIONS.EXPENSE_APPROVE)).toBe(false);
    });

    it('multiple roles → union (User.role ∪ UserYearRole)', () => {
      // user(권한 최소) + team_leader(승인) 합집합
      const set = resolvePermissions(['user', 'team_leader']);
      expect(set.has(PERMISSIONS.EXPENSE_APPROVE)).toBe(true);
      expect(set.has(PERMISSIONS.EXPENSE_READ_DEPARTMENT)).toBe(true);
    });

    it('granted adds, revoked removes', () => {
      const set = resolvePermissions(['user'], {
        granted: [PERMISSIONS.USER_REGISTER],
        revoked: [PERMISSIONS.EXPENSE_CREATE],
      });
      expect(set.has(PERMISSIONS.USER_REGISTER)).toBe(true);
      expect(set.has(PERMISSIONS.EXPENSE_CREATE)).toBe(false);
    });

    it('unknown role contributes nothing', () => {
      expect(resolvePermissions(['ghost']).size).toBe(0);
    });

    it('custom resolver (DB 백엔드) 를 사용할 수 있다 (AC3 기반)', () => {
      const dbResolver = (role: string) =>
        role === 'custom' ? [PERMISSIONS.OFFERING_MANAGE] : [];
      const set = resolvePermissions(['custom'], { resolver: dbResolver });
      expect(set.has(PERMISSIONS.OFFERING_MANAGE)).toBe(true);
      expect(set.has(PERMISSIONS.EXPENSE_CREATE)).toBe(false);
    });

    it('ignores non-catalog permissions from resolver', () => {
      const set = resolvePermissions(['x'], { resolver: () => ['bogus:perm'] });
      expect(set.size).toBe(0);
    });
  });

  describe('hasPermission / hasAny / hasAll', () => {
    const subject = { roles: ['team_leader'] };

    it('hasPermission with subject', () => {
      expect(hasPermission(subject, PERMISSIONS.EXPENSE_APPROVE)).toBe(true);
      expect(hasPermission(subject, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    });

    it('hasPermission with precomputed Set', () => {
      const set = subjectPermissions(subject);
      expect(hasPermission(set, PERMISSIONS.EXPENSE_APPROVE)).toBe(true);
    });

    it('hasAnyPermission', () => {
      expect(hasAnyPermission(subject, [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.EXPENSE_APPROVE])).toBe(true);
      expect(hasAnyPermission(subject, [PERMISSIONS.SETTINGS_MANAGE])).toBe(false);
    });

    it('hasAllPermissions', () => {
      expect(hasAllPermissions(subject, [PERMISSIONS.EXPENSE_APPROVE, PERMISSIONS.EXPENSE_CREATE])).toBe(true);
      expect(hasAllPermissions(subject, [PERMISSIONS.EXPENSE_APPROVE, PERMISSIONS.SETTINGS_MANAGE])).toBe(false);
    });

    it('hasAny/hasAll accept precomputed Set', () => {
      const set = subjectPermissions(subject);
      expect(hasAnyPermission(set, [PERMISSIONS.EXPENSE_APPROVE])).toBe(true);
      expect(hasAllPermissions(set, [PERMISSIONS.EXPENSE_APPROVE])).toBe(true);
    });
  });

  describe('roleHasPermission (인가 단일 진입점)', () => {
    it('단일 역할', () => {
      expect(roleHasPermission('team_leader', PERMISSIONS.EXPENSE_APPROVE)).toBe(true);
      expect(roleHasPermission('user', PERMISSIONS.EXPENSE_APPROVE)).toBe(false);
    });
    it('다중 역할(합집합)', () => {
      expect(roleHasPermission(['user', 'team_leader'], PERMISSIONS.EXPENSE_APPROVE)).toBe(true);
    });
    it('각 permission ↔ 골든 매트릭스 일치', () => {
      for (const perm of ALL_PERMISSIONS) {
        for (const role of ROLE_CODES) {
          expect(roleHasPermission(role, perm)).toBe(GOLDEN[perm].includes(role));
        }
      }
    });
    it('custom resolver 사용', () => {
      const r = (role: string) => (role === 'z' ? [PERMISSIONS.OFFERING_MANAGE] : []);
      expect(roleHasPermission('z', PERMISSIONS.OFFERING_MANAGE, r)).toBe(true);
    });
  });

  describe('individualFlagPermissions', () => {
    it('canRegisterUsers → user:register', () => {
      expect(individualFlagPermissions({ canRegisterUsers: true })).toEqual([PERMISSIONS.USER_REGISTER]);
      expect(individualFlagPermissions({ canRegisterUsers: false })).toEqual([]);
      expect(individualFlagPermissions({})).toEqual([]);
    });
  });

  describe('presetResolver', () => {
    it('returns preset for known role, empty for unknown', () => {
      expect(presetResolver('admin').length).toBeGreaterThan(0);
      expect(presetResolver('ghost')).toEqual([]);
    });
  });
});
