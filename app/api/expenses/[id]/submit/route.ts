import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  generateApprovalLine,
  createApprovalSnapshot,
  calculateApprovalStatus,
} from '@/lib/approval-engine';

/**
 * POST /api/expenses/[id]/submit
 * 지출결의서 제출 및 결재선 생성
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 지출결의서 조회
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        items: true,
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

    // 이미 제출된 경우 에러
    if (expense.status !== 'DRAFT') {
      return NextResponse.json(
        {
          error: `이미 제출된 지출결의서입니다. (현재 상태: ${expense.status})`,
        },
        { status: 400 }
      );
    }

    // 결재선 자동 생성
    const approvalLineData = generateApprovalLine({
      committee: expense.committee,
      department: expense.department,
      budgetCategory: expense.budgetCategory,
      budgetSubcategory: expense.budgetSubcategory,
      requestAmount: expense.requestAmount,
      applicantName: expense.applicantName,
    });

    // 스냅샷 생성
    const snapshot = createApprovalSnapshot(approvalLineData);

    // 트랜잭션으로 결재선 생성 및 상태 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // 1. 결재선 생성 (기존에 있으면 삭제 후 재생성)
      if (expense.approvalLine) {
        await tx.approvalLine.delete({
          where: { id: expense.approvalLine.id },
        });
      }

      const approvalLine = await tx.approvalLine.create({
        data: {
          expenseId: id,
          currentStep: 1,
          totalSteps: approvalLineData.totalSteps,
          isUrgent: approvalLineData.isUrgent || false,
          snapshot,
          steps: {
            create: approvalLineData.steps.map((step) => ({
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
          steps: true,
        },
      });

      // 2. 지출결의서 상태 업데이트
      const newStatus = calculateApprovalStatus(
        'SUBMIT',
        1,
        approvalLineData.totalSteps
      );

      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          status: newStatus as any,
          submittedAt: new Date(),
        },
        include: {
          items: true,
          approvalLine: {
            include: {
              steps: true,
            },
          },
        },
      });

      // 3. 감사 로그 생성
      await tx.approvalLog.create({
        data: {
          expenseId: id,
          action: 'SUBMIT',
          actorName: expense.applicantName,
          actorRole: '작성자',
          previousStatus: 'DRAFT',
          newStatus,
          comment: '지출결의서 제출',
          metadata: {
            userAgent: request.headers.get('user-agent') || '',
            timestamp: new Date().toISOString(),
          },
          afterSnapshot: JSON.parse(snapshot),
        },
      });

      return updatedExpense;
    });

    return NextResponse.json({
      success: true,
      message: '지출결의서가 제출되었습니다.',
      data: result,
    });
  } catch (error: any) {
    console.error('Submit error:', error);

    // 자기결재 방지 에러 처리
    if (error.message?.includes('자기결재 불가')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '지출결의서 제출 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
