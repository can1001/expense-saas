/**
 * 결재선 자동 생성 엔진
 *
 * 고정 3단계 결재 프로세스:
 * - 1차: 팀장 승인
 * - 2차: 회계 승인
 * - 3차: 재정팀장 승인 (최종)
 *
 * 상태 전이:
 * DRAFT → PENDING → APPROVED_STEP_1 → APPROVED_STEP_2 → APPROVED_FINAL
 *                 ↘ REJECTED (반려 시 재제출 가능)
 */

// ========================================
// 타입 정의
// ========================================

export interface ApprovalStepInput {
  stepNumber: number;
  stepName: string;
  approverName: string;
  approverEmail?: string;
  approverTitle?: string;
  isRequired: boolean;
  isParallel?: boolean;
}

export interface ApprovalLineInput {
  steps: ApprovalStepInput[];
  totalSteps: number;
  isUrgent?: boolean;
}

export interface ExpenseData {
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  requestAmount: number;
  applicantName: string;
}

export interface ApproverMapping {
  department: string;
  teamManager: string;        // 팀장 (1차)
  teamManagerEmail?: string;
  accountant: string;          // 회계 (2차)
  accountantEmail?: string;
  financeManager: string;      // 재정팀장 (3차/최종)
  financeManagerEmail?: string;
}

// ========================================
// 상수 정의
// ========================================

// 고정 결재 단계 수
const FIXED_APPROVAL_STEPS = 3;

// 결재자 역할명
const APPROVER_ROLES = {
  TEAM_MANAGER: '팀장',
  ACCOUNTANT: '회계',
  FINANCE_MANAGER: '재정팀장',
} as const;

// ========================================
// 부서별 결재자 매핑 (실제로는 DB에서 가져와야 함)
// ========================================

// TODO: 실제 구현 시 DB 테이블로 관리하거나 환경변수로 설정
const DEPARTMENT_APPROVERS: Record<string, ApproverMapping> = {
  '재정팀': {
    department: '재정팀',
    teamManager: '김재정',
    teamManagerEmail: 'finance.manager@church.org',
    accountant: '박회계',
    accountantEmail: 'accountant@church.org',
    financeManager: '이재무',
    financeManagerEmail: 'cfo@church.org',
  },
  '교육팀': {
    department: '교육팀',
    teamManager: '최교육',
    teamManagerEmail: 'education.manager@church.org',
    accountant: '박회계',
    accountantEmail: 'accountant@church.org',
    financeManager: '이재무',
    financeManagerEmail: 'cfo@church.org',
  },
  '선교팀': {
    department: '선교팀',
    teamManager: '강선교',
    teamManagerEmail: 'mission.manager@church.org',
    accountant: '박회계',
    accountantEmail: 'accountant@church.org',
    financeManager: '이재무',
    financeManagerEmail: 'cfo@church.org',
  },
  // 기본값 (부서 정보가 없을 때)
  '기본': {
    department: '기본',
    teamManager: '팀장',
    accountant: '박회계',
    accountantEmail: 'accountant@church.org',
    financeManager: '이재무',
    financeManagerEmail: 'cfo@church.org',
  },
};

// ========================================
// 핵심 함수
// ========================================

/**
 * 부서별 결재자 정보 가져오기
 */
function getDepartmentApprovers(department: string): ApproverMapping {
  return DEPARTMENT_APPROVERS[department] || DEPARTMENT_APPROVERS['기본'];
}

/**
 * 결재선 자동 생성 (고정 3단계)
 *
 * 1차: 팀장 → 2차: 회계 → 3차: 재정팀장
 *
 * @param expenseData 지출결의서 데이터
 * @returns 생성된 결재선 정보
 */
export function generateApprovalLine(expenseData: ExpenseData): ApprovalLineInput {
  const { department, applicantName } = expenseData;

  // 부서 결재자 매핑 가져오기
  const approvers = getDepartmentApprovers(department);

  // 고정 3단계 결재
  const totalSteps = FIXED_APPROVAL_STEPS;

  // 결재 단계 생성
  const steps: ApprovalStepInput[] = [];

  // 1차 결재: 팀장
  steps.push({
    stepNumber: 1,
    stepName: APPROVER_ROLES.TEAM_MANAGER,
    approverName: approvers.teamManager,
    approverEmail: approvers.teamManagerEmail,
    approverTitle: '팀장',
    isRequired: true,
    isParallel: false,
  });

  // 2차 결재: 회계
  steps.push({
    stepNumber: 2,
    stepName: APPROVER_ROLES.ACCOUNTANT,
    approverName: approvers.accountant,
    approverEmail: approvers.accountantEmail,
    approverTitle: '회계',
    isRequired: true,
    isParallel: false,
  });

  // 3차 결재: 재정팀장 (최종)
  steps.push({
    stepNumber: 3,
    stepName: APPROVER_ROLES.FINANCE_MANAGER,
    approverName: approvers.financeManager,
    approverEmail: approvers.financeManagerEmail,
    approverTitle: '재정팀장',
    isRequired: true,
    isParallel: false,
  });

  // 자기결재 방지 검증
  validateSelfApproval(applicantName, steps);

  return {
    steps,
    totalSteps,
    isUrgent: false, // 긴급 플래그는 별도 지정
  };
}

