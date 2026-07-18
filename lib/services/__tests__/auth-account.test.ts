/**
 * AuthAccount 서비스 테스트 (ARC-003 §3, C1)
 *
 * DB 무실행 원칙 — prismaBase를 모킹하여 조회 조건·연결 검증 로직만 확인한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthAccount, mockUser } = vi.hoisted(() => ({
  mockAuthAccount: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
  mockUser: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
  prismaBase: {
    authAccount: mockAuthAccount,
    user: mockUser,
  },
}));

import {
  AuthAccountNotLinkedError,
  findUserByProvider,
  getAuthAccount,
  LastAuthMethodError,
  linkAuthAccount,
  unlinkAuthAccount,
} from '../auth-account';

const user = {
  id: 'user-1',
  userid: '청연정혜종',
  username: '정혜종',
};

const authAccount = {
  id: 'auth-1',
  userId: 'user-1',
  provider: 'kakao',
  providerUserId: '12345678',
  createdAt: new Date('2026-07-18'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findUserByProvider', () => {
  it('(provider, providerUserId) 유니크 키로 연결된 유저를 조회한다', async () => {
    mockAuthAccount.findUnique.mockResolvedValue({ ...authAccount, user });

    const result = await findUserByProvider('kakao', '12345678');

    expect(mockAuthAccount.findUnique).toHaveBeenCalledWith({
      where: { provider_providerUserId: { provider: 'kakao', providerUserId: '12345678' } },
      include: { user: true },
    });
    expect(result).toEqual(user);
  });

  it('연결이 없으면 null을 반환한다 (이메일 자동 병합 없음 — 호출측이 초대 안내)', async () => {
    mockAuthAccount.findUnique.mockResolvedValue(null);

    await expect(findUserByProvider('kakao', '없는회원번호')).resolves.toBeNull();
  });
});

describe('linkAuthAccount', () => {
  it('연결이 없으면 새 AuthAccount를 생성한다', async () => {
    mockAuthAccount.findUnique.mockResolvedValue(null);
    mockAuthAccount.create.mockResolvedValue(authAccount);

    const result = await linkAuthAccount('user-1', 'kakao', '12345678');

    expect(mockAuthAccount.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', provider: 'kakao', providerUserId: '12345678' },
    });
    expect(result).toEqual(authAccount);
  });

  it('같은 유저에 이미 연결돼 있으면 기존 연결을 반환한다 (멱등)', async () => {
    mockAuthAccount.findUnique.mockResolvedValue(authAccount);

    const result = await linkAuthAccount('user-1', 'kakao', '12345678');

    expect(result).toEqual(authAccount);
    expect(mockAuthAccount.create).not.toHaveBeenCalled();
  });

  it('다른 유저에 연결된 인증 수단이면 한국어 메시지로 throw한다', async () => {
    mockAuthAccount.findUnique.mockResolvedValue({ ...authAccount, userId: 'user-다른사람' });

    await expect(linkAuthAccount('user-1', 'kakao', '12345678')).rejects.toThrow(
      '이미 다른 계정에 연결된 인증 수단입니다.'
    );
    expect(mockAuthAccount.create).not.toHaveBeenCalled();
  });
});

describe('getAuthAccount', () => {
  it('(userId, provider)로 연결을 조회한다', async () => {
    mockAuthAccount.findFirst.mockResolvedValue(authAccount);

    const result = await getAuthAccount('user-1', 'kakao');

    expect(mockAuthAccount.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', provider: 'kakao' },
    });
    expect(result).toEqual(authAccount);
  });
});

describe('unlinkAuthAccount (C4)', () => {
  it('연결이 없으면 AuthAccountNotLinkedError를 throw한다', async () => {
    mockAuthAccount.findFirst.mockResolvedValue(null);

    await expect(unlinkAuthAccount('user-1', 'kakao')).rejects.toBeInstanceOf(
      AuthAccountNotLinkedError
    );
    expect(mockAuthAccount.delete).not.toHaveBeenCalled();
  });

  it('마지막 로그인 수단(비밀번호 없음 + 다른 provider 없음)이면 해제를 거부한다', async () => {
    mockAuthAccount.findFirst.mockResolvedValue(authAccount);
    mockUser.findUnique.mockResolvedValue({ password: null });
    mockAuthAccount.count.mockResolvedValue(0);

    await expect(unlinkAuthAccount('user-1', 'kakao')).rejects.toBeInstanceOf(
      LastAuthMethodError
    );
    expect(mockAuthAccount.delete).not.toHaveBeenCalled();
  });

  it('비밀번호가 있으면 해제할 수 있다', async () => {
    mockAuthAccount.findFirst.mockResolvedValue(authAccount);
    mockUser.findUnique.mockResolvedValue({ password: 'hashed-password' });
    mockAuthAccount.count.mockResolvedValue(0);

    await expect(unlinkAuthAccount('user-1', 'kakao')).resolves.toBeUndefined();

    expect(mockAuthAccount.delete).toHaveBeenCalledWith({ where: { id: 'auth-1' } });
  });

  it('비밀번호가 없어도 다른 provider 연결이 있으면 해제할 수 있다', async () => {
    mockAuthAccount.findFirst.mockResolvedValue(authAccount);
    mockUser.findUnique.mockResolvedValue({ password: null });
    mockAuthAccount.count.mockResolvedValue(1);

    await expect(unlinkAuthAccount('user-1', 'kakao')).resolves.toBeUndefined();

    // 다른 provider 수 계산은 해제 대상 provider를 제외한다
    expect(mockAuthAccount.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', provider: { not: 'kakao' } },
    });
    expect(mockAuthAccount.delete).toHaveBeenCalledWith({ where: { id: 'auth-1' } });
  });
});
