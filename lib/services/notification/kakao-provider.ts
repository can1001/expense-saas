import type { KakaoResult, AlimtalkButton } from './types';

/**
 * Kakao Alimtalk Provider (NHN Cloud 통합 API 사용)
 *
 * 환경변수 설정 필요:
 * - KAKAO_ALIMTALK_APP_KEY: NHN Cloud 알림톡 앱 키
 * - KAKAO_ALIMTALK_SECRET_KEY: NHN Cloud 알림톡 시크릿 키
 * - KAKAO_ALIMTALK_SENDER_KEY: 카카오 비즈니스 채널 발신 키
 *
 * 사전 요구사항:
 * 1. 카카오 비즈니스 채널 개설 (https://business.kakao.com)
 * 2. NHN Cloud 알림톡 서비스 연동
 * 3. 템플릿 심사 등록 (1-3일 소요)
 */
export class KakaoProvider {
  private readonly baseUrl = 'https://api-alimtalk.cloud.toast.com/alimtalk/v2.3';
  private readonly appKey: string;
  private readonly secretKey: string;
  private readonly senderKey: string;
  private readonly isEnabled: boolean;

  constructor() {
    this.appKey = process.env.KAKAO_ALIMTALK_APP_KEY || '';
    this.secretKey = process.env.KAKAO_ALIMTALK_SECRET_KEY || '';
    this.senderKey = process.env.KAKAO_ALIMTALK_SENDER_KEY || '';
    this.isEnabled = Boolean(this.appKey && this.secretKey && this.senderKey);

    if (!this.isEnabled) {
      console.warn('[KakaoProvider] 카카오 알림톡 설정이 완료되지 않았습니다. 환경변수를 확인하세요.');
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
   * 알림톡 발송
   *
   * @param to 수신자 전화번호
   * @param templateCode 심사 등록된 템플릿 코드
   * @param templateParams 템플릿 변수
   * @param buttons 버튼 목록 (선택)
   */
  async send(
    to: string,
    templateCode: string,
    templateParams: Record<string, string>,
    buttons?: AlimtalkButton[]
  ): Promise<KakaoResult> {
    if (!this.isEnabled) {
      console.log('[KakaoProvider] 테스트 모드 - 알림톡 미발송:', {
        to,
        templateCode,
        templateParams,
      });
      return {
        success: true,
        messageId: `test-kakao-${Date.now()}`,
      };
    }

    try {
      const normalizedPhone = this.normalizePhoneNumber(to);

      const requestBody: Record<string, unknown> = {
        senderKey: this.senderKey,
        templateCode,
        recipientList: [
          {
            recipientNo: normalizedPhone,
            templateParameter: templateParams,
          },
        ],
      };

      // 버튼 추가 (있는 경우)
      if (buttons && buttons.length > 0) {
        requestBody.recipientList = [
          {
            recipientNo: normalizedPhone,
            templateParameter: templateParams,
            buttons: buttons.map(btn => ({
              ordering: 1,
              type: btn.type,
              name: btn.name,
              linkMo: btn.linkMobile,
              linkPc: btn.linkPc,
            })),
          },
        ];
      }

      const response = await fetch(
        `${this.baseUrl}/appkeys/${this.appKey}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'X-Secret-Key': this.secretKey,
          },
          body: JSON.stringify(requestBody),
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
          error: result.header?.resultMessage || '알림톡 발송 실패',
        };
      }
    } catch (error) {
      console.error('[KakaoProvider] 알림톡 발송 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알림톡 발송 중 오류 발생',
      };
    }
  }

  /**
   * 대체 발송 (SMS) - 알림톡 실패 시 SMS로 대체
   *
   * 참고: NHN Cloud에서는 알림톡 발송 실패 시 자동으로 SMS 대체 발송 옵션 제공
   */
  async sendWithFallback(
    to: string,
    templateCode: string,
    templateParams: Record<string, string>,
    fallbackMessage: string,
    buttons?: AlimtalkButton[]
  ): Promise<KakaoResult> {
    if (!this.isEnabled) {
      console.log('[KakaoProvider] 테스트 모드 - 대체발송 미발송:', {
        to,
        templateCode,
        fallbackMessage,
      });
      return {
        success: true,
        messageId: `test-kakao-fallback-${Date.now()}`,
      };
    }

    try {
      const normalizedPhone = this.normalizePhoneNumber(to);

      const requestBody: Record<string, unknown> = {
        senderKey: this.senderKey,
        templateCode,
        recipientList: [
          {
            recipientNo: normalizedPhone,
            templateParameter: templateParams,
            resendParameter: {
              isResend: true,
              resendType: 'SMS',
              resendContent: fallbackMessage,
              resendSendNo: process.env.NHN_SMS_SENDER_NUMBER || '',
            },
          },
        ],
      };

      if (buttons && buttons.length > 0) {
        (requestBody.recipientList as Array<Record<string, unknown>>)[0].buttons = buttons.map((btn, idx) => ({
          ordering: idx + 1,
          type: btn.type,
          name: btn.name,
          linkMo: btn.linkMobile,
          linkPc: btn.linkPc,
        }));
      }

      const response = await fetch(
        `${this.baseUrl}/appkeys/${this.appKey}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'X-Secret-Key': this.secretKey,
          },
          body: JSON.stringify(requestBody),
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
          error: result.header?.resultMessage || '알림톡 발송 실패',
        };
      }
    } catch (error) {
      console.error('[KakaoProvider] 대체발송 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '대체발송 중 오류 발생',
      };
    }
  }
}

// 싱글톤 인스턴스
export const kakaoProvider = new KakaoProvider();
