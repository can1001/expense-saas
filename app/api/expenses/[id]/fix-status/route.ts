import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/expenses/[id]/fix-status
 * 결재 상태 자동 수정 API
 *
 * 완료된 결재 단계 수에 따라 올바른 상태로 수정합니다:
 * - 0단계 완료: PENDING (1차 팀장 결재 대기)
 * - 1단계 완료: APPROVED_STEP_1 (2차 회계 결재 대기)
 * - 2단계 완료: APPROVED_STEP_2 (3차 재정팀장 결재 대기)
 * - 3단계 완료: APPROVED_FINAL (최종 승인)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // 완료된 단계 수 계산
    const approvedSteps = expense.approvalLine.steps.filter(
      (step) => step.status === 'APPROVED'
    );
    const pendingSteps = expense.approvalLine.steps.filter(
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

    // 상태가 이미 올바른 경우
    if (expense.status === correctStatus) {
      return NextResponse.json({
        success: true,
        message: '상태가 이미 올바릅니다.',
        currentStatus: expense.status,
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
      message: `상태가 ${correctStatus}로 수정되었습니다.`,
      previousStatus: expense.status,
      newStatus: updatedExpense.status,
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
}
