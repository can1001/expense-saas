/**
 * @jest-environment node
 *
 * B2: 조직 선택용 임시 토큰 검증.
 * - 임시 토큰에는 tenantId 클레임이 없다 (tenantId는 토큰 안에만 원칙과 결합 — 미확정 상태 표현).
 * - verifyUserToken은 임시 토큰을 정식 세션으로 인정하지 않는다.
 * - verifyPendingSelectionToken은 정식 토큰을 거부한다.
 */

import { describe, it, expect, vi } from 'vitest';
import { decodeJwt } from 'jose';

// 전역 mock(test/setup.ts)을 우회하고 실제 구현을 사용
const actual = await vi.importActual<typeof import('../user')>('../user');
const {
  createUserToken,
  verifyUserToken,
  createPendingSelectionToken,
  verifyPendingSelectionToken,
  createUserTokenCookie,
  PENDING_SELECTION_MAX_AGE_SECONDS,
} = actual;

const pendingUser = { id: 'u1', userid: 'kim', username: '김' };

function fullSession() {
  return {
    id: 'u1',
    tenantId: 't1',
    userid: 'kim',
    username: '김',
    role: 'user',
    roles: ['user'],
    roleId: null,
    department: null,
    granted: [],
    canApprove: false,
    canManageExpense: false,
    canAccessAdmin: false,
    canExportData: false,
    canRegisterUsers: false,
  } as Parameters<typeof createUserToken>[0];
}

describe('createPendingSelectionToken', () => {
  it('tenantId 클레임 없이 pendingTenantSelection 표식만 담는다', async () => {
    const token = await createPendingSelectionToken(pendingUser);
    const payload = decodeJwt(token);

    expect(payload.sub).toBe('u1');
    expect(payload.pendingTenantSelection).toBe(true);
    expect(payload).not.toHaveProperty('tenantId');
  });

  it('verifyPendingSelectionToken으로 검증된다', async () => {
    const token = await createPendingSelectionToken(pendingUser);

    await expect(verifyPendingSelectionToken(token)).resolves.toEqual({
      id: 'u1',
      userid: 'kim',
      username: '김',
    });
  });
});

describe('토큰 종류 간 경계', () => {
  it('임시 토큰은 verifyUserToken에서 거부된다 (정식 세션 아님)', async () => {
    const token = await createPendingSelectionToken(pendingUser);

    await expect(verifyUserToken(token)).resolves.toBeNull();
  });

  it('정식 토큰은 verifyPendingSelectionToken에서 거부된다', async () => {
    const token = await createUserToken(fullSession());

    await expect(verifyPendingSelectionToken(token)).resolves.toBeNull();
  });

  it('위조 토큰은 둘 다 거부된다', async () => {
    await expect(verifyPendingSelectionToken('invalid-token')).resolves.toBeNull();
    await expect(verifyUserToken('invalid-token')).resolves.toBeNull();
  });
});

describe('createUserTokenCookie 만료 옵션', () => {
  it('기본은 24시간, 임시 토큰용 짧은 만료를 지정할 수 있다', () => {
    expect(createUserTokenCookie('t')).toContain('Max-Age=86400');
    expect(createUserTokenCookie('t', PENDING_SELECTION_MAX_AGE_SECONDS)).toContain(
      'Max-Age=600'
    );
  });
});
