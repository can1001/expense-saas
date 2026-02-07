import { NotificationEventType } from '@prisma/client';
import type { MessageTemplate, NotificationContext } from './types';

// 금액 포맷팅
function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR');
}

// 메시지 템플릿 정의
export const NOTIFICATION_TEMPLATES: Record<string, MessageTemplate> = {
  // 결재 요청 (결재자에게)
  SUBMIT_TO_APPROVER: {
    code: 'SUBMIT_TO_APPROVER',
    eventType: 'SUBMIT' as NotificationEventType,
    sms: '[지출결의] {{applicantName}}님이 {{amount}}원 결재 요청. 확인: {{statusUrl}}',
    kakao: {
      title: '결재 요청',
      body: `안녕하세요.

{{applicantName}}님이 지출결의서 결재를 요청했습니다.

- 청구금액: {{amount}}원
- 부서: {{department}}

아래 버튼을 눌러 결재를 진행해 주세요.`,
      buttons: [
        {
          type: 'WL',
          name: '결재하기',
          linkMobile: '{{statusUrl}}',
          linkPc: '{{statusUrl}}',
        },
      ],
    },
  },

  // 승인 완료 (신청자에게)
  APPROVE_TO_APPLICANT: {
    code: 'APPROVE_TO_APPLICANT',
    eventType: 'APPROVE' as NotificationEventType,
    sms: '[지출결의] {{approverName}}님이 {{amount}}원 결재 승인{{completeText}}',
    kakao: {
      title: '결재 승인',
      body: `안녕하세요, {{applicantName}}님.

지출결의서가 승인되었습니다.

- 청구금액: {{amount}}원
- 승인자: {{approverName}}
{{completeMessage}}`,
      buttons: [
        {
          type: 'WL',
          name: '상세 보기',
          linkMobile: '{{statusUrl}}',
          linkPc: '{{statusUrl}}',
        },
      ],
    },
  },

  // 반려 (신청자에게)
  REJECT_TO_APPLICANT: {
    code: 'REJECT_TO_APPLICANT',
    eventType: 'REJECT' as NotificationEventType,
    sms: '[지출결의] 결재 반려. 사유: {{rejectReason}}',
    kakao: {
      title: '결재 반려',
      body: `안녕하세요, {{applicantName}}님.

지출결의서가 반려되었습니다.

- 청구금액: {{amount}}원
- 반려자: {{approverName}}
- 반려사유: {{rejectReason}}

수정 후 재제출하시거나 문의해 주세요.`,
      buttons: [
        {
          type: 'WL',
          name: '수정하기',
          linkMobile: '{{statusUrl}}',
          linkPc: '{{statusUrl}}',
        },
      ],
    },
  },

  // 회수 (대기중인 결재자에게)
  WITHDRAW_TO_APPROVER: {
    code: 'WITHDRAW_TO_APPROVER',
    eventType: 'WITHDRAW' as NotificationEventType,
    sms: '[지출결의] {{applicantName}}님이 결재 요청을 회수했습니다.',
    kakao: {
      title: '결재 요청 회수',
      body: `안녕하세요.

{{applicantName}}님이 지출결의서를 회수했습니다.

- 청구금액: {{amount}}원
- 부서: {{department}}

해당 결재 건은 더 이상 처리하지 않으셔도 됩니다.`,
    },
  },

  // 지급 완료 (신청자에게)
  PAYMENT_COMPLETE_TO_APPLICANT: {
    code: 'PAYMENT_COMPLETE_TO_APPLICANT',
    eventType: 'PAYMENT_COMPLETE' as NotificationEventType,
    sms: '[지출결의] {{amount}}원 지급 완료 ({{paymentDate}})',
    kakao: {
      title: '지급 완료',
      body: `안녕하세요, {{applicantName}}님.

지출결의서 지급이 완료되었습니다.

- 지급금액: {{amount}}원
- 지급일시: {{paymentDate}}
- 입금계좌: {{bankName}} {{accountNumber}}

감사합니다.`,
      buttons: [
        {
          type: 'WL',
          name: '상세 보기',
          linkMobile: '{{statusUrl}}',
          linkPc: '{{statusUrl}}',
        },
      ],
    },
  },
};

// 템플릿 변수 치환
export function renderTemplate(template: string, context: NotificationContext): string {
  let result = template;

  // 기본 변수 치환
  result = result.replace(/\{\{applicantName\}\}/g, context.applicantName || '');
  result = result.replace(/\{\{amount\}\}/g, formatAmount(context.requestAmount));
  result = result.replace(/\{\{department\}\}/g, context.department || '');
  result = result.replace(/\{\{budgetDetail\}\}/g, context.budgetDetail || '');
  result = result.replace(/\{\{statusUrl\}\}/g, context.statusUrl || '');
  result = result.replace(/\{\{approverName\}\}/g, context.approverName || '');
  result = result.replace(/\{\{rejectReason\}\}/g, context.rejectReason || '');
  result = result.replace(/\{\{paymentDate\}\}/g, context.paymentDate || '');
  result = result.replace(/\{\{bankName\}\}/g, context.bankName || '');
  result = result.replace(/\{\{accountNumber\}\}/g, context.accountNumber || '');

  // 조건부 텍스트
  const completeText = context.isComplete ? ' (최종승인)' : '';
  result = result.replace(/\{\{completeText\}\}/g, completeText);

  const completeMessage = context.isComplete
    ? '\n최종 승인이 완료되어 지급 대기 상태입니다.'
    : '\n다음 결재자의 승인을 기다리고 있습니다.';
  result = result.replace(/\{\{completeMessage\}\}/g, completeMessage);

  return result;
}

// 이벤트 타입별 템플릿 조회
export function getTemplateByEvent(
  eventType: NotificationEventType,
  isApprover: boolean = false
): MessageTemplate | null {
  switch (eventType) {
    case 'SUBMIT':
      return NOTIFICATION_TEMPLATES.SUBMIT_TO_APPROVER;
    case 'APPROVE':
      return NOTIFICATION_TEMPLATES.APPROVE_TO_APPLICANT;
    case 'REJECT':
      return NOTIFICATION_TEMPLATES.REJECT_TO_APPLICANT;
    case 'WITHDRAW':
      return NOTIFICATION_TEMPLATES.WITHDRAW_TO_APPROVER;
    case 'PAYMENT_COMPLETE':
      return NOTIFICATION_TEMPLATES.PAYMENT_COMPLETE_TO_APPLICANT;
    default:
      return null;
  }
}
