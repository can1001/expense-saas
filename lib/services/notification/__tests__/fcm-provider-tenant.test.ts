/**
 * FcmProvider 테넌트 스코프 테스트 (ARC-002 §6, B6)
 *
 * 테스트 대상:
 * - subscribe: tenantId 저장 + 테넌트 토픽 구독, 테넌트 이동 시 이전 토픽 해제
 * - resubscribeTenantTopics: 조직 전환 시 이전 테넌트 토픽 구독이 남지 않음
 * - unsubscribe: 토큰 삭제 시 토픽 구독 잔류 없음
 * - FCM 미설정 시에도 DB tenantId 갱신은 수행 (토픽 호출 없음)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockMessaging, mockPrismaBase } = vi.hoisted(() => {
  // 모듈 로드 시점에 환경변수를 읽으므로 import 전에 설정한다
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: 'test-project',
  });

  return {
    mockMessaging: {
      send: vi.fn(),
      subscribeToTopic: vi.fn(),
      unsubscribeFromTopic: vi.fn(),
    },
    mockPrismaBase: {
      fcmToken: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {},
  prismaBase: mockPrismaBase,
}));

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({})),
  cert: vi.fn(),
}));

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: vi.fn(() => mockMessaging),
}));

import { fcmProvider } from '../fcm-provider';

beforeEach(() => {
  vi.clearAllMocks();
  mockMessaging.subscribeToTopic.mockResolvedValue({});
  mockMessaging.unsubscribeFromTopic.mockResolvedValue({});
});

describe('subscribe — tenantId 저장 + 토픽 구독', () => {
  it('신규 토큰 등록 시 tenantId를 저장하고 테넌트 토픽을 구독한다', async () => {
    mockPrismaBase.fcmToken.findUnique.mockResolvedValue(null);
    mockPrismaBase.fcmToken.create.mockResolvedValue({ id: 'fcm-1' });

    const result = await fcmProvider.subscribe(
      'user-1',
      'tenant-1',
      'device-token-1',
      'android'
    );

    expect(result).toEqual({ id: 'fcm-1' });
    expect(mockPrismaBase.fcmToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        tenantId: 'tenant-1',
        token: 'device-token-1',
        platform: 'android',
      }),
    });
    expect(mockMessaging.subscribeToTopic).toHaveBeenCalledWith(
      'device-token-1',
      'tenant_tenant-1_all'
    );
    expect(mockMessaging.unsubscribeFromTopic).not.toHaveBeenCalled();
  });

  it('다른 테넌트에서 등록됐던 토큰 재등록 시 이전 토픽을 해제하고 새 토픽을 구독한다', async () => {
    mockPrismaBase.fcmToken.findUnique.mockResolvedValue({
      id: 'fcm-1',
      userId: 'user-1',
      tenantId: 'tenant-old',
      token: 'device-token-1',
      platform: 'android',
    });
    mockPrismaBase.fcmToken.update.mockResolvedValue({ id: 'fcm-1' });

    const result = await fcmProvider.subscribe(
      'user-1',
      'tenant-new',
      'device-token-1',
      'android'
    );

    expect(result).toEqual({ id: 'fcm-1' });
    expect(mockPrismaBase.fcmToken.update).toHaveBeenCalledWith({
      where: { id: 'fcm-1' },
      data: expect.objectContaining({ tenantId: 'tenant-new', isActive: true }),
    });
    expect(mockMessaging.unsubscribeFromTopic).toHaveBeenCalledWith(
      'device-token-1',
      'tenant_tenant-old_all'
    );
    expect(mockMessaging.subscribeToTopic).toHaveBeenCalledWith(
      'device-token-1',
      'tenant_tenant-new_all'
    );
  });

  it('같은 테넌트 재등록이면 토픽 호출이 없다', async () => {
    mockPrismaBase.fcmToken.findUnique.mockResolvedValue({
      id: 'fcm-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      token: 'device-token-1',
      platform: 'android',
    });
    mockPrismaBase.fcmToken.update.mockResolvedValue({ id: 'fcm-1' });

    await fcmProvider.subscribe('user-1', 'tenant-1', 'device-token-1', 'android');

    expect(mockMessaging.subscribeToTopic).not.toHaveBeenCalled();
    expect(mockMessaging.unsubscribeFromTopic).not.toHaveBeenCalled();
  });
});

describe('resubscribeTenantTopics — 조직 전환 재구독', () => {
  it('이전 테넌트 토픽을 해제하고 새 테넌트 토픽을 구독하며 tenantId를 갱신한다', async () => {
    mockPrismaBase.fcmToken.findMany.mockResolvedValue([
      { id: 'fcm-1', token: 'tok-1', tenantId: 'tenant-1', isActive: true },
      { id: 'fcm-2', token: 'tok-2', tenantId: 'tenant-2', isActive: true },
    ]);
    mockPrismaBase.fcmToken.update.mockResolvedValue({});

    const result = await fcmProvider.resubscribeTenantTopics(
      'user-1',
      'tenant-2'
    );

    // tenant-1 소속 토큰만 이동 대상
    expect(result).toEqual({ moved: 1 });
    // 전환 후 이전 테넌트 토픽 구독이 남지 않는다 (Acceptance)
    expect(mockMessaging.unsubscribeFromTopic).toHaveBeenCalledWith(
      'tok-1',
      'tenant_tenant-1_all'
    );
    expect(mockMessaging.subscribeToTopic).toHaveBeenCalledWith(
      'tok-1',
      'tenant_tenant-2_all'
    );
    expect(mockPrismaBase.fcmToken.update).toHaveBeenCalledWith({
      where: { id: 'fcm-1' },
      data: { tenantId: 'tenant-2' },
    });
    // 이미 새 테넌트인 토큰은 건드리지 않는다
    expect(mockMessaging.unsubscribeFromTopic).not.toHaveBeenCalledWith(
      'tok-2',
      expect.anything()
    );
  });

  it('활성 토큰만 조회한다', async () => {
    mockPrismaBase.fcmToken.findMany.mockResolvedValue([]);

    await fcmProvider.resubscribeTenantTopics('user-1', 'tenant-2');

    expect(mockPrismaBase.fcmToken.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isActive: true },
    });
  });

  it('DB 오류가 나도 throw하지 않는다 — 조직 전환을 막지 않는다', async () => {
    mockPrismaBase.fcmToken.findMany.mockRejectedValue(
      new Error('connection lost')
    );

    await expect(
      fcmProvider.resubscribeTenantTopics('user-1', 'tenant-2')
    ).resolves.toEqual({ moved: 0 });
  });

  it('토픽 구독 해제가 실패해도 새 토픽 구독과 tenantId 갱신은 진행된다', async () => {
    mockPrismaBase.fcmToken.findMany.mockResolvedValue([
      { id: 'fcm-1', token: 'tok-1', tenantId: 'tenant-1', isActive: true },
    ]);
    mockPrismaBase.fcmToken.update.mockResolvedValue({});
    mockMessaging.unsubscribeFromTopic.mockRejectedValue(
      new Error('fcm error')
    );

    const result = await fcmProvider.resubscribeTenantTopics(
      'user-1',
      'tenant-2'
    );

    expect(result).toEqual({ moved: 1 });
    expect(mockMessaging.subscribeToTopic).toHaveBeenCalledWith(
      'tok-1',
      'tenant_tenant-2_all'
    );
    expect(mockPrismaBase.fcmToken.update).toHaveBeenCalledWith({
      where: { id: 'fcm-1' },
      data: { tenantId: 'tenant-2' },
    });
  });
});

describe('unsubscribe — 토큰 해제 시 토픽 잔류 없음', () => {
  it('토큰 삭제 전 테넌트 토픽 구독을 해제한다', async () => {
    mockPrismaBase.fcmToken.findUnique.mockResolvedValue({
      id: 'fcm-1',
      userId: 'user-1',
      tenantId: 'tenant-1',
      token: 'tok-1',
    });
    mockPrismaBase.fcmToken.deleteMany.mockResolvedValue({ count: 1 });

    const result = await fcmProvider.unsubscribe('user-1', 'tok-1');

    expect(result).toBe(true);
    expect(mockMessaging.unsubscribeFromTopic).toHaveBeenCalledWith(
      'tok-1',
      'tenant_tenant-1_all'
    );
    expect(mockPrismaBase.fcmToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: 'tok-1' },
    });
  });

  it('소유자가 다른 토큰이면 토픽 해제 없이 본인 스코프 삭제만 시도한다', async () => {
    mockPrismaBase.fcmToken.findUnique.mockResolvedValue({
      id: 'fcm-1',
      userId: 'user-other',
      tenantId: 'tenant-1',
      token: 'tok-1',
    });
    mockPrismaBase.fcmToken.deleteMany.mockResolvedValue({ count: 0 });

    await fcmProvider.unsubscribe('user-1', 'tok-1');

    expect(mockMessaging.unsubscribeFromTopic).not.toHaveBeenCalled();
  });
});

describe('FCM 미설정(서비스 계정 없음)', () => {
  it('토픽 호출 없이 DB tenantId 갱신만 수행한다', async () => {
    // 환경변수 없이 모듈을 새로 로드해 미설정 상태를 재현한다
    vi.resetModules();
    const saved = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    try {
      const { FcmProvider } = await import('../fcm-provider');
      const provider = new FcmProvider();

      mockPrismaBase.fcmToken.findMany.mockResolvedValue([
        { id: 'fcm-1', token: 'tok-1', tenantId: 'tenant-1', isActive: true },
      ]);
      mockPrismaBase.fcmToken.update.mockResolvedValue({});

      const result = await provider.resubscribeTenantTopics(
        'user-1',
        'tenant-2'
      );

      expect(result).toEqual({ moved: 1 });
      expect(mockMessaging.subscribeToTopic).not.toHaveBeenCalled();
      expect(mockMessaging.unsubscribeFromTopic).not.toHaveBeenCalled();
      // 발송 스코프(tenant 필터)를 위해 DB tenantId는 갱신된다
      expect(mockPrismaBase.fcmToken.update).toHaveBeenCalledWith({
        where: { id: 'fcm-1' },
        data: { tenantId: 'tenant-2' },
      });
    } finally {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = saved;
    }
  });
});
