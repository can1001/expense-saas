import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/expenses/[id]/fix-status
 * 잘못된 결재 상태 수정 (임시 API)
 *
 * 상태가 APPROVED인데 아직 처리하지 않은 결재 단계가 있는 경우
 * IN_PROGRESS로 상태를 되돌립니다.
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

    // 아직 처리하지 않은 단계가 있는지 확인
    const pendingSteps = expense.approvalLine.steps.filter(
      (step) => step.status === 'PENDING'
    );

    if (pendingSteps.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 결재가 완료된 상태입니다. 수정이 필요하지 않습니다.',
        currentStatus: expense.status,
      });
    }

    // APPROVED 상태인데 PENDING 단계가 있는 경우 수정
    if (expense.status === 'APPROVED' && pendingSteps.length > 0) {
      const updatedExpense = await prisma.expense.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          approvedAt: null, // 승인 일시 초기화
        },
      });

      return NextResponse.json({
        success: true,
        message: `상태가 IN_PROGRESS로 수정되었습니다. (남은 결재 단계: ${pendingSteps.length}개)`,
        previousStatus: expense.status,
        newStatus: updatedExpense.status,
        pendingSteps: pendingSteps.map((s) => ({
          stepNumber: s.stepNumber,
          stepName: s.stepName,
          approverName: s.approverName,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      message: '수정이 필요하지 않습니다.',
      currentStatus: expense.status,
      pendingStepsCount: pendingSteps.length,
    });
  } catch (error: any) {
    console.error('Fix status error:', error);
    return NextResponse.json(
      { error: '상태 수정 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
