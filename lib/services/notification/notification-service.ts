import { prisma } from '@/lib/prisma';
import { NotificationChannel, NotificationEventType } from '@prisma/client';
import { notificationHubProvider } from './notification-hub-provider';
import { webPushProvider } from './web-push-provider';
import { getTemplateByEvent, renderTemplate } from './templates';
import type {
  NotificationContext,
  NotificationRecipient,
  NotificationResult,
  SendNotificationRequest,
} from './types';

/**
 * 알림 서비스
 *
 * 지출결의서 결재 이벤트에 따른 SMS/카카오 알림 발송을 담당합니다.
 */
export class NotificationService {
  private readonly isEnabled: boolean;
  private readonly appUrl: string;

  constructor() {
    this.isEnabled = process.env.NOTIFICATION_ENABLED !== 'false';
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  /**
   * 알림 발송
   */
  async send(request: SendNotificationRequest): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    if (!this.isEnabled) {
      console.log('[NotificationService] 알림 비활성화 상태');
      return results;
    }

    const { recipient, eventType, context, channels } = request;

    // 사용자 알림 설정 조회
    const preference = recipient.userId
      ? await this.getUserPreference(recipient.userId)
      : null;

    // 발송할 채널 결정
    const activeChannels = channels || this.getActiveChannels(preference, eventType);

    // 템플릿 조회
    const template = getTemplateByEvent(eventType);
    if (!template) {
      console.error('[NotificationService] 템플릿을 찾을 수 없음:', eventType);
      return results;
    }

    // 채널별 발송
    for (const channel of activeChannels) {
      const result = await this.sendToChannel(channel, recipient, template, context, eventType);
      results.push(result);
    }

    return results;
  }

  /**
   * 채널별 발송 처리
   */
  private async sendToChannel(
    channel: NotificationChannel,
    recipient: NotificationRecipient,
    template: ReturnType<typeof getTemplateByEvent>,
    context: NotificationContext,
    eventType: NotificationEventType
  ): Promise<NotificationResult> {
    if (!template) {
      return {
        success: false,
        channel,
        error: '템플릿 없음',
      };
    }

    let result: NotificationResult;

    try {
      if (channel === 'SMS') {
        const message = renderTemplate(template.sms, context);
        const hubResult = await notificationHubProvider.sendSMS(
          recipient.phoneNumber,
          message,
          '[지출결의]'
        );

        result = {
          success: hubResult.success,
          channel,
          messageId: hubResult.messageId,
          error: hubResult.error,
        };
      } else if (channel === 'KAKAO') {
        // 카카오 알림톡은 심사된 템플릿 코드 필요
        const kakaoTemplateCode = process.env[`KAKAO_TEMPLATE_${eventType}`];

        if (kakaoTemplateCode && notificationHubProvider.isKakaoConfigured()) {
          const hubResult = await notificationHubProvider.sendAlimtalkWithFallback(
            recipient.phoneNumber,
            kakaoTemplateCode,
            this.buildTemplateParams(context),
            renderTemplate(template.sms, context),
            '[지출결의]'
          );

          result = {
            success: hubResult.success,
            channel,
            messageId: hubResult.messageId,
            error: hubResult.error,
          };
        } else {
          // 카카오 미설정 시 SMS로 대체
          console.log('[NotificationService] 카카오 미설정 - SMS로 대체 발송');
          const hubResult = await notificationHubProvider.sendSMS(
            recipient.phoneNumber,
            renderTemplate(template.sms, context),
            '[지출결의]'
          );

          result = {
            success: hubResult.success,
            channel: 'SMS',
            messageId: hubResult.messageId,
            error: hubResult.error,
          };
        }
      } else if (channel === 'WEB_PUSH') {
        // 웹 푸시 알림 발송
        if (!recipient.userId) {
          result = {
            success: false,
            channel,
            error: '사용자 ID가 필요합니다.',
          };
        } else if (!webPushProvider.isEnabled()) {
          result = {
            success: false,
            channel,
            error: 'VAPID 키 미설정',
          };
        } else {
          const pushResults = await webPushProvider.sendToUser(
            recipient.userId,
            {
              title: this.getWebPushTitle(eventType),
              body: renderTemplate(template.sms, context),
              url: context.statusUrl,
              expenseId: context.expenseId,
              tag: `expense-${eventType.toLowerCase()}`,
            },
            eventType
          );

          const hasSuccess = pushResults.some((r) => r.success);
          result = {
            success: hasSuccess,
            channel,
            error: hasSuccess ? undefined : '모든 구독에 발송 실패',
          };
        }
      } else {
        result = {
          success: false,
          channel,
          error: '지원하지 않는 채널',
        };
      }

      // 발송 로그 저장
      await this.logNotification(recipient, context, channel, eventType, result);
    } catch (error) {
      console.error('[NotificationService] 발송 오류:', error);
      result = {
        success: false,
        channel,
        error: error instanceof Error ? error.message : '발송 오류',
      };

      await this.logNotification(recipient, context, channel, eventType, result);
    }

    return result;
  }

