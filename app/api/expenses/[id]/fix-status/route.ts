import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, UserApiHandler } from '@/lib/auth/user';

/**
 * POST /api/expenses/[id]/fix-status
 * 결재 상태 자동 수정 API (관리자 전용)
 *
 * 완료된 결재 단계 수에 따라 올바른 상태로 수정합니다:
 * - 0단계 완료: PENDING (1차 팀장 결재 대기)
 * - 1단계 완료: APPROVED_STEP_1 (2차 회계 결재 대기)
 * - 2단계 완료: APPROVED_STEP_2 (3차 재정팀장 결재 대기)
 * - 3단계 완료: APPROVED_FINAL (최종 승인)
 */
const handlePost: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;

    // 지출결의서 및 결재선 조회
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        approvalLine: {
          include: {
            steps: {
              orderBy: { stepNumber: 'asc' },
            },
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json(
        { error: '지출결의서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!expense.approvalLine) {
      return NextResponse.json(
        { error: '결재선이 없습니다.' },
        { status: 400 }
      );
    }

    // 스냅샷에서 전결 정보 파싱
    let snapshotData: any = null;
    try {
      snapshotData = JSON.parse(expense.approvalLine.snapshot as string);
    } catch {
      // 스냅샷 파싱 실패 시 무시
    }

    // 연속된 전결 단계만 찾기 (1차부터 연속으로)
    const consecutiveAutoApprovedStepNumbers = new Set<number>();
    if (snapshotData?.steps) {
      for (const step of snapshotData.steps) {
        if (step.isAutoApproved) {
          consecutiveAutoApprovedStepNumbers.add(step.stepNumber);
        } else {
          break; // 연속되지 않으면 중단
        }
      }
    }

    // 잘못된 승인 상태 수정이 필요한 단계 찾기
    // 연속된 전결이 아닌데 APPROVED인 단계를 PENDING으로 변경
    const stepsToFix: string[] = [];
    for (const step of expense.approvalLine.steps) {
      const isConsecutiveAutoApproved = consecutiveAutoApprovedStepNumbers.has(step.stepNumber);
      if (!isConsecutiveAutoApproved && step.status === 'APPROVED') {
        // 이 단계는 연속된 전결이 아닌데 승인됨 - 수정 필요
        stepsToFix.push(step.id);
      }
    }

    // 잘못된 단계 수정
    if (stepsToFix.length > 0) {
      await prisma.approvalStep.updateMany({
        where: { id: { in: stepsToFix } },
        data: {
          status: 'PENDING',
          approvedAt: null,
          comment: null,
        },
      });
    }

    // 수정 후 다시 조회
    const refreshedExpense = await prisma.expense.findUnique({
      where: { id },
      include: {
        approvalLine: {
          include: {
            steps: { orderBy: { stepNumber: 'asc' } },
          },
        },
      },
    });

    if (!refreshedExpense?.approvalLine) {
      return NextResponse.json(
        { error: '수정 후 조회 실패' },
        { status: 500 }
      );
    }

    // 완료된 단계 수 다시 계산
    const approvedSteps = refreshedExpense.approvalLine.steps.filter(
      (step) => step.status === 'APPROVED'
    );
    const pendingSteps = refreshedExpense.approvalLine.steps.filter(
      (step) => step.status === 'PENDING'
    );

    // 올바른 상태 결정
    let correctStatus: 'PENDING' | 'APPROVED_STEP_1' | 'APPROVED_STEP_2' | 'APPROVED_FINAL';

    if (pendingSteps.length === 0) {
      correctStatus = 'APPROVED_FINAL';
    } else if (approvedSteps.length === 0) {
      correctStatus = 'PENDING';
    } else if (approvedSteps.length === 1) {
      correctStatus = 'APPROVED_STEP_1';
    } else if (approvedSteps.length === 2) {
      correctStatus = 'APPROVED_STEP_2';
    } else {
      correctStatus = 'APPROVED_FINAL';
    }

    // 올바른 currentStep 계산 (첫 번째 PENDING 단계)
    const firstPendingStep = refreshedExpense.approvalLine.steps.find(
      (step) => step.status === 'PENDING'
    );
    const correctCurrentStep = firstPendingStep
      ? firstPendingStep.stepNumber
      : refreshedExpense.approvalLine.totalSteps;

    // 결재선 currentStep 수정
    if (refreshedExpense.approvalLine.currentStep !== correctCurrentStep) {
      await prisma.approvalLine.update({
        where: { id: refreshedExpense.approvalLine.id },
        data: { currentStep: correctCurrentStep },
      });
    }

    // 상태가 이미 올바른 경우
    if (refreshedExpense.status === correctStatus && stepsToFix.length === 0) {
      return NextResponse.json({
        success: true,
        message: '상태가 이미 올바릅니다.',
        currentStatus: refreshedExpense.status,
        approvedStepsCount: approvedSteps.length,
        pendingStepsCount: pendingSteps.length,
      });
    }

    // 상태 수정
    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        status: correctStatus,
        approvedAt: correctStatus === 'APPROVED_FINAL' ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: stepsToFix.length > 0
        ? `${stepsToFix.length}개 단계가 수정되었고 상태가 ${correctStatus}로 변경되었습니다.`
        : `상태가 ${correctStatus}로 수정되었습니다.`,
      previousStatus: expense.status,
      newStatus: updatedExpense.status,
      fixedSteps: stepsToFix.length,
      correctCurrentStep,
      approvedStepsCount: approvedSteps.length,
      pendingSteps: pendingSteps.map((s) => ({
        stepNumber: s.stepNumber,
        stepName: s.stepName,
        approverName: s.approverName,
      })),
    });
  } catch (error: any) {
    console.error('Fix status error:', error);
    return NextResponse.json(
      { error: '상태 수정 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
};

export const POST = withAdmin(handlePost);
