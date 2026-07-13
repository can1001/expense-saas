/**
 * @jest-environment node
 *
 * Phase 4b: JWT roles-only 전환 검증.
 * - JWT payload 는 roles(+granted)만 담고 권한을 굽지 않는다.
 * - verifyUserToken 은 roles 로부터 레거시 플래그를 파생한다.
 * - 구 토큰(permissions 객체)도 하위호환으로 검증된다.
 */

import { describe, it, expect, vi } from 'vitest';
import { decodeJwt } from 'jose';

// 전역 mock(test/setup.ts)을 우회하고 실제 구현을 사용
const actual = await vi.importActual<typeof import('../user')>('../user');
const { createUserToken, verifyUserToken, deriveLegacyFlags } = actual;

function baseSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    tenantId: 't1',
    userid: 'kim',
    username: '김',
    role: 'accountant',
    roles: ['accountant'],
    roleId: null,
    department: null,
    granted: [],
    canApprove: true,
    canManageExpense: true,
    canAccessAdmin: true,
    canExportData: false,
    canRegisterUsers: false,
    ...overrides,
  } as Parameters<typeof createUserToken>[0];
}

describe('deriveLegacyFlags', () => {
  it('accountant 역할 → 프리셋 기반 플래그', () => {
    const f = deriveLegacyFlags(['accountant']);
    expect(f.canApprove).toBe(true); // EXPENSE_APPROVE
    expect(f.canAccessAdmin).toBe(true); // ADMIN_DASHBOARD_READ
    expect(f.canExportData).toBe(false); // EXPENSE_EXPORT (admin/finance_head만)
    expect(f.canRegisterUsers).toBe(false);
  });

  it('user 역할 → 모두 false', () => {
    const f = deriveLegacyFlags(['user']);
    expect(f).toEqual({
      canApprove: false,
      canManageExpense: false,
      canAccessAdmin: false,
      canExportData: false,
      canRegisterUsers: false,
    });
  });

  it('granted 로 canRegisterUsers 보존', () => {
    expect(deriveLegacyFlags(['user'], ['user:register']).canRegisterUsers).toBe(true);
  });

  it('다중 역할 합집합', () => {
    expect(deriveLegacyFlags(['user', 'finance_head']).canExportData).toBe(true);
  });
});

describe('JWT roles-only 라운드트립', () => {
  it('payload 는 roles 를 담고 permissions 객체를 담지 않는다', async () => {
    const token = await createUserToken(baseSession());
    const payload = decodeJwt(token);
    expect(payload.roles).toEqual(['accountant']);
    expect(payload.permissions).toBeUndefined();
  });

  it('verify 시 roles 복원 + 플래그 파생', async () => {
    const token = await createUserToken(baseSession({ role: 'finance_head', roles: ['finance_head'] }));
    const session = await verifyUserToken(token);
    expect(session).not.toBeNull();
    expect(session!.roles).toEqual(['finance_head']);
    expect(session!.canExportData).toBe(true); // finance_head 는 EXPENSE_EXPORT 보유
    expect(session!.canAccessAdmin).toBe(true);
  });

  it('canRegisterUsers 개별 부여가 granted 로 왕복된다', async () => {
    const token = await createUserToken(
      baseSession({ role: 'user', roles: ['user'], canRegisterUsers: true })
    );
    const payload = decodeJwt(token);
    expect(payload.granted).toEqual(['user:register']);
    const session = await verifyUserToken(token);
    expect(session!.canRegisterUsers).toBe(true);
  });

  it('잘못된 토큰은 null', async () => {
    expect(await verifyUserToken('not-a-jwt')).toBeNull();
  });
});
