import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  canApprove,
  calculateNextStep,
  calculateApprovalStatus,
} from '@/lib/approval-engine';

/**
 * POST /api/expenses/[id]/approve
 * 지출결의서 승인
 *
 * Body: {
 *   approverName: string,
 *   comment?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { approverName, comment } = body;

    if (!approverName) {
      return NextResponse.json(
        { error: '결재자 이름이 필요합니다.' },
        { status: 400 }
      );
    }

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
        { error: '결재선이 생성되지 않았습니다. 먼저 제출해주세요.' },
        { status: 400 }
      );
    }

    // 결재 가능한 상태인지 확인 (PENDING, APPROVED_STEP_1, APPROVED_STEP_2)
    const approvableStatuses = ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'];
    if (!approvableStatuses.includes(expense.status)) {
      return NextResponse.json(
        { error: `승인할 수 없는 상태입니다. (현재: ${expense.status})` },
        { status: 400 }
      );
    }

    const approvalLine = expense.approvalLine;
    const currentStep = approvalLine.currentStep;

    // 현재 결재 단계 찾기
    const currentStepData = approvalLine.steps.find(
      (s) => s.stepNumber === currentStep
    );

    if (!currentStepData) {
      return NextResponse.json(
        { error: '현재 결재 단계를 찾을 수 없습니다.' },
        { status: 500 }
      );
    }

    // 이미 처리된 경우
    if (currentStepData.status !== 'PENDING') {
      return NextResponse.json(
        { error: `이미 처리된 결재 단계입니다. (상태: ${currentStepData.status})` },
        { status: 400 }
      );
    }

    // 결재 권한 검증
    const validation = canApprove(
      approverName,
      currentStepData.approverName,
      currentStep,
      currentStepData.stepNumber
    );

    if (!validation.allowed) {
      return NextResponse.json({ error: validation.reason }, { status: 403 });
    }

    // 스냅샷에서 전결 정보 파싱
    let snapshotData: any = null;
    try {
      snapshotData = JSON.parse(approvalLine.snapshot as string);
    } catch {
      // 스냅샷 파싱 실패 시 무시
    }

    // 다음 단계부터 연속된 전결 단계 찾기
    const autoApproveSteps: typeof approvalLine.steps = [];
    if (snapshotData?.steps) {
      for (let i = currentStep; i < approvalLine.totalSteps; i++) {
        const nextStepSnapshot = snapshotData.steps.find(
          (s: any) => s.stepNumber === i + 1
        );
        if (nextStepSnapshot?.isAutoApproved) {
          const stepData = approvalLine.steps.find((s) => s.stepNumber === i + 1);
          if (stepData && stepData.status === 'PENDING') {
            autoApproveSteps.push(stepData);
          }
        } else {
          break; // 전결이 아닌 단계를 만나면 중단
        }
      }
    }

    // 최종 단계 계산 (현재 단계 + 연속 전결 단계)
    const finalApprovedStep = currentStep + autoApproveSteps.length;
    const isComplete = finalApprovedStep >= approvalLine.totalSteps;
    const nextStep = isComplete ? approvalLine.totalSteps : finalApprovedStep + 1;

    // 새로운 상태 계산
    const newStatus = calculateApprovalStatus(
      'APPROVE',
      finalApprovedStep,
      approvalLine.totalSteps
    );

    // 트랜잭션으로 승인 처리
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. 현재 결재 단계 업데이트
      await tx.approvalStep.update({
        where: { id: currentStepData.id },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          comment,
        },
      });

      // 2. 연속된 전결 단계들 자동 승인
      for (const autoStep of autoApproveSteps) {
        const stepSnapshot = snapshotData?.steps?.find(
          (s: any) => s.stepNumber === autoStep.stepNumber
        );
        await tx.approvalStep.update({
          where: { id: autoStep.id },
          data: {
            status: 'APPROVED',
            approvedAt: now,
            comment: stepSnapshot?.autoApprovalReason || '전결 처리',
          },
        });
      }

      // 3. 결재선 진행 상태 업데이트
      await tx.approvalLine.update({
        where: { id: approvalLine.id },
        data: {
          currentStep: nextStep,
        },
      });

      // 4. 지출결의서 상태 업데이트
      const updateData: any = {
        status: newStatus,
      };

      // 최종 승인인 경우 승인 일시 기록
      if (isComplete) {
        updateData.approvedAt = now;
      }

      const updatedExpense = await tx.expense.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
          approvalLine: {
            include: {
              steps: {
                orderBy: { stepNumber: 'asc' },
              },
            },
          },
        },
      });

      // 5. 감사 로그 생성 - 현재 단계
      await tx.approvalLog.create({
        data: {
          expenseId: id,
          action: 'APPROVE',
          actorName: approverName,
          actorEmail: currentStepData.approverEmail,
          actorRole: currentStepData.stepName,
          stepNumber: currentStep,
          stepName: currentStepData.stepName,
          previousStatus: expense.status,
          newStatus: autoApproveSteps.length > 0
            ? calculateApprovalStatus('APPROVE', currentStep, approvalLine.totalSteps)
            : newStatus,
          comment: comment || `${currentStep}차 결재 승인`,
          metadata: {
            userAgent: request.headers.get('user-agent') || '',
            timestamp: now.toISOString(),
            isComplete: autoApproveSteps.length === 0 && isComplete,
          },
        },
      });

      // 6. 연속된 전결 단계들 감사 로그 생성
      for (let i = 0; i < autoApproveSteps.length; i++) {
        const autoStep = autoApproveSteps[i];
        const stepSnapshot = snapshotData?.steps?.find(
          (s: any) => s.stepNumber === autoStep.stepNumber
        );
        const isLastStep = i === autoApproveSteps.length - 1;
        await tx.approvalLog.create({
          data: {
            expenseId: id,
            action: 'APPROVE',
            actorName: autoStep.approverName,
            actorRole: autoStep.stepName,
            stepNumber: autoStep.stepNumber,
            stepName: autoStep.stepName,
            previousStatus: `APPROVED_STEP_${autoStep.stepNumber - 1}`,
            newStatus: isLastStep
              ? newStatus
              : `APPROVED_STEP_${autoStep.stepNumber}`,
            comment: stepSnapshot?.autoApprovalReason || '전결 처리',
            metadata: {
              autoApproved: true,
              timestamp: now.toISOString(),
              isComplete: isLastStep && isComplete,
            },
          },
        });
      }

      return updatedExpense;
    });

    return NextResponse.json({
      success: true,
      message: isComplete
        ? '최종 승인이 완료되었습니다.'
        : `${currentStep}차 결재가 승인되었습니다.`,
      data: result,
      isComplete,
    });
  } catch (error: any) {
    console.error('Approve error:', error);
    return NextResponse.json(
      { error: '승인 처리 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