  /**
   * 사용자 알림 설정 조회
   */
  private async getUserPreference(userId: string) {
    try {
      return await prisma.notificationPreference.findUnique({
        where: { userId },
      });
    } catch {
      return null;
    }
  }

  /**
   * 활성화된 채널 목록 반환
   */
  private getActiveChannels(
    preference: Awaited<ReturnType<typeof this.getUserPreference>>,
    eventType: NotificationEventType
  ): NotificationChannel[] {
    const channels: NotificationChannel[] = [];

    // 이벤트별 알림 설정 확인
    const eventEnabled = preference
      ? this.isEventEnabled(preference, eventType)
      : true; // 설정 없으면 기본 활성화

    if (!eventEnabled) {
      return channels;
    }

    // 채널별 활성화 확인
    if (!preference || preference.smsEnabled) {
      channels.push('SMS');
    }
    if (!preference || preference.kakaoEnabled) {
      channels.push('KAKAO');
    }
    if (!preference || preference.webPushEnabled) {
      channels.push('WEB_PUSH');
    }

    return channels;
  }

  /**
   * 웹 푸시 알림 제목 반환
   */
  private getWebPushTitle(eventType: NotificationEventType): string {
    switch (eventType) {
      case 'SUBMIT':
        return '새 결재 요청';
      case 'APPROVE':
        return '결재 승인';
      case 'REJECT':
        return '결재 반려';
      case 'WITHDRAW':
        return '결재 회수';
      case 'PAYMENT_COMPLETE':
        return '지급 완료';
      default:
        return '지출결의서 알림';
    }
  }

  /**
   * 이벤트별 알림 활성화 여부 확인
   */
  private isEventEnabled(
    preference: NonNullable<Awaited<ReturnType<typeof this.getUserPreference>>>,
    eventType: NotificationEventType
  ): boolean {
    switch (eventType) {
      case 'SUBMIT':
        return preference.onSubmit;
      case 'APPROVE':
        return preference.onApprove;
      case 'REJECT':
        return preference.onReject;
      case 'PAYMENT_COMPLETE':
        return preference.onPaymentComplete;
      default:
        return true;
    }
  }

  /**
   * 카카오 알림톡 템플릿 파라미터 생성
   */
  private buildTemplateParams(context: NotificationContext): Record<string, string> {
    return {
      applicantName: context.applicantName || '',
      amount: context.requestAmount?.toLocaleString('ko-KR') || '0',
      department: context.department || '',
      budgetDetail: context.budgetDetail || '',
      statusUrl: context.statusUrl || '',
      approverName: context.approverName || '',
      rejectReason: context.rejectReason || '',
      paymentDate: context.paymentDate || '',
      bankName: context.bankName || '',
      accountNumber: context.accountNumber || '',
    };
  }

