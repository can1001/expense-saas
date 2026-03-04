import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * PUT /api/expenses/bulk-payment-status
 * 지급 상태 일괄 변경 (지급대기 ↔ 지급완료)
 *
 * Body: {
 *   ids: string[],
 *   paymentStatus: "PENDING" | "COMPLETED",
 *   note?: string,
 *   signature?: {     // COMPLETED일 때 출납 서명
 *     type: "signature" | "stamp",
 *     signatureId?: string,
 *     data?: string
 *   }
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, paymentStatus, note, signature } = body;

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

    // 필수 파라미터 확인
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '변경할 지출결의서 ID를 선택해주세요.' },
        { status: 400 }
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

    // 대상 지출결의서 조회
    const expenses = await prisma.expense.findMany({
      where: {
        id: { in: ids },
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        applicantName: true,
      },
    });

    if (expenses.length === 0) {
      return NextResponse.json(
        { error: '지출결의서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 최종 승인된 항목만 필터링
    const eligibleExpenses = expenses.filter(e => e.status === 'APPROVED_FINAL');
    const ineligibleCount = expenses.length - eligibleExpenses.length;

    // 이미 같은 상태인 항목 제외
    const toUpdate = eligibleExpenses.filter(e => e.paymentStatus !== paymentStatus);
    const alreadySameStatusCount = eligibleExpenses.length - toUpdate.length;

    if (toUpdate.length === 0) {
      return NextResponse.json(
        {
          error: '변경할 항목이 없습니다.',
          details: {
            ineligibleCount,
            alreadySameStatusCount,
          },
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateIds = toUpdate.map(e => e.id);

    // 일괄 업데이트
    const updateData: Record<string, unknown> = {
      paymentStatus,
      paymentNote: note || null,
    };

    if (paymentStatus === 'COMPLETED') {
      updateData.paymentCompletedAt = now;
      updateData.paymentCompletedBy = currentUser.username;

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

      // 지출일자가 없는 항목들의 expenseDate를 지급완료일로 설정
      await prisma.expense.updateMany({
        where: {
          id: { in: updateIds },
          expenseDate: null,
        },
        data: {
          expenseDate: now,
        },
      });
    } else {
      updateData.paymentCompletedAt = null;
      updateData.paymentCompletedBy = null;
      updateData.paymentSignatureType = null;
      updateData.paymentSignatureData = null;
      updateData.expenseDate = null;
    }

    await prisma.expense.updateMany({
      where: {
        id: { in: updateIds },
      },
      data: updateData,
    });

    // 감사 로그 일괄 생성
    const logEntries = toUpdate.map(expense => ({
      expenseId: expense.id,
      action: paymentStatus === 'COMPLETED' ? 'PAYMENT_COMPLETE' as const : 'PAYMENT_REVERT' as const,
      actorName: currentUser.username,
      actorEmail: currentUser.userid,
      actorRole: currentUser.role,
      previousStatus: expense.paymentStatus,
      newStatus: paymentStatus,
      comment: note || (paymentStatus === 'COMPLETED' ? '지급완료 일괄 처리' : '지급대기로 일괄 되돌림'),
      metadata: {
        bulkOperation: true,
        totalSelected: ids.length,
        actualUpdated: updateIds.length,
        userAgent: request.headers.get('user-agent') || '',
        timestamp: now.toISOString(),
      },
    }));

    await prisma.approvalLog.createMany({
      data: logEntries,
    });

    return NextResponse.json({
      success: true,
      message: paymentStatus === 'COMPLETED'
        ? `${toUpdate.length}건이 지급완료로 변경되었습니다.`
        : `${toUpdate.length}건이 지급대기로 변경되었습니다.`,
      data: {
        updatedCount: toUpdate.length,
        skipped: {
          notApproved: ineligibleCount,
          alreadySameStatus: alreadySameStatusCount,
        },
      },
    });
  } catch (error: unknown) {
    console.error('Bulk payment status update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: '지급 상태 일괄 변경 중 오류가 발생했습니다.', details: errorMessage },
      { status: 500 }
    );
  }
}
