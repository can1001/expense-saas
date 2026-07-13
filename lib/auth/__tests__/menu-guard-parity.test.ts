/**
 * @jest-environment node
 *
 * AC1: 노출된 메뉴 = 대응 API 200, 숨김 메뉴 = 403.
 *   클라이언트 메뉴 필터와 서버 가드가 동일한 permission 을 사용하므로 모든 역할에서 일치한다.
 * AC2: 인가는 hasPermission 단일 경로로만. menu-permissions 는 하드코딩 역할 배열 없이
 *   permission 프리셋에서 파생된다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ROLE_CODES,
  PERMISSIONS,
  ROLE_PERMISSION_PRESETS,
  subjectPermissions,
  hasPermission,
} from '../permissions';
import {
  MENU_PERMISSIONS,
  requiredPermissionForPath,
  canAccessAdminMenuPath,
  canAccessAdminMenuPathWithRoles,
  filterAdminMenuByRole,
  canAccessApprovalMenu,
  canAccessExtendedMenu,
  canAccessRecurringExpenseMenu,
  canManageAllRecurringExpenses,
  EXTENDED_MENU_ROLES,
  APPROVAL_MENU_ROLES,
  ADMIN_MENU_ROLES,
  RECURRING_EXPENSE_MENU_ROLES,
  APPROVED_EDIT_ROLES,
} from '@/lib/constants/menu-permissions';

/** 서버 가드(withAdminMenu)의 결정: canAccessAdminMenuPathWithRoles */
function serverGuardAllows(role: string, path: string): boolean {
  return canAccessAdminMenuPathWithRoles([role], path);
}

/** 클라이언트 메뉴 노출: 해당 href 항목이 필터 후 남는가 */
function clientMenuShows(role: string, path: string): boolean {
  const filtered = filterAdminMenuByRole(
    [{ items: [{ href: path }] }],
    role
  );
  return filtered.length > 0 && filtered[0].items.length > 0;
}

describe('AC1: 메뉴 노출 ↔ 서버 가드 parity', () => {
  for (const { path } of MENU_PERMISSIONS) {
    it(`모든 역할에서 메뉴노출 = 가드허용: ${path}`, () => {
      for (const role of ROLE_CODES) {
        expect(
          clientMenuShows(role, path),
          `${role} @ ${path} : client vs server`
        ).toBe(serverGuardAllows(role, path));
      }
    });
  }

  it('메뉴노출/가드허용은 대응 permission 보유와 정확히 일치', () => {
    for (const { path, permission } of MENU_PERMISSIONS) {
      for (const role of ROLE_CODES) {
        const perms = subjectPermissions({ roles: [role] });
        // admin 은 all → 항상 노출/허용
        const expected = role === 'admin' ? true : hasPermission(perms, permission);
        expect(clientMenuShows(role, path)).toBe(expected);
        expect(serverGuardAllows(role, path)).toBe(expected);
      }
    }
  });

  it('매핑 없는 admin 전용 경로는 admin 만 접근', () => {
    const secret = '/admin/does-not-exist-in-map';
    expect(requiredPermissionForPath(secret)).toBeNull();
    expect(canAccessAdminMenuPath('admin', secret)).toBe(true);
    expect(canAccessAdminMenuPath('accountant', secret)).toBe(false);
    expect(canAccessAdminMenuPath('finance_head', secret)).toBe(false);
  });

  it('하위 경로(export 등)도 상위 permission 으로 판정', () => {
    // /admin/quarterly-report/export → REPORT_QUARTERLY_READ
    expect(requiredPermissionForPath('/admin/quarterly-report/export')).toBe(
      PERMISSIONS.REPORT_QUARTERLY_READ
    );
  });
});

describe('AC1: 기능 메뉴 predicate = permission 보유', () => {
  it('결재함 predicate = EXPENSE_APPROVE', () => {
    for (const role of ROLE_CODES) {
      const has = hasPermission(subjectPermissions({ roles: [role] }), PERMISSIONS.EXPENSE_APPROVE);
      expect(canAccessApprovalMenu(role)).toBe(has);
    }
  });

  it('간편지출 predicate = SIMPLE_EXPENSE_USE', () => {
    for (const role of ROLE_CODES) {
      const has = hasPermission(subjectPermissions({ roles: [role] }), PERMISSIONS.SIMPLE_EXPENSE_USE);
      expect(canAccessExtendedMenu(role)).toBe(has);
    }
  });

  it('자동이체 predicate = RECURRING_READ / MANAGE_ALL', () => {
    for (const role of ROLE_CODES) {
      const perms = subjectPermissions({ roles: [role] });
      expect(canAccessRecurringExpenseMenu(role)).toBe(hasPermission(perms, PERMISSIONS.RECURRING_READ));
      expect(canManageAllRecurringExpenses(role)).toBe(hasPermission(perms, PERMISSIONS.RECURRING_MANAGE_ALL));
    }
  });
});

describe('AC2: menu-permissions 는 permission 프리셋에서 파생(단일 출처)', () => {
  it('파생된 역할 그룹 배열이 프리셋과 일치', () => {
    const derive = (perm: string) => ROLE_CODES.filter((r) => ROLE_PERMISSION_PRESETS[r].includes(perm as any));
    expect(EXTENDED_MENU_ROLES).toEqual(derive(PERMISSIONS.SIMPLE_EXPENSE_USE));
    expect(APPROVAL_MENU_ROLES).toEqual(derive(PERMISSIONS.EXPENSE_APPROVE));
    expect(ADMIN_MENU_ROLES).toEqual(derive(PERMISSIONS.ADMIN_DASHBOARD_READ));
    expect(RECURRING_EXPENSE_MENU_ROLES).toEqual(derive(PERMISSIONS.RECURRING_READ));
    expect(APPROVED_EDIT_ROLES).toEqual(derive(PERMISSIONS.EXPENSE_EDIT_APPROVED));
  });

  it('menu-permissions.ts 소스에 하드코딩 역할 리터럴 배열이 없다', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib', 'constants', 'menu-permissions.ts'),
      'utf8'
    );
    // 인가용 역할 문자열 배열 리터럴(예: ['admin', 'finance_head', ...])이 없어야 한다.
    // 역할 코드가 배열 리터럴 안에서 연속 등장하는 패턴을 탐지.
    const roleArrayLiteral = /\[\s*'(admin|finance_head|accountant|finance_member|team_leader|admin_assistant|user)'\s*,\s*'(admin|finance_head|accountant|finance_member|team_leader|admin_assistant|user)'/;
    expect(roleArrayLiteral.test(src)).toBe(false);
  });

  it('menu-permissions.ts 는 권한 레지스트리를 import 한다', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib', 'constants', 'menu-permissions.ts'),
      'utf8'
    );
    expect(src).toContain("from '@/lib/auth/permissions'");
    expect(src).toContain('hasPermission');
  });
});
