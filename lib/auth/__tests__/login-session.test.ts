/**
 * login-session 헬퍼 테스트 — 홈/게스트 역할 파생(권한 상승 방지) 단일 출처 검증.
 *
 * buildTenantSession은 deriveLegacyFlags·membershipRoleToRoleCode(순수 함수)만 쓰므로
 * 모킹 없이 실제 구현으로 검증한다.
 */

import { describe, it, expect } from 'vitest';
import { buildTenantSession, type TenantSessionUser } from '../login-session';

const homeUser: TenantSessionUser = {
  id: 'user-1',
  tenantId: 'tenant-home',
  userid: 'testuser',
  username: '테스트유저',
  role: 'admin',
  roleId: 'role-admin',
  department: '재정팀',
  canRegisterUsers: true,
};

describe('buildTenantSession — 홈/게스트 역할 파생', () => {
  it('홈 테넌트로의 세션은 기존 User.role/roleId/부서·개별권한을 유지한다', () => {
    const session = buildTenantSession(homeUser, 'tenant-home', 'MEMBER');

    expect(session.tenantId).toBe('tenant-home');
    expect(session.role).toBe('admin');
    expect(session.roles).toEqual(['admin']);
    expect(session.roleId).toBe('role-admin');
    expect(session.department).toBe('재정팀');
    // admin은 관리자 권한 파생
    expect(session.canAccessAdmin).toBe(true);
    // canRegisterUsers 개별 권한 유지
    expect(session.granted).toContain('user:register');
  });

  it('게스트 테넌트(MEMBER)면 홈 admin 권한이 넘어가지 않는다', () => {
    const session = buildTenantSession(homeUser, 'tenant-guest', 'MEMBER');

    expect(session.tenantId).toBe('tenant-guest');
    // Membership.role(MEMBER)에서만 파생 → user
    expect(session.role).toBe('user');
    expect(session.roles).toEqual(['user']);
    // 홈 속성 미전달
    expect(session.roleId).toBeNull();
    expect(session.department).toBeNull();
    expect(session.granted).toEqual([]);
    expect(session.canAccessAdmin).toBe(false);
    expect(session.canManageExpense).toBe(false);
    expect(session.canRegisterUsers).toBe(false);
  });

  it('게스트 테넌트에 TENANT_ADMIN으로 소속되면 admin 역할이 부여된다', () => {
    const memberUser: TenantSessionUser = { ...homeUser, role: 'user', roleId: 'role-1', canRegisterUsers: false };
    const session = buildTenantSession(memberUser, 'tenant-guest', 'TENANT_ADMIN');

    expect(session.role).toBe('admin');
    expect(session.roles).toEqual(['admin']);
    expect(session.canAccessAdmin).toBe(true);
  });

  it('게스트인데 membershipRole이 없으면 최소 권한(MEMBER→user)으로 간주한다', () => {
    const session = buildTenantSession(homeUser, 'tenant-guest', null);

    expect(session.role).toBe('user');
    expect(session.canAccessAdmin).toBe(false);
  });

  it('User.tenantId가 null이면 빈 문자열 tenantId 세션은 홈으로 간주된다 (0건 폴백)', () => {
    const noHome: TenantSessionUser = { ...homeUser, tenantId: null, role: 'user' };
    const session = buildTenantSession(noHome, '', null);

    // sessionTenantId('')와 user.tenantId(null→'')가 같으므로 홈 취급 — User.role 유지
    expect(session.role).toBe('user');
    expect(session.tenantId).toBe('');
  });
});
