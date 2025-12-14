import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canApprove } from '@/lib/approval-engine';

/**
 * POST /api/expenses/[id]/reject
 * 지출결의서 반려
 *
 * Body: {
 *   approverName: string,
 *   comment: string (반려 사유 필수)
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

    if (!comment || comment.trim() === '') {
      return NextResponse.json(
        { error: '반려 사유를 입력해주세요.' },
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
        { error: '결재선이 생성되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 반려 가능한 상태인지 확인
    if (expense.status !== 'PENDING' && expense.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: `반려할 수 없는 상태입니다. (현재: ${expense.status})` },
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

    // 트랜잭션으로 반려 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. 현재 결재 단계 업데이트
      await tx.approvalStep.update({
        where: { id: currentStepData.id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          comment,
        },
      });

      // 2. 지출결의서 상태 업데이트
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
        },
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

      // 3. 감사 로그 생성
      await tx.approvalLog.create({
        data: {
          expenseId: id,
          action: 'REJECT',
          actorName: approverName,
          actorEmail: currentStepData.approverEmail,
          actorRole: currentStepData.stepName,
          stepNumber: currentStep,
          stepName: currentStepData.stepName,
          previousStatus: expense.status,
          newStatus: 'REJECTED',
          comment,
          metadata: {
            userAgent: request.headers.get('user-agent') || '',
            timestamp: new Date().toISOString(),
          },
        },
      });

      return updatedExpense;
    });

    return NextResponse.json({
      success: true,
      message: '지출결의서가 반려되었습니다.',
      data: result,
    });
  } catch (error: any) {
    console.error('Reject error:', error);
    return NextResponse.json(
      { error: '반려 처리 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
