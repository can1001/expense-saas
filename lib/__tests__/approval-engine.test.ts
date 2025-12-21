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
    it('should generate fixed 3-step approval line regardless of amount', () => {
      const expenseData: ExpenseData = {
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 300000,
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

    it('should generate 3-step approval line with isUrgent=false by default', () => {
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
      expect(result.isUrgent).toBe(false);
    });

    it('should auto-skip self-approval step when applicant is team manager', () => {
      const expenseData: ExpenseData = {
        committee: '기획위원회',
        department: '재정팀',
        budgetCategory: '사무행정비',
        budgetSubcategory: '회의비',
        requestAmount: 300000,
        applicantName: '청연김흥래', // 팀장과 동일한 이름
      };

      const result = generateApprovalLine(expenseData);

      // 팀장(청연김흥래) 제외, 2단계 결재선 생성
      expect(result.totalSteps).toBe(2);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].stepName).toBe('회계');
      expect(result.steps[0].approverName).toBe('청연윤운문');
      expect(result.steps[1].stepName).toBe('재정팀장');
      expect(result.steps[1].approverName).toBe('청연신창국');
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

      expect(result.totalSteps).toBe(3);
      expect(result.steps[0].approverName).toBe('청연김흥래'); // 기본 팀장
      expect(result.steps[1].approverName).toBe('청연윤운문'); // 회계
      expect(result.steps[2].approverName).toBe('청연신창국'); // 재정팀장
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

    it('should return APPROVED_STEP_1 when step 1 approved', () => {
      const result = calculateApprovalStatus('APPROVE', 1, 3);
      expect(result).toBe('APPROVED_STEP_1');
    });

    it('should return APPROVED_STEP_2 when step 2 approved', () => {
      const result = calculateApprovalStatus('APPROVE', 2, 3);
      expect(result).toBe('APPROVED_STEP_2');
    });

    it('should return APPROVED_FINAL when all steps approved', () => {
      const result = calculateApprovalStatus('APPROVE', 3, 3);
      expect(result).toBe('APPROVED_FINAL');
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
      // Note: department approvers are dynamically generated, not pre-stored
      expect(all['기본']).toBeTruthy();
    });
  });

  // ========================================
  // Edge Cases and Additional Coverage
  // ========================================
  describe('Edge Cases', () => {
    describe('generateApprovalLine - boundary amounts', () => {
      it('should generate 3-step line for exactly 499,999 won', () => {
        const expenseData: ExpenseData = {
          committee: '기획위원회',
          department: '재정팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 499_999,
          applicantName: '홍길동',
        };

        const result = generateApprovalLine(expenseData);

        expect(result.totalSteps).toBe(3);
        expect(result.isUrgent).toBe(false);
      });

      it('should generate 3-step line for exactly 500,000 won', () => {
        const expenseData: ExpenseData = {
          committee: '기획위원회',
          department: '재정팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 500_000,
          applicantName: '홍길동',
        };

        const result = generateApprovalLine(expenseData);

        expect(result.totalSteps).toBe(3);
        expect(result.steps).toHaveLength(3);
        expect(result.isUrgent).toBe(false);
      });

      it('should generate 3-step line for exactly 2,999,999 won', () => {
        const expenseData: ExpenseData = {
          committee: '기획위원회',
          department: '재정팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 2_999_999,
          applicantName: '홍길동',
        };

        const result = generateApprovalLine(expenseData);

        expect(result.totalSteps).toBe(3);
        expect(result.isUrgent).toBe(false);
      });

      it('should generate 3-step line for exactly 3,000,000 won', () => {
        const expenseData: ExpenseData = {
          committee: '기획위원회',
          department: '재정팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 3_000_000,
          applicantName: '홍길동',
        };

        const result = generateApprovalLine(expenseData);

        expect(result.totalSteps).toBe(3);
        expect(result.isUrgent).toBe(false);
      });

      it('should generate 3-step line for very high amount', () => {
        const expenseData: ExpenseData = {
          committee: '기획위원회',
          department: '재정팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 100_000_000, // 1억원
          applicantName: '홍길동',
        };

        const result = generateApprovalLine(expenseData);

        expect(result.totalSteps).toBe(3);
        expect(result.isUrgent).toBe(false);
      });

      it('should generate 3-step line for minimal amount (1 won)', () => {
        const expenseData: ExpenseData = {
          committee: '기획위원회',
          department: '재정팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 1,
          applicantName: '홍길동',
        };

        const result = generateApprovalLine(expenseData);

        expect(result.totalSteps).toBe(3);
        expect(result.isUrgent).toBe(false);
      });
    });

    describe('generateApprovalLine - different departments', () => {
      it('should use correct approvers for 교육훈련위원회', () => {
        const expenseData: ExpenseData = {
          committee: '교육훈련위원회',
          department: '교육팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 1_000_000,
          applicantName: '홍길동',
        };

        const result = generateApprovalLine(expenseData);

        // 교육훈련위원회 → 팀장: 청연김흥래, 회계: 청연윤운문, 재정팀장: 청연신창국
        expect(result.steps[0].approverName).toBe('청연김흥래');
        expect(result.steps[1].approverName).toBe('청연윤운문');
        expect(result.steps[2].approverName).toBe('청연신창국');
      });

      it('should use committee-based team leader for any department', () => {
        const expenseData: ExpenseData = {
          committee: '예배위원회',
          department: '선교팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 1_000_000,
          applicantName: '홍길동',
        };

        const result = generateApprovalLine(expenseData);

        // 예배위원회 → 팀장: 청연김흥래
        expect(result.steps[0].approverName).toBe('청연김흥래');
        expect(result.steps[1].approverName).toBe('청연윤운문');
        expect(result.steps[2].approverName).toBe('청연신창국');
      });
    });

    describe('generateApprovalLine - self-approval for different roles', () => {
      it('should auto-skip team manager step if applicant is team manager', () => {
        const expenseData: ExpenseData = {
          committee: '교육훈련위원회',
          department: '교육팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 300_000,
          applicantName: '청연김흥래', // 팀장
        };

        const result = generateApprovalLine(expenseData);

        // 팀장 제외, 2단계: 회계 → 재정팀장
        expect(result.totalSteps).toBe(2);
        expect(result.steps[0].stepName).toBe('회계');
        expect(result.steps[0].approverName).toBe('청연윤운문');
        expect(result.steps[1].stepName).toBe('재정팀장');
        expect(result.steps[1].approverName).toBe('청연신창국');
      });

      it('should auto-skip accountant step if applicant is accountant', () => {
        const expenseData: ExpenseData = {
          committee: '기획위원회',
          department: '재정팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 300_000,
          applicantName: '청연윤운문', // 회계
        };

        const result = generateApprovalLine(expenseData);

        // 회계 제외, 2단계: 팀장 → 재정팀장
        expect(result.totalSteps).toBe(2);
        expect(result.steps[0].stepName).toBe('팀장');
        expect(result.steps[0].approverName).toBe('청연김흥래');
        expect(result.steps[1].stepName).toBe('재정팀장');
        expect(result.steps[1].approverName).toBe('청연신창국');
      });

      it('should throw error if applicant is finance manager (requires pastor approval)', () => {
        const expenseData: ExpenseData = {
          committee: '기획위원회',
          department: '재정팀',
          budgetCategory: '사무행정비',
          budgetSubcategory: '회의비',
          requestAmount: 1_000_000,
          applicantName: '청연신창국', // 재정팀장
        };

        expect(() => generateApprovalLine(expenseData)).toThrow('담임목사 승인이 필요합니다');
      });
    });

    describe('canApprove - edge cases', () => {
      it('should deny when trying to approve future step', () => {
        const result = canApprove('김재정', '김재정', 1, 3);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('현재 1차 결재 대기 중');
      });

      it('should deny when trying to approve past step', () => {
        const result = canApprove('김재정', '김재정', 3, 1);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('현재 3차 결재 대기 중');
      });

      it('should deny when approver name does not match at all', () => {
        const result = canApprove('완전다른사람', '김재정', 1, 1);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('김재정');
      });
    });

    describe('calculateNextStep - edge cases', () => {
      it('should handle step increment at step 1 of 3', () => {
        const result = calculateNextStep(1, 3, 'APPROVE');

        expect(result.nextStep).toBe(2);
        expect(result.isComplete).toBe(false);
      });

      it('should handle step increment at step 2 of 3', () => {
        const result = calculateNextStep(2, 3, 'APPROVE');

        expect(result.nextStep).toBe(3);
        expect(result.isComplete).toBe(false);
      });

      it('should handle rejection at middle step', () => {
        const result = calculateNextStep(2, 3, 'REJECT');

        expect(result.nextStep).toBe(2);
        expect(result.isComplete).toBe(false);
      });

      it('should handle rejection at first step', () => {
        const result = calculateNextStep(1, 3, 'REJECT');

        expect(result.nextStep).toBe(1);
        expect(result.isComplete).toBe(false);
      });

      it('should handle rejection at last step', () => {
        const result = calculateNextStep(3, 3, 'REJECT');

        expect(result.nextStep).toBe(3);
        expect(result.isComplete).toBe(false);
      });
    });

    describe('calculateApprovalStatus - edge cases', () => {
      it('should return APPROVED_STEP_1 for step 1 of 3', () => {
        const result = calculateApprovalStatus('APPROVE', 1, 3);
        expect(result).toBe('APPROVED_STEP_1');
      });

      it('should return APPROVED_STEP_2 for step 2 of 3', () => {
        const result = calculateApprovalStatus('APPROVE', 2, 3);
        expect(result).toBe('APPROVED_STEP_2');
      });

      it('should return APPROVED_FINAL when current equals total', () => {
        const result = calculateApprovalStatus('APPROVE', 3, 3);
        expect(result).toBe('APPROVED_FINAL');
      });

      it('should return APPROVED_FINAL when current exceeds total', () => {
        const result = calculateApprovalStatus('APPROVE', 4, 3);
        expect(result).toBe('APPROVED_FINAL');
      });

      it('should return REJECTED regardless of step', () => {
        expect(calculateApprovalStatus('REJECT', 1, 3)).toBe('REJECTED');
        expect(calculateApprovalStatus('REJECT', 2, 3)).toBe('REJECTED');
        expect(calculateApprovalStatus('REJECT', 3, 3)).toBe('REJECTED');
      });

      it('should return DRAFT for WITHDRAW regardless of step', () => {
        expect(calculateApprovalStatus('WITHDRAW', 1, 3)).toBe('DRAFT');
        expect(calculateApprovalStatus('WITHDRAW', 2, 3)).toBe('DRAFT');
        expect(calculateApprovalStatus('WITHDRAW', 3, 3)).toBe('DRAFT');
      });

      it('should return DRAFT for unknown action (default case)', () => {
        const result = calculateApprovalStatus('UNKNOWN' as any, 1, 3);
        expect(result).toBe('DRAFT');
      });
    });

    describe('createApprovalSnapshot - structure validation', () => {
      it('should include snapshotTimestamp in snapshot', () => {
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
        const parsed = JSON.parse(snapshot);

        expect(parsed.snapshotTimestamp).toBeTruthy();
        expect(typeof parsed.snapshotTimestamp).toBe('string');
        expect(new Date(parsed.snapshotTimestamp).toString()).not.toBe('Invalid Date');
      });

      it('should preserve all approval line data', () => {
        const approvalLine = {
          steps: [
            {
              stepNumber: 1,
              stepName: '팀장',
              approverName: '김재정',
              approverEmail: 'manager@church.org',
              approverTitle: '팀장',
              isRequired: true,
              isParallel: false,
            },
            {
              stepNumber: 2,
              stepName: '회계',
              approverName: '박회계',
              approverEmail: 'accountant@church.org',
              approverTitle: '회계',
              isRequired: true,
              isParallel: false,
            },
          ],
          totalSteps: 2,
          isUrgent: false,
        };

        const snapshot = createApprovalSnapshot(approvalLine);
        const parsed = JSON.parse(snapshot);

        expect(parsed.steps).toHaveLength(2);
        expect(parsed.totalSteps).toBe(2);
        expect(parsed.isUrgent).toBe(false);
        expect(parsed.steps[0].stepNumber).toBe(1);
        expect(parsed.steps[1].stepNumber).toBe(2);
      });
    });

    describe('updateDepartmentApprovers - mutation', () => {
      it('should overwrite existing department approvers', () => {
        const newApprovers = {
          department: '재정팀',
          teamManager: '신재정',
          teamManagerEmail: 'new.finance@church.org',
          accountant: '신회계',
          accountantEmail: 'new.account@church.org',
          financeManager: '신재무',
          financeManagerEmail: 'new.cfo@church.org',
        };

        updateDepartmentApprovers('재정팀', newApprovers);

        const all = getAllDepartmentApprovers();
        expect(all['재정팀'].teamManager).toBe('신재정');
        expect(all['재정팀'].accountant).toBe('신회계');

        // Restore original for other tests
        updateDepartmentApprovers('재정팀', {
          department: '재정팀',
          teamManager: '김재정',
          teamManagerEmail: 'finance.manager@church.org',
          accountant: '박회계',
          accountantEmail: 'accountant@church.org',
          financeManager: '이재무',
          financeManagerEmail: 'cfo@church.org',
        });
      });
    });

    describe('canModifyApprovalLine - comprehensive scenarios', () => {
      const testCases = [
        { status: 'DRAFT', actor: '홍길동', applicant: '홍길동', expected: true },
        { status: 'PENDING', actor: '홍길동', applicant: '홍길동', expected: false },
        { status: 'APPROVED_STEP_1', actor: '홍길동', applicant: '홍길동', expected: false },
        { status: 'APPROVED_STEP_2', actor: '홍길동', applicant: '홍길동', expected: false },
        { status: 'APPROVED_FINAL', actor: '홍길동', applicant: '홍길동', expected: false },
        { status: 'REJECTED', actor: '홍길동', applicant: '홍길동', expected: false },
        { status: 'DRAFT', actor: '김철수', applicant: '홍길동', expected: false },
      ];

      testCases.forEach(({ status, actor, applicant, expected }) => {
        it(`should ${expected ? 'allow' : 'deny'} modification when status=${status}, actor=${actor}, applicant=${applicant}`, () => {
          const result = canModifyApprovalLine(status, actor, applicant);
          expect(result.allowed).toBe(expected);
        });
      });
    });
  });
});
