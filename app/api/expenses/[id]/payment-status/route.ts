import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { notificationService } from '@/lib/services/notification';

/**
 * PUT /api/expenses/[id]/payment-status
 * 지출 상태 변경
 *
 * Body: {
 *   paymentStatus: "PENDING" | "HOLD" | "CANCELLED" | "COMPLETED",
 *   note?: string,
 *   reason?: string,  // HOLD, CANCELLED일 때 필수
 *   signature?: {     // COMPLETED일 때 출납 서명
 *     type: "signature" | "stamp",
 *     signatureId?: string,  // 저장된 서명 ID
 *     data?: string          // 또는 base64 데이터
 *   },
 *   expenseDate?: string   // COMPLETED일 때 지출일자 (YYYY-MM-DD)
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { paymentStatus, note, reason, signature, expenseDate } = body;

    // 현재 사용자 확인
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 지급상태 변경 권한 (admin, finance_head, accountant, admin_assistant)
    const allowedRoles = ['admin', 'finance_head', 'accountant', 'admin_assistant'];
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
      // 클라이언트에서 전달된 지출일자 사용, 없으면 기존값 유지, 그것도 없으면 현재 시간
      if (expenseDate) {
        updateData.expenseDate = new Date(expenseDate);
      } else if (!expense.expenseDate) {
        updateData.expenseDate = now;
      }
      // 완료 시 보류 정보 초기화
      updateData.paymentHoldReason = null;
      updateData.paymentHoldAt = null;
      updateData.paymentHoldBy = null;

      // 출납 서명 처리
      if (signature) {
        if (signature.signatureId) {
          // 저장된 서명 ID로 조회
          const userSignature = await prisma.userSignature.findUnique({
            where: { id: signature.signatureId },
          });
          if (userSignature) {
            updateData.paymentSignatureType = userSignature.type;
            updateData.paymentSignatureData = userSignature.imageData;
          }
        } else if (signature.data) {
          // 직접 전달된 base64 데이터
          updateData.paymentSignatureType = signature.type || 'signature';
          updateData.paymentSignatureData = signature.data;
        }
      }
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
      updateData.paymentSignatureType = null;
      updateData.paymentSignatureData = null;
      updateData.expenseDate = null;
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

    // 지급 완료 시 신청자에게 알림
    if (paymentStatus === 'COMPLETED') {
      try {
        const applicantUser = await prisma.user.findFirst({
          where: { username: expense.applicantName },
          select: { id: true, phoneNumber: true },
        });

        if (applicantUser) {
          notificationService
            .notifyOnPaymentComplete(id, applicantUser.phoneNumber || '', applicantUser.id, {
              applicantName: expense.applicantName,
              requestAmount: expense.requestAmount,
              bankName: expense.bankName,
              accountNumber: expense.accountNumber,
              paymentDate: now.toLocaleDateString('ko-KR'),
            })
            .catch((err) => console.error('[PaymentComplete] 알림 발송 실패:', err));
        }
      } catch (notifyError) {
        console.error('[PaymentComplete] 알림 처리 중 오류:', notifyError);
      }
    }

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
        paymentSignatureType: updatedExpense.paymentSignatureType,
        paymentSignatureData: updatedExpense.paymentSignatureData,
        expenseDate: updatedExpense.expenseDate,
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
