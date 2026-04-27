import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant'];

/**
 * GET /api/admin/settlement/monthly
 * 월별 결산 현황 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // 12개월 데이터 생성
    const months: Array<{
      month: number;
      income: number;
      expense: number;
      balance: number;
      status: 'OPEN' | 'CLOSED';
      closedAt?: string;
      closedBy?: string;
    }> = [];

    // 기존 결산 데이터 조회
    const settlements = await prisma.settlement.findMany({
      where: {
        year,
        type: 'MONTHLY',
      },
    });

    const settlementMap = new Map(
      settlements.map((s) => [s.period, s])
    );

    // 월별 수입/지출 집계
    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // 수입 (헌금)
      const incomeData = await prisma.offering.aggregate({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { amount: true },
      });

      // 지출 (승인된 지출결의서)
      const expenseData = await prisma.expense.aggregate({
        where: {
          status: 'APPROVED_FINAL',
          requestDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { requestAmount: true },
      });

      const income = incomeData._sum.amount || 0;
      const expense = expenseData._sum.requestAmount || 0;
      const balance = income - expense;

      const settlement = settlementMap.get(month);

      months.push({
        month,
        income,
        expense,
        balance,
        status: settlement?.status || 'OPEN',
        closedAt: settlement?.closedAt?.toISOString(),
        closedBy: settlement?.closedByName || undefined,
      });
    }

    // 연간 합계
    const yearTotal = {
      income: months.reduce((sum, m) => sum + m.income, 0),
      expense: months.reduce((sum, m) => sum + m.expense, 0),
      balance: months.reduce((sum, m) => sum + m.balance, 0),
    };

    return NextResponse.json({
      year,
      months,
      yearTotal,
    });
  } catch (error) {
    console.error('Monthly settlement API error:', error);
    return NextResponse.json(
      { error: '월별 결산 현황을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settlement/monthly
 * 월별 결산 마감/해제
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { year, month, action } = body;

    if (!year || !month || !action) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (action === 'close') {
      // 마감 처리
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // 수입/지출 집계
      const [incomeData, expenseData] = await Promise.all([
        prisma.offering.aggregate({
          where: {
            date: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            status: 'APPROVED_FINAL',
            requestDate: { gte: startDate, lte: endDate },
          },
          _sum: { requestAmount: true },
        }),
      ]);

      const income = incomeData._sum.amount || 0;
      const expense = expenseData._sum.requestAmount || 0;
      const balance = income - expense;

      await prisma.settlement.upsert({
        where: {
          year_period_type: {
            year,
            period: month,
            type: 'MONTHLY',
          },
        },
        create: {
          year,
          period: month,
          type: 'MONTHLY',
          income,
          expense,
          balance,
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: user.id,
          closedByName: user.username,
        },
        update: {
          income,
          expense,
          balance,
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: user.id,
          closedByName: user.username,
        },
      });

      return NextResponse.json({ success: true, action: 'closed' });
    } else if (action === 'open') {
      // 마감 해제
      await prisma.settlement.updateMany({
        where: {
          year,
          period: month,
          type: 'MONTHLY',
        },
        data: {
          status: 'OPEN',
          closedAt: null,
          closedBy: null,
          closedByName: null,
        },
      });

      return NextResponse.json({ success: true, action: 'opened' });
    }

    return NextResponse.json({ error: '잘못된 액션입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Monthly settlement POST error:', error);
    return NextResponse.json(
      { error: '결산 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
