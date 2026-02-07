import type { NotificationHubResult } from './types';

/**
 * NHN Notification Hub Provider
 *
 * SMS/LMS/ALIMTALK 통합 API를 통한 알림 발송
 *
 * 환경변수 설정 필요:
 * - NOTIFICATION_HUB_APP_KEY: Notification Hub 앱 키
 * - NOTIFICATION_HUB_USER_ACCESS_KEY: 사용자 Access Key
 * - NOTIFICATION_HUB_SECRET_ACCESS_KEY: 사용자 Secret Access Key
 * - NOTIFICATION_HUB_SMS_SENDER: 발신번호 (01012345678)
 * - NOTIFICATION_HUB_KAKAO_SENDER_KEY: 카카오 발신 프로필 키
 */
export class NotificationHubProvider {
  private readonly baseUrl = 'https://notification-hub.api.nhncloudservice.com';
  private readonly oauthUrl = 'https://oauth.api.nhncloudservice.com';
  private readonly appKey: string;
  private readonly userAccessKey: string;
  private readonly secretAccessKey: string;
  private readonly smsSender: string;
  private readonly kakaoSenderKey: string;
  private readonly isEnabled: boolean;

  // OAuth 토큰 캐싱
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.appKey = process.env.NOTIFICATION_HUB_APP_KEY || '';
    this.userAccessKey = process.env.NOTIFICATION_HUB_USER_ACCESS_KEY || '';
    this.secretAccessKey = process.env.NOTIFICATION_HUB_SECRET_ACCESS_KEY || '';
    this.smsSender = process.env.NOTIFICATION_HUB_SMS_SENDER || '';
    this.kakaoSenderKey = process.env.NOTIFICATION_HUB_KAKAO_SENDER_KEY || '';
    this.isEnabled = Boolean(
      this.appKey && this.userAccessKey && this.secretAccessKey && this.smsSender
    );

