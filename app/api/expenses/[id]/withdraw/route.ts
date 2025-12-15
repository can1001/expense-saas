import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/expenses/[id]/withdraw
 * 지출결의서 회수 (작성자가 제출한 문서를 철회)
 *
 * Body: {
 *   applicantName: string,
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
    const { applicantName, comment } = body;

    if (!applicantName) {
      return NextResponse.json(
        { error: '작성자 이름이 필요합니다.' },
        { status: 400 }
      );
    }

    // 지출결의서 조회
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        approvalLine: {
          include: {
            steps: true,
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

    // 작성자 확인
    if (expense.applicantName !== applicantName) {
      return NextResponse.json(
        { error: '작성자만 회수할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 회수 가능한 상태인지 확인 (결재 진행 중인 상태만)
    const withdrawableStatuses = ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'];
    if (!withdrawableStatuses.includes(expense.status)) {
      return NextResponse.json(
        {
          error: `회수할 수 없는 상태입니다. (현재: ${expense.status}). 결재 진행 중인 문서만 회수 가능합니다.`,
        },
        { status: 400 }
      );
    }

    // 트랜잭션으로 회수 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. 지출결의서 상태를 DRAFT로 되돌림
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          status: 'WITHDRAWN',
          submittedAt: null,
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

      // 2. 결재선은 유지하되, 모든 단계를 PENDING으로 초기화
      if (expense.approvalLine) {
        await tx.approvalStep.updateMany({
          where: {
            approvalLineId: expense.approvalLine.id,
          },
          data: {
            status: 'PENDING',
            approvedAt: null,
            rejectedAt: null,
            comment: null,
          },
        });

        // 결재선 currentStep 초기화
        await tx.approvalLine.update({
          where: { id: expense.approvalLine.id },
          data: {
            currentStep: 1,
          },
        });
      }

      // 3. 감사 로그 생성
      await tx.approvalLog.create({
        data: {
          expenseId: id,
          action: 'WITHDRAW',
          actorName: applicantName,
          actorRole: '작성자',
          previousStatus: expense.status,
          newStatus: 'WITHDRAWN',
          comment: comment || '작성자가 지출결의서를 회수함',
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
      message: '지출결의서가 회수되었습니다. 수정 후 다시 제출할 수 있습니다.',
      data: result,
    });
  } catch (error: any) {
    console.error('Withdraw error:', error);
    return NextResponse.json(
      { error: '회수 처리 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