/**
 * 자기결재 방지 검증
 * 작성자가 결재선에 포함되어 있으면 에러
 */
function validateSelfApproval(
  applicantName: string,
  steps: ApprovalStepInput[]
): void {
  const isSelfApproval = steps.some(
    (step) => step.approverName === applicantName
  );

  if (isSelfApproval) {
    throw new Error(
      `자기결재 불가: 작성자(${applicantName})가 결재선에 포함되어 있습니다. ` +
      `재정팀장이 작성한 경우 담임목사 승인이 필요합니다.`
    );
  }
}

/**
 * 결재선 수정 가능 여부 검증
 *
 * @param currentStatus 현재 지출결의서 상태
 * @param actorName 수정 시도자 이름
 * @param applicantName 작성자 이름
 */
export function canModifyApprovalLine(
  currentStatus: string,
  actorName: string,
  applicantName: string
): { allowed: boolean; reason?: string } {
  // 제출 후에는 수정 불가
  if (currentStatus !== 'DRAFT') {
    return {
      allowed: false,
      reason: '제출 후에는 결재선을 수정할 수 없습니다. 반려 후 재제출하세요.',
    };
  }

  // 작성자만 수정 가능
  if (actorName !== applicantName) {
    return {
      allowed: false,
      reason: '작성자만 결재선을 수정할 수 있습니다.',
    };
  }

  return { allowed: true };
}

/**
 * 결재 가능 여부 검증
 *
 * @param approverName 결재자 이름
 * @param currentStep 현재 결재 단계
 * @param stepNumber 시도하는 결재 단계
 */
export function canApprove(
  approverName: string,
  expectedApproverName: string,
  currentStep: number,
  stepNumber: number
): { allowed: boolean; reason?: string } {
  // 본인 차례인지 확인
  if (currentStep !== stepNumber) {
    return {
      allowed: false,
      reason: `현재 ${currentStep}차 결재 대기 중입니다. ${stepNumber}차 결재는 아직 불가능합니다.`,
    };
  }

  // 지정된 결재자인지 확인
  if (approverName !== expectedApproverName) {
    return {
      allowed: false,
      reason: `${stepNumber}차 결재자(${expectedApproverName})만 승인할 수 있습니다.`,
    };
  }

  return { allowed: true };
}

/**
 * 결재선 스냅샷 생성
 * 제출 시점에 결재선을 JSON으로 고정
 */
export function createApprovalSnapshot(approvalLine: ApprovalLineInput): string {
  return JSON.stringify({
    ...approvalLine,
    snapshotTimestamp: new Date().toISOString(),
  });
}

/**
 * 다음 결재 단계 계산
 */
export function calculateNextStep(
  currentStep: number,
  totalSteps: number,
  action: 'APPROVE' | 'REJECT'
): { nextStep: number; isComplete: boolean } {
  if (action === 'REJECT') {
    // 반려되면 결재 중단
    return { nextStep: currentStep, isComplete: false };
  }

  // 승인인 경우
  const nextStep = currentStep + 1;

  if (nextStep > totalSteps) {
    // 모든 결재 완료
    return { nextStep: totalSteps, isComplete: true };
  }

  return { nextStep, isComplete: false };
}

/**
 * 결재 상태 계산 (3단계 결재 프로세스)
 *
 * 상태 전이:
 * - DRAFT: 작성중
 * - PENDING: 결재 대기 (1차 팀장 결재 대기)
 * - APPROVED_STEP_1: 1차 승인 완료 (2차 회계 결재 대기)
 * - APPROVED_STEP_2: 2차 승인 완료 (3차 재정팀장 결재 대기)
 * - APPROVED_FINAL: 최종 승인 (3차 재정팀장 승인 완료)
 * - REJECTED: 반려
 * - WITHDRAWN: 회수
 *
 * @param action 결재 액션
 * @param completedStep 완료된 결재 단계 번호 (승인 시)
 * @param totalSteps 총 결재 단계 수
 */
export function calculateApprovalStatus(
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'WITHDRAW',
  completedStep: number,
  totalSteps: number
): string {
  switch (action) {
    case 'SUBMIT':
      return 'PENDING';
    case 'APPROVE':
      // 완료된 단계에 따라 상태 결정
      if (completedStep >= totalSteps) {
        return 'APPROVED_FINAL'; // 최종 승인 (3차 완료)
      } else if (completedStep === 2) {
        return 'APPROVED_STEP_2'; // 2차 승인 완료
      } else if (completedStep === 1) {
        return 'APPROVED_STEP_1'; // 1차 승인 완료
      }
      return 'PENDING';
    case 'REJECT':
      return 'REJECTED';
    case 'WITHDRAW':
      return 'DRAFT';
    default:
      return 'DRAFT';
  }
}

// ========================================
// 헬퍼 함수
// ========================================

/**
 * 부서별 결재자 정보 업데이트
 * (실제로는 DB에서 관리해야 하지만, MVP용 메모리 업데이트)
 */
export function updateDepartmentApprovers(
  department: string,
  approvers: ApproverMapping
): void {
  DEPARTMENT_APPROVERS[department] = approvers;
}

/**
 * 모든 부서 결재자 목록 가져오기
 */
export function getAllDepartmentApprovers(): Record<string, ApproverMapping> {
  return { ...DEPARTMENT_APPROVERS };
}
