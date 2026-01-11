import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * PUT /api/expenses/[id]/payment-status
 * 지출 상태 변경
 *
 * Body: {
 *   paymentStatus: "PENDING" | "HOLD" | "CANCELLED" | "COMPLETED",
 *   note?: string,
 *   reason?: string  // HOLD, CANCELLED일 때 필수
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { paymentStatus, note, reason } = body;

    // 현재 사용자 확인
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 또는 재정팀장만 변경 가능
    const allowedRoles = ['admin', '재정팀장'];
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json(
        { error: '지출 상태 변경 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 유효한 상태값 확인
    const validStatuses = ['PENDING', 'HOLD', 'CANCELLED', 'COMPLETED'];
    if (!validStatuses.includes(paymentStatus)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태값입니다. (PENDING, HOLD, CANCELLED, COMPLETED)' },
        { status: 400 }
      );
    }

    // HOLD, CANCELLED일 때 사유 필수
    if ((paymentStatus === 'HOLD' || paymentStatus === 'CANCELLED') && !reason?.trim()) {
      return NextResponse.json(
        { error: paymentStatus === 'HOLD' ? '보류 사유를 입력해주세요.' : '취소 사유를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 지출결의서 조회
    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return NextResponse.json(
        { error: '지출결의서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 최종 승인 상태인지 확인
    if (expense.status !== 'APPROVED_FINAL') {
      return NextResponse.json(
        { error: '최종 승인된 지출결의서만 지출 상태를 변경할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 이미 같은 상태인 경우
    if (expense.paymentStatus === paymentStatus) {
      const statusLabels: Record<string, string> = {
        PENDING: '지급 대기',
        HOLD: '지급 보류',
        CANCELLED: '지급 취소',
        COMPLETED: '지급 완료',
      };
      return NextResponse.json(
        { error: `이미 ${statusLabels[paymentStatus]} 상태입니다.` },
        { status: 400 }
      );
    }

    const now = new Date();

    // 상태 업데이트
    const updateData: any = {
      paymentStatus,
      paymentNote: note || null,
    };

    if (paymentStatus === 'COMPLETED') {
      updateData.paymentCompletedAt = now;
      updateData.paymentCompletedBy = currentUser.username;
      // 완료 시 보류 정보 초기화
      updateData.paymentHoldReason = null;
      updateData.paymentHoldAt = null;
      updateData.paymentHoldBy = null;
    } else if (paymentStatus === 'HOLD' || paymentStatus === 'CANCELLED') {
      updateData.paymentHoldReason = reason;
      updateData.paymentHoldAt = now;
      updateData.paymentHoldBy = currentUser.username;
      // 보류/취소 시 완료 정보 초기화
      updateData.paymentCompletedAt = null;
      updateData.paymentCompletedBy = null;
    } else {
      // PENDING으로 되돌리는 경우 모든 정보 초기화
      updateData.paymentCompletedAt = null;
      updateData.paymentCompletedBy = null;
      updateData.paymentHoldReason = null;
      updateData.paymentHoldAt = null;
      updateData.paymentHoldBy = null;
    }

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: updateData,
    });

    // 감사 로그 action 결정
    type PaymentAction = 'PAYMENT_COMPLETE' | 'PAYMENT_HOLD' | 'PAYMENT_CANCEL' | 'PAYMENT_REVERT';
    let action: PaymentAction;
    let defaultComment: string;
    switch (paymentStatus) {
      case 'COMPLETED':
        action = 'PAYMENT_COMPLETE';
        defaultComment = '지급 완료 처리';
        break;
      case 'HOLD':
        action = 'PAYMENT_HOLD';
        defaultComment = `지급 보류: ${reason}`;
        break;
      case 'CANCELLED':
        action = 'PAYMENT_CANCEL';
        defaultComment = `지급 취소: ${reason}`;
        break;
      default:
        action = 'PAYMENT_REVERT';
        defaultComment = '지급 대기로 되돌림';
    }

    // 감사 로그 생성
    await prisma.approvalLog.create({
      data: {
        expenseId: id,
        action,
        actorName: currentUser.username,
        actorEmail: currentUser.userid,
        actorRole: currentUser.role,
        previousStatus: expense.paymentStatus,
        newStatus: paymentStatus,
        comment: note || defaultComment,
        metadata: {
          userAgent: request.headers.get('user-agent') || '',
          timestamp: now.toISOString(),
          reason: reason || null,
        },
      },
    });

    const statusMessages: Record<string, string> = {
      PENDING: '지급 대기로 변경되었습니다.',
      HOLD: '지급 보류로 변경되었습니다.',
      CANCELLED: '지급 취소로 변경되었습니다.',
      COMPLETED: '지급 완료로 변경되었습니다.',
    };

    return NextResponse.json({
      success: true,
      message: statusMessages[paymentStatus],
      data: {
        id: updatedExpense.id,
        paymentStatus: updatedExpense.paymentStatus,
        paymentCompletedAt: updatedExpense.paymentCompletedAt,
        paymentCompletedBy: updatedExpense.paymentCompletedBy,
        paymentNote: updatedExpense.paymentNote,
        paymentHoldReason: updatedExpense.paymentHoldReason,
        paymentHoldAt: updatedExpense.paymentHoldAt,
        paymentHoldBy: updatedExpense.paymentHoldBy,
      },
    });
  } catch (error: any) {
    console.error('Payment status update error:', error);
    return NextResponse.json(
      { error: '지출 상태 변경 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/expenses/[id]/payment-status
 * 지출 상태 조회
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
        paymentStatus: true,
        paymentCompletedAt: true,
        paymentCompletedBy: true,
        paymentNote: true,
      },
    });

    if (!expense) {
      return NextResponse.json(
        { error: '지출결의서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(expense);
  } catch (error: any) {
    console.error('Payment status get error:', error);
    return NextResponse.json(
      { error: '지출 상태 조회 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
