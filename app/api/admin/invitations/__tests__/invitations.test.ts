/**
 * /api/admin/invitations 테스트 (ARC-003 §4.2, C3)
 *
 * 테스트 대상:
 * - GET/POST 모두 USER_REGISTER 권한으로 래핑됨
 * - tenantId는 세션(JWT 클레임)에서만 — 바디의 tenantId는 무시 (공통 원칙 2)
 * - 잘못된 role → 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// withPermissions 모킹 — 요구 권한을 래퍼에 기록해 검증 가능하게 한다
vi.mock('@/lib/auth/user', () => ({
  withPermissions: vi.fn((permission: string, handler: unknown) => {
    const wrapped = async (req: NextRequest) =>
      (handler as (req: NextRequest, ctx: unknown) => Promise<Response>)(req, {
        params: Promise.resolve({}),
        user: { id: 'admin-1', tenantId: 'tenant-A', role: 'admin' },
      });
    (wrapped as unknown as { permission: string }).permission = permission;
    return wrapped;
  }),
}));

vi.mock('@/lib/services/invitation', () => ({
  createInvitation: vi.fn(),
  listInvitations: vi.fn(),
}));

import { GET, POST } from '../route';
import { createInvitation, listInvitations } from '@/lib/services/invitation';
import { PERMISSIONS } from '@/lib/auth/permissions';

const mockCreateInvitation = createInvitation as ReturnType<typeof vi.fn>;
const mockListInvitations = listInvitations as ReturnType<typeof vi.fn>;

function createRequest(method: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/invitations', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// 라우트 핸들러의 두 번째 인자 (params) — 모킹된 withPermissions에서는 사용되지 않는다
const routeContext = { params: Promise.resolve({}) };

const sampleInvitation = {
  id: 'inv-1',
  tenantId: 'tenant-A',
  email: 'invitee@example.com',
  role: 'MEMBER',
  token: 'a'.repeat(64),
  expiresAt: new Date('2026-07-25').toISOString(),
  acceptedAt: null,
  invitedById: 'admin-1',
  createdAt: new Date('2026-07-18').toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListInvitations.mockResolvedValue([sampleInvitation]);
  mockCreateInvitation.mockResolvedValue(sampleInvitation);
});

describe('/api/admin/invitations — 권한 (C3)', () => {
  it('GET/POST 모두 USER_REGISTER 권한으로 래핑된다', () => {
    expect((GET as unknown as { permission: string }).permission).toBe(
      PERMISSIONS.USER_REGISTER
    );
    expect((POST as unknown as { permission: string }).permission).toBe(
      PERMISSIONS.USER_REGISTER
    );
  });
});

describe('GET /api/admin/invitations (C3)', () => {
  it('세션 테넌트 스코프로 목록을 조회한다', async () => {
    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockListInvitations).toHaveBeenCalledWith('tenant-A');
    expect(data).toHaveLength(1);
    expect(data[0].token).toBe(sampleInvitation.token);
  });
});

describe('POST /api/admin/invitations (C3)', () => {
  it('세션의 tenantId·유저 id로 초대를 생성한다 (201)', async () => {
    const response = await POST(
      createRequest('POST', { email: 'invitee@example.com', role: 'MEMBER' }),
      routeContext
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockCreateInvitation).toHaveBeenCalledWith({
      tenantId: 'tenant-A',
      email: 'invitee@example.com',
      role: 'MEMBER',
      invitedById: 'admin-1',
    });
    expect(data.token).toBe(sampleInvitation.token);
  });

  it('바디로 보낸 tenantId는 무시된다 — 세션 값만 사용 (공통 원칙 2)', async () => {
    const response = await POST(
      createRequest('POST', { tenantId: 'tenant-EVIL', role: 'MEMBER' }),
      routeContext
    );

    expect(response.status).toBe(201);
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-A' })
    );
  });

  it('허용되지 않는 role이면 400', async () => {
    const response = await POST(createRequest('POST', { role: 'SUPER_ADMIN' }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('초대 정보가 올바르지 않습니다');
    expect(mockCreateInvitation).not.toHaveBeenCalled();
  });

  it('잘못된 이메일 형식이면 400', async () => {
    const response = await POST(createRequest('POST', { email: 'not-an-email' }), routeContext);

    expect(response.status).toBe(400);
    expect(mockCreateInvitation).not.toHaveBeenCalled();
  });
});
