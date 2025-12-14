import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  canModifyApprovalLine,
  generateApprovalLine,
  createApprovalSnapshot,
} from '@/lib/approval-engine';

/**
 * GET /api/expenses/[id]/approval
 * 결재선 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        applicantName: true,
        requestAmount: true,
        submittedAt: true,
        approvedAt: true,
        rejectedAt: true,
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

    // 결재 로그도 함께 조회
    const logs = await prisma.approvalLog.findMany({
      where: { expenseId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      expense: {
        id: expense.id,
        status: expense.status,
        applicantName: expense.applicantName,
        requestAmount: expense.requestAmount,
        submittedAt: expense.submittedAt,
        approvedAt: expense.approvedAt,
        rejectedAt: expense.rejectedAt,
      },
      approvalLine: expense.approvalLine,
      logs,
    });
  } catch (error: any) {
    console.error('Get approval error:', error);
    return NextResponse.json(
      { error: '결재선 조회 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/expenses/[id]/approval
 * 결재선 수정 (제출 전만 가능)
 *
 * Body: {
 *   actorName: string,
 *   steps: ApprovalStepInput[]
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actorName, steps } = body;

    if (!actorName) {
      return NextResponse.json(
        { error: '수정자 이름이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: '결재 단계 정보가 필요합니다.' },
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

    // 수정 권한 검증
    const validation = canModifyApprovalLine(
      expense.status,
      actorName,
      expense.applicantName
    );

    if (!validation.allowed) {
      return NextResponse.json({ error: validation.reason }, { status: 403 });
    }

    // 이전 결재선 스냅샷 저장
    const beforeSnapshot = expense.approvalLine
      ? {
          steps: expense.approvalLine.steps,
          totalSteps: expense.approvalLine.totalSteps,
        }
      : null;

    // 새 스냅샷 생성
    const newSnapshot = createApprovalSnapshot({
      steps,
      totalSteps: steps.length,
    });

    // 트랜잭션으로 결재선 수정
    const result = await prisma.$transaction(async (tx) => {
      // 1. 기존 결재선 삭제
      if (expense.approvalLine) {
        await tx.approvalLine.delete({
          where: { id: expense.approvalLine.id },
        });
      }

      // 2. 새 결재선 생성
      const approvalLine = await tx.approvalLine.create({
        data: {
          expenseId: id,
          currentStep: 1,
          totalSteps: steps.length,
          isUrgent: false,
          snapshot: newSnapshot,
          steps: {
            create: steps.map((step: any) => ({
              stepNumber: step.stepNumber,
              stepName: step.stepName,
              approverName: step.approverName,
              approverEmail: step.approverEmail,
              approverTitle: step.approverTitle,
              isRequired: step.isRequired,
              isParallel: step.isParallel || false,
              status: 'PENDING',
            })),
          },
        },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' },
          },
        },
      });

      // 3. 감사 로그 생성
      await tx.approvalLog.create({
        data: {
          expenseId: id,
          action: 'MODIFY_LINE',
          actorName,
          actorRole: '작성자',
          previousStatus: expense.status,
          newStatus: expense.status,
          comment: '결재선 수정',
          metadata: {
            userAgent: request.headers.get('user-agent') || '',
            timestamp: new Date().toISOString(),
          },
          beforeSnapshot,
          afterSnapshot: JSON.parse(newSnapshot),
        },
      });

      return approvalLine;
    });

    return NextResponse.json({
      success: true,
      message: '결재선이 수정되었습니다.',
      data: result,
    });
  } catch (error: any) {
    console.error('Update approval error:', error);
    return NextResponse.json(
      { error: '결재선 수정 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
