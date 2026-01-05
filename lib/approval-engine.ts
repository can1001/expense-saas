/**
 * 결재 헬퍼 함수 모음
 *
 * 결재 흐름 검증 및 상태 계산용 유틸리티 함수들
 *
 * 참고: 결재선 자동 생성은 lib/services/approval-line-service.ts 사용
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
  isAutoApproved?: boolean;
  autoApprovalReason?: string;
}

export interface ApprovalLineInput {
  steps: ApprovalStepInput[];
  totalSteps: number;
  isUrgent?: boolean;
}

// ========================================
// 검증 함수
// ========================================

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
 * @param expectedApproverName 예상 결재자 이름
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

// ========================================
// 스냅샷 및 상태 계산
// ========================================

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
