import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/push/history
 * 현재 사용자의 알림 발송 히스토리 조회
 *
 * Query params:
 *   eventType?: SUBMIT | APPROVE | REJECT | WITHDRAW | PAYMENT_COMPLETE
 *   status?: PENDING | SENT | FAILED
 *   page?: number (default: 1)
 *   limit?: number (default: 20, max: 100)
 */
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const currentUser = user;

    const searchParams = request.nextUrl.searchParams;
    const eventType = searchParams.get('eventType');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // Where 조건 구성
    const where: any = {
      userId: currentUser.id,
    };

    if (eventType) {
      where.eventType = eventType;
    }

    if (status) {
      where.status = status;
    }

    // 총 개수 조회
    const total = await prisma.webPushLog.count({ where });

    // 데이터 조회
    const logs = await prisma.webPushLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      select: {
        id: true,
        eventType: true,
        title: true,
        body: true,
        url: true,
        status: true,
        errorMessage: true,
        sentAt: true,
        createdAt: true,
        expenseId: true,
      },
    });

    // 관련 지출결의서 정보 조회
    const expenseIds = logs
      .map((log) => log.expenseId)
      .filter((id): id is string => id !== null);

    const expenses = expenseIds.length > 0
      ? await prisma.expense.findMany({
          where: { id: { in: expenseIds } },
          select: {
            id: true,
            applicantName: true,
            requestAmount: true,
            status: true,
          },
        })
      : [];

    const expenseMap = new Map(expenses.map((e) => [e.id, e]));

    // 응답 데이터 구성
    const data = logs.map((log) => ({
      ...log,
      expense: log.expenseId ? expenseMap.get(log.expenseId) || null : null,
    }));

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[Push History API] 오류:', error);
    return NextResponse.json(
      { error: '알림 히스토리 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

export const GET = withAuth(handleGet);
