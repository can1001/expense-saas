import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { getEffectiveRole, CURRENT_YEAR } from '@/lib/services/user-service';

/**
 * PUT /api/expenses/bulk-expense-date
 * 일괄 지출일자 설정
 *
 * Body: {
 *   ids: string[],           // 지출결의서 ID 배열
 *   expenseDate: string,     // 지출일자 (YYYY-MM-DD 형식)
 *   overwriteExisting: boolean // 기존 지출일자도 덮어쓰기
 * }
 */
const handlePut: UserApiHandler = async (request, { user }) => {
  try {
    const body = await request.json();
    const { ids, expenseDate, overwriteExisting } = body;
    const currentUser = user;

    // 지출일자 변경 권한 (admin, finance_head, accountant, admin_assistant) - 연도별 유효 역할 기준
    const allowedRoles = ['admin', 'finance_head', 'accountant', 'admin_assistant'];
    const { role: effectiveRole } = await getEffectiveRole(currentUser.id, CURRENT_YEAR);
    if (!allowedRoles.includes(effectiveRole)) {
      return NextResponse.json(
        { error: '지출일자 변경 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 유효성 검사
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '변경할 지출결의서를 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!expenseDate) {
      return NextResponse.json(
        { error: '지출일자를 입력해주세요.' },
        { status: 400 }
      );
    }

    const dateValue = new Date(expenseDate);
    if (isNaN(dateValue.getTime())) {
      return NextResponse.json(
        { error: '유효하지 않은 날짜 형식입니다.' },
        { status: 400 }
      );
    }

    const now = new Date();

    // 선택된 지출결의서 조회
    const expenses = await prisma.expense.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, expenseDate: true },
    });

    if (expenses.length === 0) {
      return NextResponse.json(
        { error: '지출결의서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 대상 ID 목록 결정
    let targetIds: string[];
    if (overwriteExisting) {
      // 모든 항목에 적용
      targetIds = expenses.map(e => e.id);
    } else {
      // expenseDate가 null인 항목만 적용
      targetIds = expenses.filter(e => !e.expenseDate).map(e => e.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: '변경할 항목이 없습니다. 모든 항목에 이미 지출일자가 설정되어 있습니다.' },
        { status: 400 }
      );
    }

    // 일괄 업데이트
    await prisma.expense.updateMany({
      where: { id: { in: targetIds } },
      data: { expenseDate: dateValue },
    });

    // 감사 로그 생성
    await prisma.approvalLog.create({
      data: {
        expenseId: targetIds[0], // 대표 ID
        action: 'BULK_EXPENSE_DATE_UPDATE',
        actorName: currentUser.username,
        actorEmail: currentUser.userid,
        actorRole: currentUser.role,
        newStatus: 'EXPENSE_DATE_UPDATED',
        comment: `일괄 지출일자 설정: ${expenseDate} (${targetIds.length}건)`,
        metadata: {
          bulkOperation: true,
          totalSelected: ids.length,
          actualUpdated: targetIds.length,
          expenseDate: expenseDate,
          overwriteExisting: overwriteExisting || false,
          updatedIds: targetIds,
          userAgent: request.headers.get('user-agent') || '',
          timestamp: now.toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${targetIds.length}건의 지출일자가 변경되었습니다.`,
      data: {
        totalSelected: ids.length,
        actualUpdated: targetIds.length,
        skipped: ids.length - targetIds.length,
        expenseDate: expenseDate,
      },
    });
  } catch (error: any) {
    console.error('Bulk expense date update error:', error);
    return NextResponse.json(
      { error: '지출일자 변경 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
};

export const PUT = withAuth(handlePut);
