import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * PUT /api/expenses/[id]/payment-status
 * 지출 상태 변경 (지출예정 → 지출완료)
 *
 * Body: {
 *   paymentStatus: "PENDING" | "COMPLETED",
 *   note?: string
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { paymentStatus, note } = body;

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
    const validStatuses = ['PENDING', 'COMPLETED'];
    if (!validStatuses.includes(paymentStatus)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태값입니다. (PENDING 또는 COMPLETED)' },
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
      return NextResponse.json(
        { error: `이미 ${paymentStatus === 'COMPLETED' ? '지출완료' : '지출예정'} 상태입니다.` },
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
    } else {
      // PENDING으로 되돌리는 경우
      updateData.paymentCompletedAt = null;
      updateData.paymentCompletedBy = null;
    }

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: updateData,
    });

    // 감사 로그 생성
    await prisma.approvalLog.create({
      data: {
        expenseId: id,
        action: paymentStatus === 'COMPLETED' ? 'PAYMENT_COMPLETE' : 'PAYMENT_REVERT',
        actorName: currentUser.username,
        actorEmail: currentUser.userid,
        actorRole: currentUser.role,
        previousStatus: expense.paymentStatus,
        newStatus: paymentStatus,
        comment: note || (paymentStatus === 'COMPLETED' ? '지출완료 처리' : '지출예정으로 되돌림'),
        metadata: {
          userAgent: request.headers.get('user-agent') || '',
          timestamp: now.toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: paymentStatus === 'COMPLETED'
        ? '지출완료로 변경되었습니다.'
        : '지출예정으로 변경되었습니다.',
      data: {
        id: updatedExpense.id,
        paymentStatus: updatedExpense.paymentStatus,
        paymentCompletedAt: updatedExpense.paymentCompletedAt,
        paymentCompletedBy: updatedExpense.paymentCompletedBy,
        paymentNote: updatedExpense.paymentNote,
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
