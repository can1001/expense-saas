import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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

    // 결재 가능한 상태인지 확인
    if (expense.status !== 'PENDING' && expense.status !== 'IN_PROGRESS') {
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

    // 다음 단계 계산
    const { nextStep, isComplete } = calculateNextStep(
      currentStep,
      approvalLine.totalSteps,
      'APPROVE'
    );

    // 새로운 상태 계산
    const newStatus = calculateApprovalStatus(
      'APPROVE',
      nextStep,
      approvalLine.totalSteps
    );

    // 트랜잭션으로 승인 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. 현재 결재 단계 업데이트
      await tx.approvalStep.update({
        where: { id: currentStepData.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          comment,
        },
      });

      // 2. 결재선 진행 상태 업데이트
      await tx.approvalLine.update({
        where: { id: approvalLine.id },
        data: {
          currentStep: nextStep,
        },
      });

      // 3. 지출결의서 상태 업데이트
      const updateData: any = {
        status: newStatus,
      };

      // 최종 승인인 경우 승인 일시 기록
      if (isComplete) {
        updateData.approvedAt = new Date();
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

      // 4. 감사 로그 생성
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
          newStatus,
          comment: comment || `${currentStep}차 결재 승인`,
          metadata: {
            userAgent: request.headers.get('user-agent') || '',
            timestamp: new Date().toISOString(),
            isComplete,
          },
        },
      });

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