    if (!this.isEnabled) {
      console.warn('[NotificationHubProvider] 설정이 완료되지 않았습니다. 환경변수를 확인하세요.');
    }
  }

  /**
   * 설정 상태 확인
   */
  isConfigured(): boolean {
    return this.isEnabled;
  }

  /**
   * 카카오 설정 상태 확인
   */
  isKakaoConfigured(): boolean {
    return this.isEnabled && Boolean(this.kakaoSenderKey);
  }

  /**
   * 전화번호 정규화 (하이픈 제거)
   */
  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/-/g, '');
  }

  /**
   * OAuth 토큰 발급
   */
  private async getAccessToken(): Promise<string> {
    // 토큰이 유효한 경우 (만료 5분 전까지) 캐시 사용
    const now = Date.now();
    if (this.accessToken && this.tokenExpiry - 300000 > now) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.oauthUrl}/oauth2/token/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth: {
            userAccessKeyId: this.userAccessKey,
            secretAccessKey: this.secretAccessKey,
          },
        }),
      });

      const result = await response.json();

      if (result.header?.isSuccessful && result.access?.token) {
        const token = result.access.token as string;
        this.accessToken = token;
        // 토큰 유효기간 설정 (기본 12시간으로 가정)
        this.tokenExpiry = now + 12 * 60 * 60 * 1000;
        return token;
      } else {
        throw new Error(result.header?.resultMessage || '토큰 발급 실패');
      }
    } catch (error) {
      console.error('[NotificationHubProvider] 토큰 발급 오류:', error);
      throw error;
    }
  }

  /**
   * SMS 발송 (자동 LMS 전환)
   * - 90바이트 이하: SMS
   * - 90바이트 초과: LMS
   */
  async sendSMS(to: string, message: string, title?: string): Promise<NotificationHubResult> {
    if (!this.isEnabled) {
      console.log('[NotificationHubProvider] 테스트 모드 - SMS 미발송:', { to, message, title });
      return {
        success: true,
        messageId: `test-hub-sms-${Date.now()}`,
      };
    }

    try {
      const token = await this.getAccessToken();
      const normalizedPhone = this.normalizePhoneNumber(to);
      const byteLength = Buffer.byteLength(message, 'utf8');

      // 90바이트 초과 시 LMS로 전환
      const channel = byteLength > 90 ? 'LMS' : 'SMS';

      const requestBody: Record<string, unknown> = {
        sender: this.normalizePhoneNumber(this.smsSender),
        body: message,
        recipients: [
          {
            phoneNumber: normalizedPhone,
          },
        ],
      };

      // LMS의 경우 제목 추가
      if (channel === 'LMS' && title) {
        requestBody.title = title;
      }

      const response = await fetch(
        `${this.baseUrl}/message/v1.0/appkeys/${this.appKey}/${channel.toLowerCase()}/free-form-messages/NORMAL`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'X-NHN-Authorization': token,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      if (result.header?.isSuccessful) {
        return {
          success: true,
          messageId: result.body?.data?.messageId || result.body?.data?.requestId,
        };
      } else {
        return {
          success: false,
          error: result.header?.resultMessage || `${channel} 발송 실패`,
        };
      }
    } catch (error) {
      console.error('[NotificationHubProvider] SMS 발송 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS 발송 중 오류 발생',
      };
    }
  }

  /**
   * 알림톡 발송
   */
  async sendAlimtalk(
    to: string,
    templateCode: string,
    params: Record<string, string>
  ): Promise<NotificationHubResult> {
    if (!this.isEnabled) {
      console.log('[NotificationHubProvider] 테스트 모드 - 알림톡 미발송:', {
        to,
        templateCode,
        params,
      });
      return {
        success: true,
        messageId: `test-hub-alimtalk-${Date.now()}`,
      };
    }

    if (!this.kakaoSenderKey) {
      console.warn('[NotificationHubProvider] 카카오 발신 프로필 키가 설정되지 않았습니다.');
      return {
        success: false,
        error: '카카오 발신 프로필 키 미설정',
      };
    }

    try {
      const token = await this.getAccessToken();
      const normalizedPhone = this.normalizePhoneNumber(to);

      const requestBody = {
        senderKey: this.kakaoSenderKey,
        templateCode,
        recipients: [
          {
            phoneNumber: normalizedPhone,
            templateVariables: params,
          },
        ],
      };

      const response = await fetch(
        `${this.baseUrl}/message/v1.0/appkeys/${this.appKey}/alimtalk/free-form-messages/NORMAL`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'X-NHN-Authorization': token,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      if (result.header?.isSuccessful) {
        return {
          success: true,
          messageId: result.body?.data?.messageId || result.body?.data?.requestId,
        };
      } else {
        return {
          success: false,
          error: result.header?.resultMessage || '알림톡 발송 실패',
        };
      }
    } catch (error) {
      console.error('[NotificationHubProvider] 알림톡 발송 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알림톡 발송 중 오류 발생',
      };
    }
  }

  /**
   * 알림톡 발송 (실패 시 SMS 대체 발송)
   */
  async sendAlimtalkWithFallback(
    to: string,
    templateCode: string,
    params: Record<string, string>,
    fallbackMessage: string,
    fallbackTitle?: string
  ): Promise<NotificationHubResult> {
    if (!this.isEnabled) {
      console.log('[NotificationHubProvider] 테스트 모드 - 알림톡(대체발송) 미발송:', {
        to,
        templateCode,
        params,
        fallbackMessage,
      });
      return {
        success: true,
        messageId: `test-hub-alimtalk-fallback-${Date.now()}`,
      };
    }

    if (!this.kakaoSenderKey) {
      // 카카오 미설정 시 SMS로 대체
      console.log('[NotificationHubProvider] 카카오 미설정 - SMS로 대체 발송');
      return this.sendSMS(to, fallbackMessage, fallbackTitle);
    }

    try {
      const token = await this.getAccessToken();
      const normalizedPhone = this.normalizePhoneNumber(to);

      const requestBody = {
        senderKey: this.kakaoSenderKey,
        templateCode,
        recipients: [
          {
            phoneNumber: normalizedPhone,
            templateVariables: params,
            fallback: {
              resend: true,
              type: 'SMS',
              sender: this.normalizePhoneNumber(this.smsSender),
              body: fallbackMessage,
              title: fallbackTitle,
            },
          },
        ],
      };

      const response = await fetch(
        `${this.baseUrl}/message/v1.0/appkeys/${this.appKey}/alimtalk/free-form-messages/NORMAL`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'X-NHN-Authorization': token,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      if (result.header?.isSuccessful) {
        return {
          success: true,
          messageId: result.body?.data?.messageId || result.body?.data?.requestId,
        };
      } else {
        return {
          success: false,
          error: result.header?.resultMessage || '알림톡 발송 실패',
        };
      }
    } catch (error) {
      console.error('[NotificationHubProvider] 알림톡(대체발송) 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알림톡(대체발송) 중 오류 발생',
      };
    }
  }
}

// 싱글톤 인스턴스
export const notificationHubProvider = new NotificationHubProvider();
