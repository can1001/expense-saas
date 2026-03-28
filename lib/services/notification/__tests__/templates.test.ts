import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_TEMPLATES,
  renderTemplate,
  getTemplateByEvent,
} from '../templates';
import { NotificationEventType } from '@prisma/client';
import type { NotificationContext } from '../types';

describe('notification/templates', () => {
  describe('NOTIFICATION_TEMPLATES', () => {
    it('should have all required template codes', () => {
      expect(NOTIFICATION_TEMPLATES).toHaveProperty('SUBMIT_TO_APPROVER');
      expect(NOTIFICATION_TEMPLATES).toHaveProperty('APPROVE_TO_APPLICANT');
      expect(NOTIFICATION_TEMPLATES).toHaveProperty('REJECT_TO_APPLICANT');
      expect(NOTIFICATION_TEMPLATES).toHaveProperty('WITHDRAW_TO_APPROVER');
      expect(NOTIFICATION_TEMPLATES).toHaveProperty('PAYMENT_COMPLETE_TO_APPLICANT');
    });

    it('should have valid structure for SUBMIT_TO_APPROVER', () => {
      const template = NOTIFICATION_TEMPLATES.SUBMIT_TO_APPROVER;
      expect(template.code).toBe('SUBMIT_TO_APPROVER');
      expect(template.eventType).toBe('SUBMIT');
      expect(template.sms).toBeTruthy();
      expect(template.kakao).toBeDefined();
      expect(template.kakao?.title).toBeTruthy();
      expect(template.kakao?.body).toBeTruthy();
      expect(template.kakao?.buttons).toHaveLength(1);
    });

    it('should have valid structure for APPROVE_TO_APPLICANT', () => {
      const template = NOTIFICATION_TEMPLATES.APPROVE_TO_APPLICANT;
      expect(template.code).toBe('APPROVE_TO_APPLICANT');
      expect(template.eventType).toBe('APPROVE');
      expect(template.sms).toBeTruthy();
      expect(template.kakao).toBeDefined();
    });

    it('should have valid structure for REJECT_TO_APPLICANT', () => {
      const template = NOTIFICATION_TEMPLATES.REJECT_TO_APPLICANT;
      expect(template.code).toBe('REJECT_TO_APPLICANT');
      expect(template.eventType).toBe('REJECT');
      expect(template.sms).toBeTruthy();
      expect(template.kakao).toBeDefined();
    });

    it('should have valid structure for WITHDRAW_TO_APPROVER', () => {
      const template = NOTIFICATION_TEMPLATES.WITHDRAW_TO_APPROVER;
      expect(template.code).toBe('WITHDRAW_TO_APPROVER');
      expect(template.eventType).toBe('WITHDRAW');
      expect(template.sms).toBeTruthy();
      expect(template.kakao).toBeDefined();
    });

    it('should have valid structure for PAYMENT_COMPLETE_TO_APPLICANT', () => {
      const template = NOTIFICATION_TEMPLATES.PAYMENT_COMPLETE_TO_APPLICANT;
      expect(template.code).toBe('PAYMENT_COMPLETE_TO_APPLICANT');
      expect(template.eventType).toBe('PAYMENT_COMPLETE');
      expect(template.sms).toBeTruthy();
      expect(template.kakao).toBeDefined();
    });
  });

  describe('renderTemplate', () => {
    const baseContext: NotificationContext = {
      expenseId: 'exp-123',
      applicantName: '김철수',
      requestAmount: 100000,
      department: '기획팀',
      budgetDetail: '사무용품',
      statusUrl: 'https://example.com/status/123',
    };

    it('should replace applicantName variable', () => {
      const result = renderTemplate('안녕하세요 {{applicantName}}님', baseContext);
      expect(result).toBe('안녕하세요 김철수님');
    });

    it('should replace amount variable with formatted number', () => {
      const result = renderTemplate('금액: {{amount}}원', baseContext);
      expect(result).toBe('금액: 100,000원');
    });

    it('should replace department variable', () => {
      const result = renderTemplate('부서: {{department}}', baseContext);
      expect(result).toBe('부서: 기획팀');
    });

    it('should replace budgetDetail variable', () => {
      const result = renderTemplate('항목: {{budgetDetail}}', baseContext);
      expect(result).toBe('항목: 사무용품');
    });

    it('should replace statusUrl variable', () => {
      const result = renderTemplate('링크: {{statusUrl}}', baseContext);
      expect(result).toBe('링크: https://example.com/status/123');
    });

    it('should replace approverName variable', () => {
      const context = { ...baseContext, approverName: '박영희' };
      const result = renderTemplate('승인자: {{approverName}}', context);
      expect(result).toBe('승인자: 박영희');
    });

    it('should replace rejectReason variable', () => {
      const context = { ...baseContext, rejectReason: '예산 초과' };
      const result = renderTemplate('사유: {{rejectReason}}', context);
      expect(result).toBe('사유: 예산 초과');
    });

    it('should replace paymentDate variable', () => {
      const context = { ...baseContext, paymentDate: '2024-03-15' };
      const result = renderTemplate('일자: {{paymentDate}}', context);
      expect(result).toBe('일자: 2024-03-15');
    });

    it('should replace bankName variable', () => {
      const context = { ...baseContext, bankName: '국민은행' };
      const result = renderTemplate('은행: {{bankName}}', context);
      expect(result).toBe('은행: 국민은행');
    });

    it('should replace accountNumber variable', () => {
      const context = { ...baseContext, accountNumber: '123-456-7890' };
      const result = renderTemplate('계좌: {{accountNumber}}', context);
      expect(result).toBe('계좌: 123-456-7890');
    });

    it('should handle missing optional variables with empty string', () => {
      const minimalContext: NotificationContext = {
        expenseId: 'exp-123',
        applicantName: '김철수',
        requestAmount: 100000,
        statusUrl: 'https://example.com',
      };
      const result = renderTemplate('{{department}} {{budgetDetail}}', minimalContext);
      expect(result).toBe(' ');
    });

    it('should replace completeText with " (최종승인)" when isComplete is true', () => {
      const context = { ...baseContext, isComplete: true };
      const result = renderTemplate('승인 완료{{completeText}}', context);
      expect(result).toBe('승인 완료 (최종승인)');
    });

    it('should replace completeText with empty string when isComplete is false', () => {
      const context = { ...baseContext, isComplete: false };
      const result = renderTemplate('승인 완료{{completeText}}', context);
      expect(result).toBe('승인 완료');
    });

    it('should replace completeMessage with final approval message when isComplete is true', () => {
      const context = { ...baseContext, isComplete: true };
      const result = renderTemplate('{{completeMessage}}', context);
      expect(result).toContain('최종 승인이 완료');
      expect(result).toContain('지급 대기 상태');
    });

    it('should replace completeMessage with next approver message when isComplete is false', () => {
      const context = { ...baseContext, isComplete: false };
      const result = renderTemplate('{{completeMessage}}', context);
      expect(result).toContain('다음 결재자');
    });

    it('should replace multiple variables in same template', () => {
      const result = renderTemplate(
        '{{applicantName}}님이 {{amount}}원을 {{department}}에서 요청',
        baseContext
      );
      expect(result).toBe('김철수님이 100,000원을 기획팀에서 요청');
    });

    it('should handle repeated variables', () => {
      const result = renderTemplate(
        '{{applicantName}}님, {{applicantName}}님, {{applicantName}}님',
        baseContext
      );
      expect(result).toBe('김철수님, 김철수님, 김철수님');
    });

    it('should format amount correctly for various numbers', () => {
      const tests = [
        { amount: 0, expected: '0' },
        { amount: 1000, expected: '1,000' },
        { amount: 1234567, expected: '1,234,567' },
        { amount: 999999999, expected: '999,999,999' },
      ];

      tests.forEach(({ amount, expected }) => {
        const context = { ...baseContext, requestAmount: amount };
        const result = renderTemplate('{{amount}}원', context);
        expect(result).toBe(`${expected}원`);
      });
    });
  });

  describe('getTemplateByEvent', () => {
    it('should return SUBMIT_TO_APPROVER for SUBMIT event', () => {
      const template = getTemplateByEvent('SUBMIT' as NotificationEventType);
      expect(template).toBe(NOTIFICATION_TEMPLATES.SUBMIT_TO_APPROVER);
    });

    it('should return APPROVE_TO_APPLICANT for APPROVE event', () => {
      const template = getTemplateByEvent('APPROVE' as NotificationEventType);
      expect(template).toBe(NOTIFICATION_TEMPLATES.APPROVE_TO_APPLICANT);
    });

    it('should return REJECT_TO_APPLICANT for REJECT event', () => {
      const template = getTemplateByEvent('REJECT' as NotificationEventType);
      expect(template).toBe(NOTIFICATION_TEMPLATES.REJECT_TO_APPLICANT);
    });

    it('should return WITHDRAW_TO_APPROVER for WITHDRAW event', () => {
      const template = getTemplateByEvent('WITHDRAW' as NotificationEventType);
      expect(template).toBe(NOTIFICATION_TEMPLATES.WITHDRAW_TO_APPROVER);
    });

    it('should return PAYMENT_COMPLETE_TO_APPLICANT for PAYMENT_COMPLETE event', () => {
      const template = getTemplateByEvent('PAYMENT_COMPLETE' as NotificationEventType);
      expect(template).toBe(NOTIFICATION_TEMPLATES.PAYMENT_COMPLETE_TO_APPLICANT);
    });

    it('should return null for unknown event type', () => {
      const template = getTemplateByEvent('UNKNOWN' as NotificationEventType);
      expect(template).toBeNull();
    });

    it('should accept isApprover parameter (backwards compatibility)', () => {
      const template = getTemplateByEvent('SUBMIT' as NotificationEventType, true);
      expect(template).toBe(NOTIFICATION_TEMPLATES.SUBMIT_TO_APPROVER);
    });

    it('should work with isApprover false', () => {
      const template = getTemplateByEvent('APPROVE' as NotificationEventType, false);
      expect(template).toBe(NOTIFICATION_TEMPLATES.APPROVE_TO_APPLICANT);
    });
  });

  describe('Template content validation', () => {
    it('SUBMIT_TO_APPROVER SMS should contain required variables', () => {
      const sms = NOTIFICATION_TEMPLATES.SUBMIT_TO_APPROVER.sms;
      expect(sms).toContain('{{applicantName}}');
      expect(sms).toContain('{{amount}}');
      expect(sms).toContain('{{statusUrl}}');
    });

    it('APPROVE_TO_APPLICANT SMS should contain required variables', () => {
      const sms = NOTIFICATION_TEMPLATES.APPROVE_TO_APPLICANT.sms;
      expect(sms).toContain('{{approverName}}');
      expect(sms).toContain('{{amount}}');
      expect(sms).toContain('{{completeText}}');
    });

    it('REJECT_TO_APPLICANT SMS should contain required variables', () => {
      const sms = NOTIFICATION_TEMPLATES.REJECT_TO_APPLICANT.sms;
      expect(sms).toContain('{{rejectReason}}');
    });

    it('PAYMENT_COMPLETE_TO_APPLICANT SMS should contain required variables', () => {
      const sms = NOTIFICATION_TEMPLATES.PAYMENT_COMPLETE_TO_APPLICANT.sms;
      expect(sms).toContain('{{amount}}');
      expect(sms).toContain('{{paymentDate}}');
    });

    it('all templates should have non-empty SMS messages', () => {
      Object.values(NOTIFICATION_TEMPLATES).forEach((template) => {
        expect(template.sms).toBeTruthy();
        expect(template.sms.length).toBeGreaterThan(0);
      });
    });

    it('all kakao templates should have body', () => {
      Object.values(NOTIFICATION_TEMPLATES).forEach((template) => {
        if (template.kakao) {
          expect(template.kakao.body).toBeTruthy();
          expect(template.kakao.body.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
