/**
 * Invitation 서비스 테스트 (ARC-003 §4.2, C3)
 *
 * 테스트 대상:
 * - createInvitation: 랜덤 토큰(32바이트 hex) + 7일 유효기간 + 기본 역할 MEMBER
 * - getValidInvitation: 미존재/기수락/만료/비활성 테넌트 거부 (Acceptance: 재사용 불가)
 * - acceptInvitation: User·AuthAccount·Membership이 단일 트랜잭션으로 생성 (부분 생성 없음)
 * - 카카오 회원번호가 타 유저에 연결돼 있으면 거부 (계정 탈취 방지)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prismaBase: {
    invitation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/services/user-service', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}));

import {
  acceptInvitation,
  createInvitation,
  getValidInvitation,
  InvitationError,
  INVITATION_EXPIRES_DAYS,
  listInvitations,
} from '../invitation';
import { prismaBase } from '@/lib/prisma';
import { hashPassword } from '@/lib/services/user-service';

const mockPrisma = prismaBase as unknown as {
  invitation: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

// 트랜잭션 클라이언트 모킹 — $transaction 콜백에 그대로 전달된다
function createTxMock() {
  return {
    invitation: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    authAccount: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'auth-1' }),
    },
    membership: {
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
  };
}

type TxMock = ReturnType<typeof createTxMock>;

let tx: TxMock;

const activeTenant = {
  id: 'tenant-A',
  name: '청연컨설팅',
  subdomain: 'chungyeon',
  isActive: true,
};

function validInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    tenantId: 'tenant-A',
    email: 'invitee@example.com',
    role: 'MEMBER',
    token: 'valid-token',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    acceptedAt: null,
    invitedById: 'admin-1',
    createdAt: new Date('2026-07-18'),
    tenant: activeTenant,
    ...overrides,
  };
}

const createdUser = {
  id: 'user-new',
  tenantId: 'tenant-A',
  userid: 'newbie',
  username: '신규유저',
  role: 'user',
  roleId: null,
  department: null,
  isActive: true,
  canRegisterUsers: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  (hashPassword as ReturnType<typeof vi.fn>).mockResolvedValue('hashed-password');

  tx = createTxMock();
  tx.user.create.mockResolvedValue(createdUser);
  tx.membership.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'membership-1',
    ...data,
  }));

  mockPrisma.$transaction.mockImplementation(async (fn: (tx: TxMock) => Promise<unknown>) => fn(tx));
  mockPrisma.invitation.findUnique.mockResolvedValue(validInvitation());
});

describe('createInvitation (C3)', () => {
  it('랜덤 32바이트 hex 토큰 + 7일 유효기간 + 기본 역할 MEMBER로 생성한다', async () => {
    mockPrisma.invitation.create.mockImplementation(async ({ data }) => ({ id: 'inv-1', ...data }));

    const before = Date.now();
    const invitation = await createInvitation({ tenantId: 'tenant-A', invitedById: 'admin-1' });

    const created = mockPrisma.invitation.create.mock.calls[0][0].data;
    expect(created.tenantId).toBe('tenant-A');
    expect(created.role).toBe('MEMBER');
    expect(created.token).toMatch(/^[0-9a-f]{64}$/); // 32바이트 hex
    expect(created.invitedById).toBe('admin-1');

    const expectedExpiry = before + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
    expect(created.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000);
    expect(created.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 60 * 1000);
    expect(invitation.token).toBe(created.token);
  });

  it('호출마다 서로 다른 토큰을 생성한다', async () => {
    mockPrisma.invitation.create.mockImplementation(async ({ data }) => ({ id: 'inv', ...data }));

    const a = await createInvitation({ tenantId: 'tenant-A' });
    const b = await createInvitation({ tenantId: 'tenant-A' });

    expect(a.token).not.toBe(b.token);
  });
});

describe('listInvitations (C3)', () => {
  it('테넌트 스코프로 최신순 조회한다', async () => {
    mockPrisma.invitation.findMany.mockResolvedValue([]);

    await listInvitations('tenant-A');

    expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-A' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('getValidInvitation — 재사용 불가 (Acceptance)', () => {
  it('존재하지 않는 토큰이면 404', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(null);

    await expect(getValidInvitation('nope')).rejects.toMatchObject({
      message: '유효하지 않은 초대입니다.',
      status: 404,
    });
  });

  it('이미 수락된 초대면 409', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(
      validInvitation({ acceptedAt: new Date('2026-07-17') })
    );

    await expect(getValidInvitation('valid-token')).rejects.toMatchObject({
      message: '이미 사용된 초대입니다.',
      status: 409,
    });
  });

  it('만료된 초대면 410', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(
      validInvitation({ expiresAt: new Date(Date.now() - 1000) })
    );

    await expect(getValidInvitation('valid-token')).rejects.toMatchObject({
      message: '만료된 초대입니다.',
      status: 410,
    });
  });

  it('비활성 테넌트면 403', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(
      validInvitation({ tenant: { ...activeTenant, isActive: false } })
    );

    await expect(getValidInvitation('valid-token')).rejects.toMatchObject({
      message: '이 조직은 현재 이용할 수 없습니다.',
      status: 403,
    });
  });
});

describe('acceptInvitation — 일반 가입 (C3)', () => {
  it('User + AuthAccount(email) + Membership을 단일 트랜잭션으로 생성하고 초대를 소진한다', async () => {
    const result = await acceptInvitation({
      token: 'valid-token',
      userid: 'newbie',
      username: '신규유저',
      password: 'pass1234',
    });

    // 초대 선점 — acceptedAt null인 경우에만
    expect(tx.invitation.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', acceptedAt: null },
      data: { acceptedAt: expect.any(Date) },
    });

    // User: 초대 테넌트 + 해시된 비밀번호 + 일반 사용자 역할
    expect(hashPassword).toHaveBeenCalledWith('pass1234');
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-A',
        userid: 'newbie',
        username: '신규유저',
        password: 'hashed-password',
        role: 'user',
      },
    });

    // AuthAccount(email) — C1 인증 경로 일원화
    expect(tx.authAccount.create).toHaveBeenCalledWith({
      data: { userId: 'user-new', provider: 'email', providerUserId: 'newbie' },
    });

    // Membership — 초대의 role 복사, 첫 소속이므로 기본 조직
    expect(tx.membership.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-new',
        tenantId: 'tenant-A',
        role: 'MEMBER',
        isDefault: true,
      },
    });

    // 모든 생성이 같은 $transaction 안에서 수행됨 (부분 생성 없음)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.user.id).toBe('user-new');
    expect(result.membership.tenantId).toBe('tenant-A');
    expect(result.tenant).toEqual(activeTenant);
  });

  it('동시 수락 경합에서 선점 실패하면 409로 롤백된다 (재사용 불가)', async () => {
    tx.invitation.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      acceptInvitation({
        token: 'valid-token',
        userid: 'newbie',
        username: '신규유저',
        password: 'pass1234',
      })
    ).rejects.toMatchObject({ message: '이미 사용된 초대입니다.', status: 409 });

    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it('테넌트 내 중복 아이디면 409 (User 미생성)', async () => {
    tx.user.findFirst.mockResolvedValue({ id: 'user-dup' });

    await expect(
      acceptInvitation({
        token: 'valid-token',
        userid: 'newbie',
        username: '신규유저',
        password: 'pass1234',
      })
    ).rejects.toMatchObject({ message: '이미 존재하는 아이디입니다.', status: 409 });

    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('타 테넌트 유저가 이미 같은 email providerUserId를 쓰면 409', async () => {
    tx.authAccount.findUnique.mockResolvedValue({ id: 'auth-x', userId: 'other-user' });

    await expect(
      acceptInvitation({
        token: 'valid-token',
        userid: 'newbie',
        username: '신규유저',
        password: 'pass1234',
      })
    ).rejects.toMatchObject({ message: '이미 존재하는 아이디입니다.', status: 409 });

    expect(tx.authAccount.create).not.toHaveBeenCalled();
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it('이름이 없으면 400', async () => {
    await expect(
      acceptInvitation({ token: 'valid-token', userid: 'newbie', password: 'pass1234' })
    ).rejects.toMatchObject({ message: '이름을 입력해주세요.', status: 400 });
  });
});

describe('acceptInvitation — 카카오 (C3)', () => {
  it('신규 카카오 유저는 userid 미입력 시 회원번호 기반으로 생성 + AuthAccount(kakao) 연결', async () => {
    await acceptInvitation({
      token: 'valid-token',
      username: '카카오유저',
      kakaoProviderUserId: '12345678',
    });

    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-A',
        userid: 'kakao_12345678',
        username: '카카오유저',
        password: null,
        role: 'user',
      },
    });

    // 비밀번호가 없으므로 email AuthAccount는 만들지 않고 kakao만 연결
    expect(tx.authAccount.create).toHaveBeenCalledTimes(1);
    expect(tx.authAccount.create).toHaveBeenCalledWith({
      data: { userId: 'user-new', provider: 'kakao', providerUserId: '12345678' },
    });
  });

  it('기존 연결 유저는 신규 생성 없이 Membership만 추가한다', async () => {
    const existingUser = { ...createdUser, id: 'user-9', tenantId: 'tenant-B' };
    tx.user.findUnique.mockResolvedValue(existingUser);
    tx.authAccount.findUnique.mockResolvedValue({ id: 'auth-9', userId: 'user-9' });
    tx.membership.count.mockResolvedValue(1);

    const result = await acceptInvitation({
      token: 'valid-token',
      existingUserId: 'user-9',
      kakaoProviderUserId: '12345678',
    });

    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.authAccount.create).not.toHaveBeenCalled(); // 이미 연결됨 — 멱등
    // 기존 tenantId는 바꾸지 않는다
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.membership.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-9',
        tenantId: 'tenant-A',
        role: 'MEMBER',
        isDefault: false, // 이미 다른 소속이 있으므로 기본 조직 아님
      },
    });
    expect(result.user.id).toBe('user-9');
  });

  it('기존 유저의 tenantId가 비어 있으면 이중 기록(B1)으로 채운다', async () => {
    const orphanUser = { ...createdUser, id: 'user-9', tenantId: null };
    tx.user.findUnique.mockResolvedValue(orphanUser);
    tx.user.update.mockResolvedValue({ ...orphanUser, tenantId: 'tenant-A' });
    tx.authAccount.findUnique.mockResolvedValue({ id: 'auth-9', userId: 'user-9' });

    await acceptInvitation({
      token: 'valid-token',
      existingUserId: 'user-9',
      kakaoProviderUserId: '12345678',
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-9' },
      data: { tenantId: 'tenant-A' },
    });
  });

  it('카카오 회원번호가 다른 유저에 연결돼 있으면 409 (계정 탈취 방지)', async () => {
    tx.authAccount.findUnique.mockResolvedValue({ id: 'auth-x', userId: 'other-user' });

    await expect(
      acceptInvitation({
        token: 'valid-token',
        username: '카카오유저',
        kakaoProviderUserId: '12345678',
      })
    ).rejects.toMatchObject({
      message: '이미 다른 계정에 연결된 인증 수단입니다.',
      status: 409,
    });

    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it('이미 소속된 조직이면 409 (Membership 미생성)', async () => {
    tx.user.findUnique.mockResolvedValue({ ...createdUser, id: 'user-9' });
    tx.authAccount.findUnique.mockResolvedValue({ id: 'auth-9', userId: 'user-9' });
    tx.membership.findUnique.mockResolvedValue({ id: 'membership-existing' });

    await expect(
      acceptInvitation({
        token: 'valid-token',
        existingUserId: 'user-9',
        kakaoProviderUserId: '12345678',
      })
    ).rejects.toMatchObject({ message: '이미 소속된 조직입니다.', status: 409 });

    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it('비활성 기존 유저면 403', async () => {
    tx.user.findUnique.mockResolvedValue({ ...createdUser, id: 'user-9', isActive: false });

    await expect(
      acceptInvitation({
        token: 'valid-token',
        existingUserId: 'user-9',
        kakaoProviderUserId: '12345678',
      })
    ).rejects.toMatchObject({
      message: '계정이 비활성화되어 있습니다. 관리자에게 문의하세요.',
      status: 403,
    });
  });
});

describe('InvitationError', () => {
  it('기본 status는 400', () => {
    const error = new InvitationError('메시지');
    expect(error.status).toBe(400);
    expect(error.name).toBe('InvitationError');
  });
});
