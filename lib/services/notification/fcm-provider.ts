/**
 * FCM (Firebase Cloud Messaging) 프로바이더
 *
 * Capacitor 모바일 앱(Android/iOS)을 대상으로 한 푸시 발송을 담당합니다.
 * 웹 푸시(VAPID) 채널과 별도로 동작하며, NotificationService에서 병행 호출됩니다.
 */

import type { Messaging } from 'firebase-admin/messaging';
import { prisma } from '@/lib/prisma';
import { NotificationEventType } from '@prisma/client';

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

  async subscribe(
    userId: string,
    token: string,
    platform: 'android' | 'ios',
    deviceModel?: string,
    appVersion?: string
  ): Promise<{ id: string } | null> {
    try {
      const existing = await prisma.fcmToken.findUnique({ where: { token } });

      if (existing) {
        const updated = await prisma.fcmToken.update({
          where: { id: existing.id },
          data: {
            userId,
            platform,
            deviceModel,
            appVersion,
            isActive: true,
            failedCount: 0,
            lastUsedAt: new Date(),
          },
        });
        return { id: updated.id };
      }

      const created = await prisma.fcmToken.create({
        data: { userId, token, platform, deviceModel, appVersion },
      });
      return { id: created.id };
    } catch (error) {
      console.error('[FcmProvider] 토큰 등록 실패:', error);
      return null;
    }
  }

  async unsubscribe(userId: string, token: string): Promise<boolean> {
    try {
      await prisma.fcmToken.deleteMany({ where: { userId, token } });
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
