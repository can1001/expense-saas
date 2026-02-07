/**
 * 결재선 자동 산출 서비스
 *
 * 결재 흐름 규칙:
 * - 담당자 ≠ 재정팀장, 신청자 ≠ 담당자: 담당자 → 회계 → 재정팀장 (3단계)
 * - 담당자 = 재정팀장: 재정팀장(전결) → 회계 → 재정팀장 (3단계, 1차 자동승인)
 * - 신청자 = 담당자 (세목담당자 직접 등록): 팀장(전결) → 회계 → 재정팀장 (3단계, 1차 자동승인)
 */

import { prisma } from '@/lib/prisma';

// 역할 코드 타입 (Role.code와 동일)
type UserRole = 'admin' | 'finance_head' | 'accountant' | 'team_leader' | 'admin_assistant' | 'user';

export interface ApprovalStepInfo {
  stepNumber: number;
  stepName: string;
  role: string;
  approverId: string;
  approverName: string;
  approverEmail?: string | null;
  isAutoApproved: boolean;
}

export interface BudgetInfo {
  budgetAmount: number;   // 배정 예산
  usedAmount: number;     // 사용 금액
  remainingAmount: number; // 잔액
  isOverBudget: boolean;  // 예산 초과 여부 (사용 금액 기준)
}

export interface ApprovalLineInfo {
  budgetDetailId?: string;
  budgetDetailName?: string;
  managerId: string | null;
  managerName: string | null;
  isDirectApproval: boolean; // 담당자가 재정팀장인 경우 true
  isSubmitterManager: boolean; // 신청자가 세목담당자인 경우 true (팀장 전결)
  totalSteps: number;
  steps: ApprovalStepInfo[];
  year: number;
  budget?: BudgetInfo; // 예산 정보
}

/**
 * 연도별 역할 담당자 조회
 */
async function getYearRoleUser(year: number, role: UserRole): Promise<{ id: string; username: string; userid: string } | null> {
  const yearRole = await prisma.userYearRole.findFirst({
    where: {
      year,
      role,
      user: { isActive: true },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          userid: true,
        },
      },
    },
  });

  return yearRole?.user || null;
}

/**
 * 예산 세목 기반 결재선 자동 산출
 *
 * @param budgetDetailId 예산 세목 ID
 * @param year 연도
 * @param submitterId 신청자 ID (선택, 세목담당자 전결 판단용)
 * @returns 결재선 정보
 */
