/**
 * @jest-environment node
 *
 * AC3: Role.permissions 변경이 재로그인 없이 캐시 TTL 내(또는 무효화 즉시) 반영
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTenantRoleResolver,
  invalidateRolePermissionCache,
  buildResolver,
  _rolePermissionCacheSize,
  RoleLoader,
} from '../role-permission-cache';
import { PERMISSIONS, resolvePermissions } from '../permissions';

describe('role-permission-cache (AC3)', () => {
  beforeEach(() => {
    invalidateRolePermissionCache(); // 전체 초기화
  });

  it('DB 로더 결과로 resolver 를 구성한다', async () => {
    const loader: RoleLoader = async () => [
      { code: 'custom_role', permissions: [PERMISSIONS.OFFERING_MANAGE] },
    ];
    const resolver = await getTenantRoleResolver('t1', { loader });
    expect(resolver('custom_role')).toEqual([PERMISSIONS.OFFERING_MANAGE]);
  });

  it('DB에 없는 역할/빈 permissions 는 코드 프리셋으로 폴백', async () => {
    const loader: RoleLoader = async () => [
      { code: 'admin', permissions: [] }, // 빈 배열 → 프리셋 폴백
    ];
    const resolver = await getTenantRoleResolver('t1', { loader });
    // admin 프리셋은 모든 권한 포함
    expect(resolver('admin')).toContain(PERMISSIONS.SETTINGS_MANAGE);
    // 로더에 아예 없는 역할도 프리셋 폴백
    expect(resolver('team_leader')).toContain(PERMISSIONS.EXPENSE_APPROVE);
  });

  it('캐시가 유효한 동안 loader 를 다시 호출하지 않는다', async () => {
    let calls = 0;
    const loader: RoleLoader = async () => {
      calls++;
      return [{ code: 'r', permissions: [PERMISSIONS.BUDGET_VIEW] }];
    };
    await getTenantRoleResolver('t1', { loader });
    await getTenantRoleResolver('t1', { loader });
    expect(calls).toBe(1);
  });

  it('무효화 후에는 변경된 permissions 를 즉시 반영한다 (재로그인 불필요)', async () => {
    let version = 1;
    const loader: RoleLoader = async () => [
      {
        code: 'accountant',
        permissions:
          version === 1
            ? [PERMISSIONS.EXPENSE_APPROVE]
            : [PERMISSIONS.EXPENSE_APPROVE, PERMISSIONS.SETTINGS_MANAGE],
      },
    ];

    // v1 로드
    let resolver = await getTenantRoleResolver('t1', { loader });
    let perms = resolvePermissions(['accountant'], { resolver });
    expect(perms.has(PERMISSIONS.SETTINGS_MANAGE)).toBe(false);

    // DB 변경 발생
    version = 2;
    // 무효화 없이는 캐시된 v1 유지
    resolver = await getTenantRoleResolver('t1', { loader });
    perms = resolvePermissions(['accountant'], { resolver });
    expect(perms.has(PERMISSIONS.SETTINGS_MANAGE)).toBe(false);

    // 역할 변경 시 무효화 → 즉시 반영
    invalidateRolePermissionCache('t1');
    resolver = await getTenantRoleResolver('t1', { loader });
    perms = resolvePermissions(['accountant'], { resolver });
    expect(perms.has(PERMISSIONS.SETTINGS_MANAGE)).toBe(true);
  });

  it('TTL 만료 시 자동 재적재된다', async () => {
    let calls = 0;
    const loader: RoleLoader = async () => {
      calls++;
      return [{ code: 'r', permissions: [PERMISSIONS.BUDGET_VIEW] }];
    };
    let clock = 1000;
    const now = () => clock;

    await getTenantRoleResolver('t1', { loader, ttlMs: 100, now });
    expect(calls).toBe(1);

    clock = 1050; // TTL 내
    await getTenantRoleResolver('t1', { loader, ttlMs: 100, now });
    expect(calls).toBe(1);

    clock = 1200; // TTL 만료
    await getTenantRoleResolver('t1', { loader, ttlMs: 100, now });
    expect(calls).toBe(2);
  });

  it('테넌트별로 캐시가 분리된다', async () => {
    const loader: RoleLoader = async (tenantId) => [
      { code: 'r', permissions: tenantId === 't1' ? [PERMISSIONS.BUDGET_VIEW] : [PERMISSIONS.OFFERING_MANAGE] },
    ];
    const r1 = await getTenantRoleResolver('t1', { loader });
    const r2 = await getTenantRoleResolver('t2', { loader });
    expect(r1('r')).toEqual([PERMISSIONS.BUDGET_VIEW]);
    expect(r2('r')).toEqual([PERMISSIONS.OFFERING_MANAGE]);
    expect(_rolePermissionCacheSize()).toBe(2);
  });

  it('invalidate 전체 초기화', async () => {
    const loader: RoleLoader = async () => [{ code: 'r', permissions: [] }];
    await getTenantRoleResolver('t1', { loader });
    await getTenantRoleResolver('t2', { loader });
    expect(_rolePermissionCacheSize()).toBe(2);
    invalidateRolePermissionCache();
    expect(_rolePermissionCacheSize()).toBe(0);
  });

  it('buildResolver 직접 사용', () => {
    const resolver = buildResolver(new Map([['x', [PERMISSIONS.BUDGET_VIEW]]]));
    expect(resolver('x')).toEqual([PERMISSIONS.BUDGET_VIEW]);
    expect(resolver('user')).toContain(PERMISSIONS.EXPENSE_CREATE); // 폴백
  });
});
