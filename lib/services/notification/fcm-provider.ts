/**
 * FCM (Firebase Cloud Messaging) 프로바이더
 *
 * Capacitor 모바일 앱(Android/iOS)을 대상으로 한 푸시 발송을 담당합니다.
 * 웹 푸시(VAPID) 채널과 별도로 동작하며, NotificationService에서 병행 호출됩니다.
 */

import type { Messaging } from 'firebase-admin/messaging';
import { prisma, prismaBase } from '@/lib/prisma';
import { NotificationEventType } from '@prisma/client';
import { tenantTopics } from './fcm-topic';

const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';

interface FcmPayload {
  title: string;
  body: string;
  url?: string;
  expenseId?: string;
  tag?: string;
}

interface FcmResult {
  success: boolean;
  tokenId?: string;
  error?: string;
}

let cachedMessaging: Messaging | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (cachedMessaging) return cachedMessaging;
  if (!SERVICE_ACCOUNT_JSON) return null;

  try {
    const { getApps, initializeApp, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            credential: cert(JSON.parse(SERVICE_ACCOUNT_JSON)),
          });

    cachedMessaging = getMessaging(app);
    return cachedMessaging;
  } catch (error) {
    console.error('[FcmProvider] firebase-admin 초기화 실패:', error);
    return null;
  }
}

export class FcmProvider {
  private readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = !!SERVICE_ACCOUNT_JSON;

