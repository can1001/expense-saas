import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canApprove } from '@/lib/approval-engine';
import { notificationService } from '@/lib/services/notification';
import { handleApiError } from '@/lib/api/error-handler';
import { withPermission, UserApiHandler } from '@/lib/auth/user';

/**
 * POST /api/expenses/[id]/reject
 * 지출결의서 반려
 *
 * Body: {
 *   comment: string (반려 사유 필수)
 * }
 */
const handlePost: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params!;
    const body = await request.json();
    const { comment } = body;
    const approverName = user.username;

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

    // 반려 가능한 상태인지 확인 (PENDING, APPROVED_STEP_1, APPROVED_STEP_2)
    const rejectableStatuses = ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'];
    if (!rejectableStatuses.includes(expense.status)) {
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

    // 알림 발송 (비동기, 실패해도 반려는 성공)
    try {
      // 신청자에게 반려 알림
      const applicantUser = await prisma.user.findFirst({
        where: { username: expense.applicantName },
        select: { id: true, phoneNumber: true },
      });

      if (applicantUser) {
        notificationService
          .notifyOnReject(id, applicantUser.phoneNumber || '', applicantUser.id, {
            applicantName: expense.applicantName,
            requestAmount: expense.requestAmount,
            approverName,
            rejectReason: comment,
          })
          .catch((err) => console.error('[Reject] 알림 발송 실패:', err));
      } else {
        await notificationService.logUnmatchedRecipient({
          expenseId: id,
          eventType: 'REJECT',
          attemptedName: expense.applicantName,
          role: 'applicant',
        });
      }
    } catch (notifyError) {
      console.error('[Reject] 알림 처리 중 오류:', notifyError);
    }

    return NextResponse.json({
      success: true,
      message: '지출결의서가 반려되었습니다.',
      data: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const POST = withPermission('canApprove', handlePost);
