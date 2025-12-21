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
// 위원회별 팀장 매핑
// ========================================

// 위원회별 담당 팀장 설정
// 참고: 실제 1차 결재자는 BudgetMaster의 manager 필드를 참조해야 함
// 아래는 위원회별 기본 팀장 (BudgetMaster manager가 없을 때 사용)
const COMMITTEE_TEAM_LEADERS: Record<string, string> = {
  '예배위원회': '청연김흥래',      // 기본값 (실제: BudgetMaster manager 사용)
  '교육훈련위원회': '청연김흥래',
  '목양위원회': '청연김흥래',      // 기본값 (실제: BudgetMaster manager 사용)
  '기획위원회': '청연김흥래',      // 기본값 (실제: BudgetMaster manager 사용)
  '(가칭)인사위': '청연김흥래',    // 기본값 (실제: BudgetMaster manager 사용)
  '(가칭)행정위': '청연김흥래',    // 기본값 (실제: BudgetMaster manager 사용)
};

// 공통 결재자 설정
const COMMON_APPROVERS = {
  accountant: '청연윤운문',      // 회계 (2차 결재)
  financeManager: '청연신창국',  // 재정팀장 (최종 결재)
};

// ========================================
// 부서별 결재자 매핑 (위원회 기반 동적 생성)
// ========================================

// 현재 등록된 사용자 (lib/users.ts):
// - 청연신창국: 재정팀장 (최종 결재)
// - 청연윤운문: 회계 (2차 결재)
// - 청연김흥래: 팀장 (교육훈련위원회, 1차 결재)
// - 청연정혜종: 사용자
// - 청연송원영: 사용자

/**
 * 위원회에 따른 팀장 결정
 */
function getTeamManagerByCommittee(committee: string): string {
  return COMMITTEE_TEAM_LEADERS[committee] || '청연신창국'; // 기본 팀장
}

const DEPARTMENT_APPROVERS: Record<string, ApproverMapping> = {
  // 기본값 (부서 정보가 없을 때)
  '기본': {
    department: '기본',
    teamManager: '청연신창국',
    accountant: COMMON_APPROVERS.accountant,
    financeManager: COMMON_APPROVERS.financeManager,
  },
};

// ========================================
// 핵심 함수
// ========================================

/**
 * 위원회/부서별 결재자 정보 가져오기
 * @param committee 위원회
 * @param department 부서
 */
function getDepartmentApprovers(committee: string, department: string): ApproverMapping {
  // 위원회에 따른 팀장 결정
  const teamManager = getTeamManagerByCommittee(committee);

  return {
    department,
    teamManager,
    accountant: COMMON_APPROVERS.accountant,
    financeManager: COMMON_APPROVERS.financeManager,
  };
}

/**
 * 결재선 자동 생성 (동적 단계)
 *
 * 기본: 1차 팀장 → 2차 회계 → 3차 재정팀장
 * 작성자가 결재선에 포함된 경우 해당 단계 건너뜀
 *
 * 예시:
 * - 청연윤운문(회계)이 작성 → 1차 팀장 → 2차 재정팀장 (2단계)
 * - 청연신창국(팀장)이 작성 → 1차 회계 → 2차 재정팀장 (2단계)
 * - 청연정혜종(재정팀장)이 작성 → 에러 (담임목사 승인 필요)
 *
 * @param expenseData 지출결의서 데이터
 * @returns 생성된 결재선 정보
 */
export function generateApprovalLine(expenseData: ExpenseData): ApprovalLineInput {
  const { committee, department, applicantName } = expenseData;

  // 위원회/부서 결재자 매핑 가져오기
  const approvers = getDepartmentApprovers(committee, department);

  // 모든 가능한 결재자 목록 생성
  const allApprovers = [
    {
      role: APPROVER_ROLES.TEAM_MANAGER,
      name: approvers.teamManager,
      email: approvers.teamManagerEmail,
      title: '팀장',
    },
    {
      role: APPROVER_ROLES.ACCOUNTANT,
      name: approvers.accountant,
      email: approvers.accountantEmail,
      title: '회계',
    },
    {
      role: APPROVER_ROLES.FINANCE_MANAGER,
      name: approvers.financeManager,
      email: approvers.financeManagerEmail,
      title: '재정팀장',
    },
  ];

  // 작성자가 재정팀장인 경우 특별 처리 (담임목사 승인 필요)
  if (applicantName === approvers.financeManager) {
    throw new Error(
      `재정팀장(${applicantName})이 작성한 지출결의서는 담임목사 승인이 필요합니다. ` +
      `현재 시스템에서는 담임목사 결재선이 설정되지 않았습니다.`
    );
  }

  // 작성자를 제외한 결재자로 결재선 구성
  const filteredApprovers = allApprovers.filter(
    (approver) => approver.name !== applicantName
  );

  // 결재 단계 생성 (번호 재할당)
  const steps: ApprovalStepInput[] = filteredApprovers.map((approver, index) => ({
    stepNumber: index + 1,
    stepName: approver.role,
    approverName: approver.name,
    approverEmail: approver.email,
    approverTitle: approver.title,
    isRequired: true,
    isParallel: false,
  }));

  const totalSteps = steps.length;

  // 최소 1명의 결재자가 있어야 함
  if (totalSteps === 0) {
    throw new Error('결재선을 생성할 수 없습니다. 결재자가 없습니다.');
  }

  return {
    steps,
    totalSteps,
    isUrgent: false,
  };
}

// validateSelfApproval 함수는 더 이상 사용하지 않음
// 대신 generateApprovalLine에서 작성자를 결재선에서 자동 제외함

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
 * 결재 상태 계산 (동적 단계 결재 프로세스)
 *
 * 상태 전이:
 * - DRAFT: 작성중
 * - PENDING: 결재 대기 (1차 결재 대기)
 * - APPROVED_STEP_1: 1차 승인 완료
 * - APPROVED_STEP_2: 2차 승인 완료 (3단계 이상일 때)
 * - APPROVED_FINAL: 최종 승인
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
        return 'APPROVED_FINAL'; // 최종 승인
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