    if (!this.isConfigured) {
      console.warn(
        '[FcmProvider] FIREBASE_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다.'
      );
    }
  }

  isEnabled(): boolean {
    return this.isConfigured;
  }

  async sendToUser(
    userId: string,
    payload: FcmPayload,
    eventType: NotificationEventType
  ): Promise<FcmResult[]> {
    if (!this.isConfigured) {
      return [{ success: false, error: 'FCM 서비스 계정 미설정' }];
    }

    const tokens = await prisma.fcmToken.findMany({
      where: { userId, isActive: true },
    });

    if (tokens.length === 0) {
      return [{ success: false, error: '활성 FCM 토큰 없음' }];
    }

    const results: FcmResult[] = [];
    for (const token of tokens) {
      results.push(await this.sendToToken(token, payload, eventType));
    }
    return results;
  }

  private async sendToToken(
    tokenRow: {
      id: string;
      userId: string;
      token: string;
      platform: string;
    },
    payload: FcmPayload,
    eventType: NotificationEventType
  ): Promise<FcmResult> {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      return { success: false, tokenId: tokenRow.id, error: 'admin 초기화 실패' };
    }

    const data: Record<string, string> = {
      eventType,
    };
    if (payload.url) data.url = payload.url;
    if (payload.expenseId) data.expenseId = payload.expenseId;
    if (payload.tag) data.tag = payload.tag;

    try {
      await messaging.send({
        token: tokenRow.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'expense-default',
            sound: 'default',
            clickAction: 'FCM_PLUGIN_ACTIVITY',
          },
        },
      });

      await this.logPush(tokenRow.userId, payload, eventType, 'SENT');
      await prisma.fcmToken.update({
        where: { id: tokenRow.id },
        data: { failedCount: 0, lastUsedAt: new Date() },
      });

      return { success: true, tokenId: tokenRow.id };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'FCM 발송 실패';
      const errorCode = this.extractErrorCode(error);

      await this.logPush(
        tokenRow.userId,
        payload,
        eventType,
        'FAILED',
        `${errorCode}: ${errorMessage}`
      );

      if (this.isInvalidTokenError(errorCode)) {
        await this.deactivateToken(tokenRow.id);
      } else {
        await this.incrementFailedCount(tokenRow.id);
      }

      return { success: false, tokenId: tokenRow.id, error: errorMessage };
    }
  }

  // 디바이스 토큰은 테넌트 경계를 넘나드는 기기 식별자(token @unique)이므로
  // 테넌트 컨텍스트 자동 필터를 우회(prismaBase)해서 조회/이동한다.
  // 이전 테넌트에서 등록된 동일 토큰을 현재 테넌트로 재스코프하기 위함 (B6).
  async subscribe(
    userId: string,
    tenantId: string | null,
    token: string,
    platform: 'android' | 'ios',
    deviceModel?: string,
    appVersion?: string
  ): Promise<{ id: string } | null> {
    try {
      const existing = await prismaBase.fcmToken.findUnique({
        where: { token },
      });

      // 소유권 검증 — 이미 다른 유저에게 등록된 토큰 행은 재할당하지 않는다.
      // (기기 식별자 token만 알면 타인의 행을 자기 테넌트로 넘겨 피해자 기기에 크로스테넌트
      //  푸시를 유발할 수 있으므로 차단. unsubscribe()와 동일한 소유권 기준.)
      // 같은 유저의 재등록(플랫폼·tenantId 갱신)은 정상 경로로 계속 허용된다.
      if (existing && existing.userId !== userId) {
        console.warn(
          `[FcmProvider] 토큰 소유권 불일치로 재할당 거부 (token owner=${existing.userId}, 요청 userId=${userId})`
        );
        return null;
      }

      if (existing) {
        const updated = await prismaBase.fcmToken.update({
          where: { id: existing.id },
          data: {
            userId,
            tenantId,
            platform,
            deviceModel,
            appVersion,
            isActive: true,
            failedCount: 0,
            lastUsedAt: new Date(),
          },
        });
        await this.syncTokenTopics(token, existing.tenantId, tenantId);
        return { id: updated.id };
      }

      const created = await prismaBase.fcmToken.create({
        data: { userId, tenantId, token, platform, deviceModel, appVersion },
      });
      await this.syncTokenTopics(token, null, tenantId);
      return { id: created.id };
    } catch (error) {
      console.error('[FcmProvider] 토큰 등록 실패:', error);
      return null;
    }
  }

  /**
   * 조직 전환(B3/B5) 시 사용자의 활성 FCM 토큰을 새 테넌트로 재스코프한다.
   * 이전 테넌트 토픽 구독 해제 → 새 테넌트 토픽 구독 → tenantId 갱신 순.
   *
   * FCM 미설정(서비스 계정 없음) 상태에서도 DB의 tenantId는 갱신되며,
   * 어떤 실패도 throw하지 않는다 — 조직 전환 자체를 막지 않기 위함.
   */
  async resubscribeTenantTopics(
    userId: string,
    newTenantId: string
  ): Promise<{ moved: number }> {
    let moved = 0;
    try {
      const tokens = await prismaBase.fcmToken.findMany({
        where: { userId, isActive: true },
      });

      for (const row of tokens) {
        if (row.tenantId === newTenantId) continue;
        await this.syncTokenTopics(row.token, row.tenantId, newTenantId);
        await prismaBase.fcmToken.update({
          where: { id: row.id },
          data: { tenantId: newTenantId },
        });
        moved += 1;
      }
    } catch (error) {
      console.error('[FcmProvider] 조직 전환 토픽 재구독 실패:', error);
    }
    return { moved };
  }

  /**
   * 토큰의 테넌트 토픽 구독 동기화 — 이전 테넌트 토픽 해제 후 새 테넌트 토픽 구독.
   * 해제 실패가 구독을 막지 않도록 단계별로 오류를 흡수한다.
   */
  private async syncTokenTopics(
    token: string,
    previousTenantId: string | null,
    nextTenantId: string | null
  ): Promise<void> {
    if (previousTenantId === nextTenantId) return;

    const messaging = await getMessagingInstance();
    if (!messaging) return; // 미설정 시 토픽 없음 — DB tenantId 갱신만으로 충분

    if (previousTenantId) {
      for (const topic of tenantTopics(previousTenantId)) {
        try {
          await messaging.unsubscribeFromTopic(token, topic);
        } catch (error) {
          console.error(`[FcmProvider] 토픽 구독 해제 실패 (${topic}):`, error);
        }
      }
    }

    if (nextTenantId) {
      for (const topic of tenantTopics(nextTenantId)) {
        try {
          await messaging.subscribeToTopic(token, topic);
        } catch (error) {
          console.error(`[FcmProvider] 토픽 구독 실패 (${topic}):`, error);
        }
      }
    }
  }

  async unsubscribe(userId: string, token: string): Promise<boolean> {
    try {
      // 삭제 전 테넌트 토픽 구독도 해제 — 삭제된 토큰의 토픽 구독 잔류 방지 (B6)
      const existing = await prismaBase.fcmToken.findUnique({
        where: { token },
      });
      if (existing && existing.userId === userId) {
        await this.syncTokenTopics(token, existing.tenantId, null);
      }
      await prismaBase.fcmToken.deleteMany({ where: { userId, token } });
      return true;
    } catch (error) {
      console.error('[FcmProvider] 토큰 해제 실패:', error);
      return false;
    }
  }

  private extractErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error) {
      return String((error as { code: unknown }).code);
    }
    return 'unknown';
  }

  private isInvalidTokenError(code: string): boolean {
    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    );
  }

  private async deactivateToken(id: string): Promise<void> {
    try {
      await prisma.fcmToken.update({
        where: { id },
        data: { isActive: false },
      });
      console.log(`[FcmProvider] 토큰 비활성화: ${id}`);
    } catch (error) {
      console.error('[FcmProvider] 토큰 비활성화 실패:', error);
    }
  }

  private async incrementFailedCount(id: string): Promise<void> {
    try {
      const updated = await prisma.fcmToken.update({
        where: { id },
        data: { failedCount: { increment: 1 } },
      });
      if (updated.failedCount >= 5) {
        await this.deactivateToken(id);
      }
    } catch (error) {
      console.error('[FcmProvider] 실패 카운트 업데이트 실패:', error);
    }
  }

  private async logPush(
    userId: string,
    payload: FcmPayload,
    eventType: NotificationEventType,
    status: 'PENDING' | 'SENT' | 'FAILED',
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.fcmLog.create({
        data: {
          userId,
          expenseId: payload.expenseId,
          eventType,
          title: payload.title,
          body: payload.body,
          url: payload.url,
          status,
          errorMessage,
          sentAt: status === 'SENT' ? new Date() : null,
        },
      });
    } catch (error) {
      console.error('[FcmProvider] 로그 저장 실패:', error);
    }
  }
}

export const fcmProvider = new FcmProvider();
