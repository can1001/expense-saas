import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/approvals/pending-count
 * 현재 로그인 사용자의 결재 대기 건수 조회 (배지 표시용 경량 API)
 */
export async function GET() {
  try {
    // 현재 로그인 사용자 확인
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ count: 0 });
    }

    const approverName = user.username;

    // 내 step이 PENDING이고 Expense가 진행 중인 결재선 조회
    const approvalLines = await prisma.approvalLine.findMany({
      where: {
        steps: {
          some: {
            approverName: approverName,
            status: 'PENDING',
          },
        },
        expense: {
          is: {
            status: {
              in: ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'],
            },
          },
        },
      },
      select: {
        currentStep: true,
        steps: {
          where: {
            approverName: approverName,
          },
          select: {
            stepNumber: true,
            status: true,
          },
        },
      },
    });

    // 현재 결재자 차례인 건만 필터링 (currentStep이 내 stepNumber와 일치)
    const pendingCount = approvalLines.filter((line) => {
      const myStep = line.steps.find((step) => step.status === 'PENDING');
      return myStep && myStep.stepNumber === line.currentStep;
    }).length;

    return NextResponse.json(
      { count: pendingCount },
      {
        headers: {
          'Cache-Control': 'private, max-age=30',
        },
      }
    );
  } catch (error: any) {
    console.error('Get pending count error:', error);
    return NextResponse.json(
      { count: 0, error: '결재 대기 건수 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
