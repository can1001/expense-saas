import { NotificationChannel, NotificationEventType, NotificationStatus } from '@prisma/client';

// 알림 수신자 정보
export interface NotificationRecipient {
  userId?: string;
  name: string;
  phoneNumber: string;
}

// 알림 컨텍스트 (메시지 변수)
export interface NotificationContext {
  expenseId: string;
  applicantName: string;
  requestAmount: number;
  department?: string;
  budgetDetail?: string;
  statusUrl: string;
  approverName?: string;
  rejectReason?: string;
  paymentDate?: string;
  isComplete?: boolean;
  bankName?: string;
  accountNumber?: string;
}

// 알림 발송 요청
export interface SendNotificationRequest {
  recipient: NotificationRecipient;
  eventType: NotificationEventType;
  context: NotificationContext;
  channels?: NotificationChannel[];  // 지정 안 하면 사용자 설정 따름
}

// 알림 발송 결과
export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
}

// SMS 발송 결과
export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// 카카오 알림톡 발송 결과
export interface KakaoResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// 알림톡 버튼
export interface AlimtalkButton {
  type: 'WL' | 'AL' | 'DS' | 'BK' | 'MD';  // 웹링크, 앱링크, 배송조회, 봇키워드, 메시지전달
  name: string;
  linkMobile?: string;
  linkPc?: string;
  schemeIos?: string;
  schemeAndroid?: string;
}

// 메시지 템플릿 타입
export interface MessageTemplate {
  code: string;
  eventType: NotificationEventType;
  sms: string;
  kakao?: {
    title?: string;
    body: string;
    buttons?: AlimtalkButton[];
  };
}

// Re-export Prisma types
export { NotificationChannel, NotificationEventType, NotificationStatus };