export async function calculateApprovalLine(
  budgetDetailId: string,
  year: number,
  submitterId?: string
): Promise<ApprovalLineInfo> {
  // 1. 세목의 연도별 담당자 조회
  const budgetDetailYear = await prisma.budgetDetailYear.findUnique({
    where: {
      budgetDetailId_year: { budgetDetailId, year },
    },
    include: {
      manager: {
        select: {
          id: true,
          username: true,
          userid: true,
        },
      },
      budgetDetail: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // 예산 정보 계산
  const budgetAmount = budgetDetailYear?.budgetAmount || 0;
  const usedAmount = budgetDetailYear?.usedAmount || 0;
  const remainingAmount = budgetAmount - usedAmount;
  const budgetInfo: BudgetInfo = {
    budgetAmount,
    usedAmount,
    remainingAmount,
    isOverBudget: usedAmount > budgetAmount,
  };

  // 2. 연도별 역할 담당자 조회 (재정팀장, 회계, 팀장)
  const [financeHead, accountant, teamLeader] = await Promise.all([
    getYearRoleUser(year, 'finance_head'),
    getYearRoleUser(year, 'accountant'),
    getYearRoleUser(year, 'team_leader'),
  ]);

  if (!financeHead) {
    throw new Error(`${year}년 재정팀장이 설정되지 않았습니다.`);
  }

  if (!accountant) {
    throw new Error(`${year}년 회계가 설정되지 않았습니다.`);
  }

  const manager = budgetDetailYear?.manager;
  const isDirectApproval = manager?.id === financeHead.id;
  // 신청자가 세목담당자인 경우 (팀장 전결)
  const isSubmitterManager = submitterId && manager && submitterId === manager.id;

  const steps: ApprovalStepInfo[] = [];

  if (isDirectApproval) {
    // 담당자가 재정팀장인 경우 → 3단계 (1차 자동승인)
    steps.push({
      stepNumber: 1,
      stepName: '재정팀장(전결)',
      role: 'finance_head',
      approverId: financeHead.id,
      approverName: financeHead.username,
      isAutoApproved: true, // 제출 시 자동 승인
    });
    steps.push({
      stepNumber: 2,
      stepName: '회계',
      role: 'accountant',
      approverId: accountant.id,
      approverName: accountant.username,
      isAutoApproved: false,
    });
    steps.push({
      stepNumber: 3,
      stepName: '재정팀장',
      role: 'finance_head',
      approverId: financeHead.id,
      approverName: financeHead.username,
      isAutoApproved: false,
    });
  } else if (isSubmitterManager && teamLeader) {
    // 신청자가 세목담당자인 경우 → 3단계 (팀장 1차 자동승인)
    steps.push({
      stepNumber: 1,
      stepName: '팀장(전결)',
      role: 'team_leader',
      approverId: teamLeader.id,
      approverName: teamLeader.username,
      isAutoApproved: true, // 제출 시 자동 승인
    });
    steps.push({
      stepNumber: 2,
      stepName: '회계',
      role: 'accountant',
      approverId: accountant.id,
      approverName: accountant.username,
      isAutoApproved: false,
    });
    steps.push({
      stepNumber: 3,
      stepName: '재정팀장',
      role: 'finance_head',
      approverId: financeHead.id,
      approverName: financeHead.username,
      isAutoApproved: false,
    });
  } else {
    // 일반 결재 → 3단계
    if (manager) {
      steps.push({
        stepNumber: 1,
        stepName: '담당자',
        role: 'manager',
        approverId: manager.id,
        approverName: manager.username,
        isAutoApproved: false,
      });
    } else {
      // 담당자가 없는 경우 - 기본값으로 재정팀장이 1차
      steps.push({
        stepNumber: 1,
        stepName: '담당자(미지정)',
        role: 'manager',
        approverId: financeHead.id,
        approverName: financeHead.username,
        isAutoApproved: false,
      });
    }
    steps.push({
      stepNumber: 2,
      stepName: '회계',
      role: 'accountant',
      approverId: accountant.id,
      approverName: accountant.username,
      isAutoApproved: false,
    });
    steps.push({
      stepNumber: 3,
      stepName: '재정팀장',
      role: 'finance_head',
      approverId: financeHead.id,
      approverName: financeHead.username,
      isAutoApproved: false,
    });
  }

  return {
    budgetDetailId,
    budgetDetailName: budgetDetailYear?.budgetDetail?.name,
    managerId: manager?.id || null,
    managerName: manager?.username || null,
    isDirectApproval,
    isSubmitterManager: !!isSubmitterManager,
    totalSteps: steps.length,
    steps,
    year,
    budget: budgetInfo,
  };
}

/**
 * 지출결의서용 결재선 생성 (ExpenseItem의 첫 번째 세목 기준)
 *
 * @param budgetCategory 예산 항
 * @param budgetSubcategory 예산 목
 * @param budgetDetailName 예산 세목
 * @param year 연도
 * @param submitterId 신청자 ID (선택, 세목담당자 전결 판단용)
 * @returns 결재선 정보
 */
export async function calculateApprovalLineForExpense(
  budgetCategory: string,
  budgetSubcategory: string,
  budgetDetailName: string,
  year: number,
  submitterId?: string
): Promise<ApprovalLineInfo> {
  // 세목 이름으로 BudgetDetail 찾기
  const budgetDetail = await prisma.budgetDetail.findFirst({
    where: {
      name: budgetDetailName,
      subcategory: {
        name: budgetSubcategory,
        category: {
          name: budgetCategory,
        },
      },
    },
  });

  if (!budgetDetail) {
    // 세목을 찾을 수 없는 경우 기본 결재선 반환
    const [financeHead, accountant] = await Promise.all([
      getYearRoleUser(year, 'finance_head'),
      getYearRoleUser(year, 'accountant'),
    ]);

    if (!financeHead) {
      throw new Error(`${year}년 재정팀장이 설정되지 않았습니다.`);
    }

    if (!accountant) {
      throw new Error(`${year}년 회계가 설정되지 않았습니다.`);
    }

    return {
      managerId: null,
      managerName: null,
      isDirectApproval: false,
      isSubmitterManager: false,
      totalSteps: 3,
      steps: [
        {
          stepNumber: 1,
          stepName: '담당자(미지정)',
          role: 'manager',
          approverId: financeHead.id,
          approverName: financeHead.username,
          isAutoApproved: false,
        },
        {
          stepNumber: 2,
          stepName: '회계',
          role: 'accountant',
          approverId: accountant.id,
          approverName: accountant.username,
          isAutoApproved: false,
        },
        {
          stepNumber: 3,
          stepName: '재정팀장',
          role: 'finance_head',
          approverId: financeHead.id,
          approverName: financeHead.username,
          isAutoApproved: false,
        },
      ],
      year,
    };
  }

  return calculateApprovalLine(budgetDetail.id, year, submitterId);
}

/**
 * 결재선을 ApprovalLine 및 ApprovalStep으로 저장
 *
 * @param expenseId 지출결의서 ID
 * @param approvalLineInfo 결재선 정보
 * @returns 생성된 ApprovalLine
 */
export async function createApprovalLineForExpense(
  expenseId: string,
  approvalLineInfo: ApprovalLineInfo
) {
  // 기존 결재선이 있으면 삭제
  await prisma.approvalLine.deleteMany({
    where: { expenseId },
  });

  // 새 결재선 생성
  // 전결(재정팀장 or 세목담당자)인 경우 2단계부터 시작
  const isAutoApprovedFirst = approvalLineInfo.isDirectApproval || approvalLineInfo.isSubmitterManager;
  const approvalLine = await prisma.approvalLine.create({
    data: {
      expenseId,
      currentStep: isAutoApprovedFirst ? 2 : 1, // 전결인 경우 2단계부터 시작
      totalSteps: approvalLineInfo.totalSteps,
      isUrgent: false,
      snapshot: JSON.stringify(approvalLineInfo),
      steps: {
        create: approvalLineInfo.steps.map((step) => ({
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          approverName: step.approverName,
          status: step.isAutoApproved ? 'APPROVED' : 'PENDING',
          approvedAt: step.isAutoApproved ? new Date() : null,
          isRequired: true,
          isParallel: false,
        })),
      },
    },
    include: {
      steps: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  return approvalLine;
}

/**
 * 지출결의서 제출 시 결재선 자동 생성 및 상태 업데이트
 *
 * @param expenseId 지출결의서 ID
 * @returns 생성된 결재선
 */
export async function submitExpenseWithApprovalLine(expenseId: string) {
  // 지출결의서 조회
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      items: true,
    },
  });

  if (!expense) {
    throw new Error('지출결의서를 찾을 수 없습니다.');
  }

  // 연도 추출 (청구일자 기준)
  const year = expense.requestDate.getFullYear();

  // 첫 번째 항목의 예산 세목 기준으로 결재선 산출
  const firstItem = expense.items[0];
  if (!firstItem) {
    throw new Error('지출결의서 항목이 없습니다.');
  }

  // 결재선 산출 (항/목/세목 모두 첫 번째 항목에서 가져옴)
  // 신청자 ID(userId)를 전달하여 세목담당자 전결 여부 판단
  const approvalLineInfo = await calculateApprovalLineForExpense(
    firstItem.budgetCategory,
    firstItem.budgetSubcategory,
    firstItem.budgetDetail,
    year,
    expense.userId // 신청자 ID
  );

  // 결재선 생성
  const approvalLine = await createApprovalLineForExpense(expenseId, approvalLineInfo);

  // 지출결의서 상태 업데이트
  // 전결인 경우(재정팀장 or 세목담당자) 1차 자동 승인
  const isAutoApprovedFirst = approvalLineInfo.isDirectApproval || approvalLineInfo.isSubmitterManager;
  const newStatus = isAutoApprovedFirst ? 'APPROVED_STEP_1' : 'PENDING';

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: newStatus,
      submittedAt: new Date(),
    },
  });

  // 감사 로그 기록
  let submitComment = '제출 완료';
  if (approvalLineInfo.isDirectApproval) {
    submitComment = '제출 완료 (재정팀장 전결 - 1차 자동승인)';
  } else if (approvalLineInfo.isSubmitterManager) {
    submitComment = '제출 완료 (세목담당자 등록 - 팀장 전결 1차 자동승인)';
  }

  await prisma.approvalLog.create({
    data: {
      expenseId,
      action: 'SUBMIT',
      actorName: expense.applicantName,
      previousStatus: 'DRAFT',
      newStatus,
      comment: submitComment,
      afterSnapshot: JSON.stringify(approvalLineInfo),
    },
  });

  return {
    approvalLine,
    approvalLineInfo,
    newStatus,
  };
}
