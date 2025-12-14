import { describe, it, expect } from 'vitest';
import {
  generateApprovalLine,
  canApprove,
  canModifyApprovalLine,
  calculateApprovalStatus,
  calculateNextStep,
  createApprovalSnapshot,
  updateDepartmentApprovers,
  getAllDepartmentApprovers,
  type ExpenseData,
} from '../approval-engine';

describe('approval-engine', () => {
  describe('generateApprovalLine', () => {
    it('should generate 2-step approval line for amount under 500,000', () => {
      const expenseData: ExpenseData = {
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 300000,
        applicantName: '홍길동',
      };

      const result = generateApprovalLine(expenseData);

      expect(result.totalSteps).toBe(2);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].stepName).toBe('팀장');
      expect(result.steps[1].stepName).toBe('회계');
      expect(result.isUrgent).toBe(false);
    });

    it('should generate 3-step approval line for amount between 500,000 and 3,000,000', () => {
      const expenseData: ExpenseData = {
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 1000000,
        applicantName: '홍길동',
      };

      const result = generateApprovalLine(expenseData);

      expect(result.totalSteps).toBe(3);
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].stepName).toBe('팀장');
      expect(result.steps[1].stepName).toBe('회계');
      expect(result.steps[2].stepName).toBe('재정팀장');
      expect(result.isUrgent).toBe(false);
    });

    it('should generate 3-step approval line with urgent flag for amount over 3,000,000', () => {
      const expenseData: ExpenseData = {
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 5000000,
        applicantName: '홍길동',
      };

      const result = generateApprovalLine(expenseData);

      expect(result.totalSteps).toBe(3);
      expect(result.steps).toHaveLength(3);
      expect(result.isUrgent).toBe(true);
    });

    it('should throw error for self-approval', () => {
      const expenseData: ExpenseData = {
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 300000,
        applicantName: '김재정', // 팀장과 동일한 이름
      };

      expect(() => generateApprovalLine(expenseData)).toThrow('자기결재 불가');
    });

    it('should use default approvers for unknown department', () => {
      const expenseData: ExpenseData = {
        committee: '기획위원회',
        department: '알수없는부서',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 300000,
        applicantName: '홍길동',
      };

      const result = generateApprovalLine(expenseData);

      expect(result.totalSteps).toBe(2);
      expect(result.steps[0].approverName).toBe('팀장'); // 기본값
    });
  });

  describe('canApprove', () => {
    it('should allow approval when all conditions are met', () => {
      const result = canApprove('김재정', '김재정', 1, 1);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny approval when not the current step', () => {
      const result = canApprove('김재정', '김재정', 1, 2);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('현재 1차 결재 대기 중입니다');
    });

    it('should deny approval when not the designated approver', () => {
      const result = canApprove('홍길동', '김재정', 1, 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('김재정');
    });
  });

  describe('canModifyApprovalLine', () => {
    it('should allow modification when status is DRAFT and user is applicant', () => {
      const result = canModifyApprovalLine('DRAFT', '홍길동', '홍길동');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny modification when status is not DRAFT', () => {
      const result = canModifyApprovalLine('PENDING', '홍길동', '홍길동');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('제출 후에는 결재선을 수정할 수 없습니다');
    });

    it('should deny modification when user is not applicant', () => {
      const result = canModifyApprovalLine('DRAFT', '김철수', '홍길동');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('작성자만 결재선을 수정할 수 있습니다');
    });
  });

  describe('calculateApprovalStatus', () => {
    it('should return PENDING when action is SUBMIT', () => {
      const result = calculateApprovalStatus('SUBMIT', 1, 3);
      expect(result).toBe('PENDING');
    });

    it('should return IN_PROGRESS when approved but not final step', () => {
      const result = calculateApprovalStatus('APPROVE', 2, 3);
      expect(result).toBe('IN_PROGRESS');
    });

    it('should return APPROVED when approved and final step', () => {
      const result = calculateApprovalStatus('APPROVE', 3, 3);
      expect(result).toBe('APPROVED');
    });

    it('should return REJECTED when action is REJECT', () => {
      const result = calculateApprovalStatus('REJECT', 1, 3);
      expect(result).toBe('REJECTED');
    });

    it('should return DRAFT when action is WITHDRAW', () => {
      const result = calculateApprovalStatus('WITHDRAW', 1, 3);
      expect(result).toBe('DRAFT');
    });
  });

  describe('calculateNextStep', () => {
    it('should increment step on approval', () => {
      const result = calculateNextStep(1, 3, 'APPROVE');

      expect(result.nextStep).toBe(2);
      expect(result.isComplete).toBe(false);
    });

    it('should mark as complete when approving final step', () => {
      const result = calculateNextStep(3, 3, 'APPROVE');

      expect(result.nextStep).toBe(3);
      expect(result.isComplete).toBe(true);
    });

    it('should not increment step on rejection', () => {
      const result = calculateNextStep(1, 3, 'REJECT');

      expect(result.nextStep).toBe(1);
      expect(result.isComplete).toBe(false);
    });
  });

  describe('createApprovalSnapshot', () => {
    it('should create JSON snapshot with timestamp', () => {
      const approvalLine = {
        steps: [
          {
            stepNumber: 1,
            stepName: '팀장',
            approverName: '김재정',
            isRequired: true,
          },
        ],
        totalSteps: 1,
        isUrgent: false,
      };

      const snapshot = createApprovalSnapshot(approvalLine);

      expect(snapshot).toBeTruthy();
      const parsed = JSON.parse(snapshot);
      expect(parsed.steps).toHaveLength(1);
      expect(parsed.snapshotTimestamp).toBeTruthy();
    });
  });

  describe('updateDepartmentApprovers', () => {
    it('should update department approvers', () => {
      const newApprovers = {
        department: '테스트부서',
        teamManager: '테스트팀장',
        teamManagerEmail: 'test@church.org',
        accountant: '테스트회계',
        accountantEmail: 'account@church.org',
        financeManager: '테스트재무',
        financeManagerEmail: 'finance@church.org',
      };

      updateDepartmentApprovers('테스트부서', newApprovers);

      const all = getAllDepartmentApprovers();
      expect(all['테스트부서']).toEqual(newApprovers);
    });
  });

  describe('getAllDepartmentApprovers', () => {
    it('should return all department approvers', () => {
      const all = getAllDepartmentApprovers();

      expect(all).toBeTruthy();
      expect(Object.keys(all).length).toBeGreaterThan(0);
      expect(all['재정팀']).toBeTruthy();
    });
  });
});
