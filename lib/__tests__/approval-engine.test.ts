/**
 * @jest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  canModifyApprovalLine,
  canApprove,
  createApprovalSnapshot,
  calculateNextStep,
  calculateApprovalStatus,
  type ApprovalLineInput,
  type ApprovalStepInput,
} from '../approval-engine';

describe('approval-engine', () => {
  describe('canModifyApprovalLine', () => {
    it('should allow modification in DRAFT status by applicant', () => {
      const result = canModifyApprovalLine('DRAFT', '홍길동', '홍길동');
      expect(result).toEqual({ allowed: true });
    });

    it('should not allow modification after submission', () => {
      const result = canModifyApprovalLine('PENDING', '홍길동', '홍길동');
      expect(result).toEqual({
        allowed: false,
        reason: '제출 후에는 결재선을 수정할 수 없습니다. 반려 후 재제출하세요.',
      });
    });

    it('should not allow modification by non-applicant', () => {
      const result = canModifyApprovalLine('DRAFT', '김철수', '홍길동');
      expect(result).toEqual({
        allowed: false,
        reason: '작성자만 결재선을 수정할 수 있습니다.',
      });
    });

    it('should not allow modification in APPROVED_STEP_1 status', () => {
      const result = canModifyApprovalLine('APPROVED_STEP_1', '홍길동', '홍길동');
      expect(result).toEqual({
        allowed: false,
        reason: '제출 후에는 결재선을 수정할 수 없습니다. 반려 후 재제출하세요.',
      });
    });

    it('should not allow modification in REJECTED status', () => {
      const result = canModifyApprovalLine('REJECTED', '홍길동', '홍길동');
      expect(result).toEqual({
        allowed: false,
        reason: '제출 후에는 결재선을 수정할 수 없습니다. 반려 후 재제출하세요.',
      });
    });

    it('should not allow modification in APPROVED_FINAL status', () => {
      const result = canModifyApprovalLine('APPROVED_FINAL', '홍길동', '홍길동');
      expect(result).toEqual({
        allowed: false,
        reason: '제출 후에는 결재선을 수정할 수 없습니다. 반려 후 재제출하세요.',
      });
    });
  });

  describe('canApprove', () => {
    it('should allow approval when approver and step match', () => {
      const result = canApprove('김담당', '김담당', 1, 1);
      expect(result).toEqual({ allowed: true });
    });

    it('should not allow approval when current step does not match', () => {
      const result = canApprove('김담당', '김담당', 1, 2);
      expect(result).toEqual({
        allowed: false,
        reason: '현재 1차 결재 대기 중입니다. 2차 결재는 아직 불가능합니다.',
      });
    });

    it('should not allow approval by wrong approver', () => {
      const result = canApprove('박회계', '김담당', 1, 1);
      expect(result).toEqual({
        allowed: false,
        reason: '1차 결재자(김담당)만 승인할 수 있습니다.',
      });
    });

    it('should not allow approval when trying to skip steps', () => {
      const result = canApprove('이팀장', '이팀장', 1, 3);
      expect(result).toEqual({
        allowed: false,
        reason: '현재 1차 결재 대기 중입니다. 3차 결재는 아직 불가능합니다.',
      });
    });

    it('should work for step 2', () => {
      const result = canApprove('박회계', '박회계', 2, 2);
      expect(result).toEqual({ allowed: true });
    });

    it('should work for step 3', () => {
      const result = canApprove('이팀장', '이팀장', 3, 3);
      expect(result).toEqual({ allowed: true });
    });
  });

  describe('createApprovalSnapshot', () => {
    it('should create JSON snapshot with timestamp', () => {
      const steps: ApprovalStepInput[] = [
        {
          stepNumber: 1,
          stepName: '담당자',
          approverName: '김담당',
          isRequired: true,
        },
        {
          stepNumber: 2,
          stepName: '회계',
          approverName: '박회계',
          isRequired: true,
        },
      ];

      const approvalLine: ApprovalLineInput = {
        steps,
        totalSteps: 2,
        isUrgent: false,
      };

      const snapshot = createApprovalSnapshot(approvalLine);
      const parsed = JSON.parse(snapshot);

      expect(parsed.steps).toHaveLength(2);
      expect(parsed.totalSteps).toBe(2);
      expect(parsed.isUrgent).toBe(false);
      expect(parsed.snapshotTimestamp).toBeDefined();
      expect(typeof parsed.snapshotTimestamp).toBe('string');
    });

    it('should include all step details', () => {
      const steps: ApprovalStepInput[] = [
        {
          stepNumber: 1,
          stepName: '담당자',
          approverName: '김담당',
          approverEmail: 'kim@example.com',
          approverTitle: '담당자',
          isRequired: true,
          isParallel: false,
        },
      ];

      const approvalLine: ApprovalLineInput = {
        steps,
        totalSteps: 1,
        isUrgent: true,
      };

      const snapshot = createApprovalSnapshot(approvalLine);
      const parsed = JSON.parse(snapshot);

      expect(parsed.steps[0]).toMatchObject({
        stepNumber: 1,
        stepName: '담당자',
        approverName: '김담당',
        approverEmail: 'kim@example.com',
        approverTitle: '담당자',
        isRequired: true,
        isParallel: false,
      });
    });
  });

  describe('calculateNextStep', () => {
    it('should return same step and not complete on REJECT', () => {
      const result = calculateNextStep(1, 3, 'REJECT');
      expect(result).toEqual({ nextStep: 1, isComplete: false });
    });

    it('should increment step on APPROVE', () => {
      const result = calculateNextStep(1, 3, 'APPROVE');
      expect(result).toEqual({ nextStep: 2, isComplete: false });
    });

    it('should mark as complete when all steps are approved', () => {
      const result = calculateNextStep(3, 3, 'APPROVE');
      expect(result).toEqual({ nextStep: 3, isComplete: true });
    });

    it('should not exceed total steps', () => {
      const result = calculateNextStep(4, 3, 'APPROVE');
      expect(result).toEqual({ nextStep: 3, isComplete: true });
    });

    it('should handle step 2 correctly', () => {
      const result = calculateNextStep(2, 3, 'APPROVE');
      expect(result).toEqual({ nextStep: 3, isComplete: false });
    });

    it('should keep current step on rejection at any step', () => {
      const result1 = calculateNextStep(2, 3, 'REJECT');
      expect(result1).toEqual({ nextStep: 2, isComplete: false });

      const result2 = calculateNextStep(3, 3, 'REJECT');
      expect(result2).toEqual({ nextStep: 3, isComplete: false });
    });
  });

  describe('calculateApprovalStatus', () => {
    it('should return PENDING on SUBMIT', () => {
      const result = calculateApprovalStatus('SUBMIT', 0, 3);
      expect(result).toBe('PENDING');
    });

    it('should return APPROVED_STEP_1 after first approval', () => {
      const result = calculateApprovalStatus('APPROVE', 1, 3);
      expect(result).toBe('APPROVED_STEP_1');
    });

    it('should return APPROVED_STEP_2 after second approval', () => {
      const result = calculateApprovalStatus('APPROVE', 2, 3);
      expect(result).toBe('APPROVED_STEP_2');
    });

    it('should return APPROVED_FINAL after all approvals', () => {
      const result = calculateApprovalStatus('APPROVE', 3, 3);
      expect(result).toBe('APPROVED_FINAL');
    });

    it('should return REJECTED on REJECT', () => {
      const result = calculateApprovalStatus('REJECT', 1, 3);
      expect(result).toBe('REJECTED');
    });

    it('should return DRAFT on WITHDRAW', () => {
      const result = calculateApprovalStatus('WITHDRAW', 1, 3);
      expect(result).toBe('DRAFT');
    });

    it('should return APPROVED_FINAL when completed step exceeds total steps', () => {
      const result = calculateApprovalStatus('APPROVE', 4, 3);
      expect(result).toBe('APPROVED_FINAL');
    });

    it('should return PENDING for completed step 0', () => {
      const result = calculateApprovalStatus('APPROVE', 0, 3);
      expect(result).toBe('PENDING');
    });

    it('should handle 2-step approval process', () => {
      const result1 = calculateApprovalStatus('APPROVE', 1, 2);
      expect(result1).toBe('APPROVED_STEP_1');

      const result2 = calculateApprovalStatus('APPROVE', 2, 2);
      expect(result2).toBe('APPROVED_FINAL');
    });

    it('should handle 4-step approval process', () => {
      const result1 = calculateApprovalStatus('APPROVE', 1, 4);
      expect(result1).toBe('APPROVED_STEP_1');

      const result2 = calculateApprovalStatus('APPROVE', 2, 4);
      expect(result2).toBe('APPROVED_STEP_2');

      const result3 = calculateApprovalStatus('APPROVE', 3, 4);
      expect(result3).toBe('PENDING'); // 3차는 PENDING 반환 (1, 2, >=totalSteps 경우만 명시)

      const result4 = calculateApprovalStatus('APPROVE', 4, 4);
      expect(result4).toBe('APPROVED_FINAL');
    });

    it('should return DRAFT for unknown action', () => {
      const result = calculateApprovalStatus('UNKNOWN' as any, 1, 3);
      expect(result).toBe('DRAFT');
    });
  });
});