  /**
   * 발송 로그 저장
   */
  private async logNotification(
    recipient: NotificationRecipient,
    context: NotificationContext,
    channel: NotificationChannel,
    eventType: NotificationEventType,
    result: NotificationResult
  ): Promise<void> {
    try {
      const template = getTemplateByEvent(eventType);
      const message = template ? renderTemplate(template.sms, context) : '';

      await prisma.notificationLog.create({
        data: {
          recipientName: recipient.name,
          recipientPhone: recipient.phoneNumber,
          expenseId: context.expenseId,
          channel,
          eventType,
          message,
          status: result.success ? 'SENT' : 'FAILED',
          providerMessageId: result.messageId,
          errorMessage: result.error,
          sentAt: result.success ? new Date() : null,
        },
      });
    } catch (error) {
      console.error('[NotificationService] 로그 저장 오류:', error);
    }
  }

  // ========================================
  // 이벤트별 알림 메서드
  // ========================================

  /**
   * 결재 제출 알림 (결재자에게)
   */
  async notifyOnSubmit(
    expenseId: string,
    approverPhone: string,
    approverUserId: string,
    approverName: string,
    context: Omit<NotificationContext, 'expenseId' | 'statusUrl'>
  ): Promise<NotificationResult[]> {
    return this.send({
      recipient: {
        name: approverName,
        phoneNumber: approverPhone,
        userId: approverUserId,
      },
      eventType: 'SUBMIT',
      context: {
        ...context,
        expenseId,
        statusUrl: `${this.appUrl}/expenses/${expenseId}`,
      },
    });
  }

  /**
   * 결재 승인 알림 (신청자에게)
   */
  async notifyOnApprove(
    expenseId: string,
    applicantPhone: string,
    applicantUserId: string,
    context: Omit<NotificationContext, 'expenseId' | 'statusUrl'>
  ): Promise<NotificationResult[]> {
    return this.send({
      recipient: {
        name: context.applicantName,
        phoneNumber: applicantPhone,
        userId: applicantUserId,
      },
      eventType: 'APPROVE',
      context: {
        ...context,
        expenseId,
        statusUrl: `${this.appUrl}/expenses/${expenseId}`,
      },
    });
  }

  /**
   * 결재 반려 알림 (신청자에게)
   */
  async notifyOnReject(
    expenseId: string,
    applicantPhone: string,
    applicantUserId: string,
    context: Omit<NotificationContext, 'expenseId' | 'statusUrl'>
  ): Promise<NotificationResult[]> {
    return this.send({
      recipient: {
        name: context.applicantName,
        phoneNumber: applicantPhone,
        userId: applicantUserId,
      },
      eventType: 'REJECT',
      context: {
        ...context,
        expenseId,
        statusUrl: `${this.appUrl}/expenses/${expenseId}`,
      },
    });
  }

  /**
   * 결재 회수 알림 (대기중인 결재자에게)
   */
  async notifyOnWithdraw(
    expenseId: string,
    approvers: Array<{ phone: string; name: string; userId: string }>,
    context: Omit<NotificationContext, 'expenseId' | 'statusUrl'>
  ): Promise<NotificationResult[]> {
    const allResults: NotificationResult[] = [];

    for (const approver of approvers) {
      const results = await this.send({
        recipient: {
          name: approver.name,
          phoneNumber: approver.phone,
          userId: approver.userId,
        },
        eventType: 'WITHDRAW',
        context: {
          ...context,
          expenseId,
          statusUrl: `${this.appUrl}/expenses/${expenseId}`,
        },
      });
      allResults.push(...results);
    }

    return allResults;
  }

  /**
   * 지급 완료 알림 (신청자에게)
   */
  async notifyOnPaymentComplete(
    expenseId: string,
    applicantPhone: string,
    applicantUserId: string,
    context: Omit<NotificationContext, 'expenseId' | 'statusUrl'>
  ): Promise<NotificationResult[]> {
    return this.send({
      recipient: {
        name: context.applicantName,
        phoneNumber: applicantPhone,
        userId: applicantUserId,
      },
      eventType: 'PAYMENT_COMPLETE',
      context: {
        ...context,
        expenseId,
        statusUrl: `${this.appUrl}/expenses/${expenseId}`,
        paymentDate: context.paymentDate || new Date().toLocaleDateString('ko-KR'),
      },
    });
  }
}

// 싱글톤 인스턴스
export const notificationService = new NotificationService();
