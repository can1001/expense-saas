/**
 * 웹 푸시 알림 프로바이더
 *
 * VAPID 키 기반 웹 푸시 발송을 담당합니다.
 */

import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { NotificationEventType } from '@prisma/client';

// VAPID 키 설정
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

// 웹 푸시 설정 초기화
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * 푸시 알림 페이로드 타입
 */
interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  expenseId?: string;
  actions?: Array<{ action: string; title: string }>;
  requireInteraction?: boolean;
}

/**
 * 푸시 발송 결과 타입
 */
interface PushResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
}

/**
 * 웹 푸시 프로바이더 클래스
 */
export class WebPushProvider {
  private readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

    if (!this.isConfigured) {
      console.warn('[WebPushProvider] VAPID 키가 설정되지 않았습니다.');
    }
  }

  /**
   * VAPID 공개키 반환 (클라이언트에서 구독 시 사용)
   */
  getPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  /**
   * 설정 여부 확인
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * 사용자에게 푸시 알림 발송
   */
  async sendToUser(
    userId: string,
    payload: PushPayload,
    eventType: NotificationEventType
  ): Promise<PushResult[]> {
    if (!this.isConfigured) {
      return [{ success: false, error: 'VAPID 키 미설정' }];
    }

    // 사용자의 활성 구독 조회
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (subscriptions.length === 0) {
      return [{ success: false, error: '활성 구독 없음' }];
    }

    const results: PushResult[] = [];

    for (const subscription of subscriptions) {
      const result = await this.sendToSubscription(
        subscription,
        payload,
        eventType
      );
      results.push(result);
    }

    return results;
  }

  /**
   * 특정 구독에 푸시 발송
   */
  async sendToSubscription(
    subscription: {
      id: string;
      userId: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    },
    payload: PushPayload,
    eventType: NotificationEventType
  ): Promise<PushResult> {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const pushPayload = JSON.stringify({
      ...payload,
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/logo.png',
    });

    try {
      await webpush.sendNotification(pushSubscription, pushPayload);

      // 발송 로그 저장
      await this.logPush(
        subscription.userId,
        payload,
        eventType,
        'SENT'
      );

      // 실패 카운트 리셋
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { failedCount: 0 },
      });

      return { success: true, subscriptionId: subscription.id };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '푸시 발송 실패';

      // 발송 실패 로그 저장
      await this.logPush(
        subscription.userId,
        payload,
        eventType,
        'FAILED',
        errorMessage
      );

      // 구독 만료 처리 (410 Gone 또는 404 Not Found)
      if (this.isExpiredError(error)) {
        await this.deactivateSubscription(subscription.id);
      } else {
        // 실패 카운트 증가
        await this.incrementFailedCount(subscription.id);
      }

      return {
        success: false,
        subscriptionId: subscription.id,
        error: errorMessage,
      };
    }
  }

  /**
   * 구독 등록
   */
  async subscribe(
    userId: string,
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    },
    userAgent?: string,
    deviceName?: string
  ): Promise<{ id: string } | null> {
    try {
      const existing = await prisma.pushSubscription.findUnique({
        where: {
          userId_endpoint: {
            userId,
            endpoint: subscription.endpoint,
          },
        },
      });

      if (existing) {
        // 기존 구독 활성화
        const updated = await prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent,
            deviceName,
            isActive: true,
            failedCount: 0,
          },
        });
        return { id: updated.id };
      }

      // 새 구독 생성
      const created = await prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent,
          deviceName,
        },
      });

      return { id: created.id };
    } catch (error) {
      console.error('[WebPushProvider] 구독 등록 실패:', error);
      return null;
    }
  }

  /**
   * 구독 해제
   */
  async unsubscribe(userId: string, endpoint: string): Promise<boolean> {
    try {
      await prisma.pushSubscription.deleteMany({
        where: {
          userId,
          endpoint,
        },
      });
      return true;
    } catch (error) {
      console.error('[WebPushProvider] 구독 해제 실패:', error);
      return false;
    }
  }

  /**
   * 사용자의 모든 구독 해제
   */
  async unsubscribeAll(userId: string): Promise<boolean> {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { userId },
      });
      return true;
    } catch (error) {
      console.error('[WebPushProvider] 전체 구독 해제 실패:', error);
      return false;
    }
  }

  /**
   * 사용자의 구독 목록 조회
   */
  async getSubscriptions(
    userId: string
  ): Promise<Array<{ id: string; deviceName: string | null; isActive: boolean; createdAt: Date }>> {
    return prisma.pushSubscription.findMany({
      where: { userId },
      select: {
        id: true,
        deviceName: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 구독 비활성화
   */
  private async deactivateSubscription(subscriptionId: string): Promise<void> {
    try {
      await prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: { isActive: false },
      });
      console.log(`[WebPushProvider] 구독 비활성화: ${subscriptionId}`);
    } catch (error) {
      console.error('[WebPushProvider] 구독 비활성화 실패:', error);
    }
  }

  /**
   * 실패 카운트 증가 (5회 초과 시 비활성화)
   */
  private async incrementFailedCount(subscriptionId: string): Promise<void> {
    try {
      const subscription = await prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: { failedCount: { increment: 1 } },
      });

      if (subscription.failedCount >= 5) {
        await this.deactivateSubscription(subscriptionId);
      }
    } catch (error) {
      console.error('[WebPushProvider] 실패 카운트 업데이트 실패:', error);
    }
  }

  /**
   * 만료 에러인지 확인
   */
  private isExpiredError(error: unknown): boolean {
    if (error instanceof webpush.WebPushError) {
      return error.statusCode === 410 || error.statusCode === 404;
    }
    return false;
  }

  /**
   * 푸시 발송 로그 저장
   */
  private async logPush(
    userId: string,
    payload: PushPayload,
    eventType: NotificationEventType,
    status: 'PENDING' | 'SENT' | 'FAILED',
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.webPushLog.create({
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
      console.error('[WebPushProvider] 로그 저장 실패:', error);
    }
  }
}

// 싱글톤 인스턴스
export const webPushProvider = new WebPushProvider();
