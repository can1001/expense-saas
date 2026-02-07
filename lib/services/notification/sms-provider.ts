import type { SMSResult } from './types';

/**
 * NHN Cloud SMS Provider
 *
 * 환경변수 설정 필요:
 * - NHN_SMS_APP_KEY: NHN Cloud 앱 키
 * - NHN_SMS_SECRET_KEY: NHN Cloud 시크릿 키
 * - NHN_SMS_SENDER_NUMBER: 발신번호 (사전 등록 필요)
 */
export class SMSProvider {
  private readonly baseUrl = 'https://api-sms.cloud.toast.com/sms/v3.0';
  private readonly appKey: string;
  private readonly secretKey: string;
  private readonly senderNumber: string;
  private readonly isEnabled: boolean;

  constructor() {
    this.appKey = process.env.NHN_SMS_APP_KEY || '';
    this.secretKey = process.env.NHN_SMS_SECRET_KEY || '';
    this.senderNumber = process.env.NHN_SMS_SENDER_NUMBER || '';
    this.isEnabled = Boolean(this.appKey && this.secretKey && this.senderNumber);

    if (!this.isEnabled) {
      console.warn('[SMSProvider] SMS 설정이 완료되지 않았습니다. 환경변수를 확인하세요.');
    }
  }

  /**
   * 설정 상태 확인
   */
  isConfigured(): boolean {
    return this.isEnabled;
  }

  /**
   * 전화번호 정규화 (하이픈 제거)
   */
  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/-/g, '');
  }

  /**
   * SMS 발송
   */
  async send(to: string, message: string): Promise<SMSResult> {
    if (!this.isEnabled) {
      console.log('[SMSProvider] 테스트 모드 - SMS 미발송:', { to, message });
      return {
        success: true,
        messageId: `test-${Date.now()}`,
      };
    }

    try {
      const normalizedPhone = this.normalizePhoneNumber(to);

      const response = await fetch(
        `${this.baseUrl}/appKeys/${this.appKey}/sender/sms`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'X-Secret-Key': this.secretKey,
          },
          body: JSON.stringify({
            body: message,
            sendNo: this.normalizePhoneNumber(this.senderNumber),
            recipientList: [
              {
                recipientNo: normalizedPhone,
              },
            ],
          }),
        }
      );

      const result = await response.json();

      if (result.header?.isSuccessful) {
        return {
          success: true,
          messageId: result.body?.data?.requestId,
        };
      } else {
        return {
          success: false,
          error: result.header?.resultMessage || 'SMS 발송 실패',
        };
      }
    } catch (error) {
      console.error('[SMSProvider] SMS 발송 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS 발송 중 오류 발생',
      };
    }
  }

  /**
   * LMS (장문) 발송 - 90자 초과 시 사용
   */
  async sendLMS(to: string, title: string, message: string): Promise<SMSResult> {
    if (!this.isEnabled) {
      console.log('[SMSProvider] 테스트 모드 - LMS 미발송:', { to, title, message });
      return {
        success: true,
        messageId: `test-lms-${Date.now()}`,
      };
    }

    try {
      const normalizedPhone = this.normalizePhoneNumber(to);

      const response = await fetch(
        `${this.baseUrl}/appKeys/${this.appKey}/sender/mms`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'X-Secret-Key': this.secretKey,
          },
          body: JSON.stringify({
            title,
            body: message,
            sendNo: this.normalizePhoneNumber(this.senderNumber),
            recipientList: [
              {
                recipientNo: normalizedPhone,
              },
            ],
          }),
        }
      );

      const result = await response.json();

      if (result.header?.isSuccessful) {
        return {
          success: true,
          messageId: result.body?.data?.requestId,
        };
      } else {
        return {
          success: false,
          error: result.header?.resultMessage || 'LMS 발송 실패',
        };
      }
    } catch (error) {
      console.error('[SMSProvider] LMS 발송 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LMS 발송 중 오류 발생',
      };
    }
  }

  /**
   * 메시지 길이에 따라 SMS/LMS 자동 선택
   */
  async sendAuto(to: string, message: string, title?: string): Promise<SMSResult> {
    // 한글 기준 약 45자 (90바이트) 초과 시 LMS
    const byteLength = Buffer.byteLength(message, 'utf8');

    if (byteLength > 90 && title) {
      return this.sendLMS(to, title, message);
    }

    return this.send(to, message);
  }
}

// 싱글톤 인스턴스
export const smsProvider = new SMSProvider();
