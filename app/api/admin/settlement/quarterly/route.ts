import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant'];

const QUARTER_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

/**
 * GET /api/admin/settlement/quarterly
 * 분기별 결산 현황 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // 기존 결산 데이터 조회
    const settlements = await prisma.settlement.findMany({
      where: {
        year,
        type: 'QUARTERLY',
      },
    });

    const settlementMap = new Map(
      settlements.map((s) => [s.period, s])
    );

    // 4분기 데이터 생성
    const quarters: Array<{
      quarter: number;
      months: number[];
      income: number;
      expense: number;
      balance: number;
      status: 'OPEN' | 'CLOSED';
      closedAt?: string;
      closedBy?: string;
    }> = [];

    for (let quarter = 1; quarter <= 4; quarter++) {
      const months = QUARTER_MONTHS[quarter];
      const startDate = new Date(year, months[0] - 1, 1);
      const endDate = new Date(year, months[2], 0, 23, 59, 59);

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

      const settlement = settlementMap.get(quarter);

      quarters.push({
        quarter,
        months,
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
      income: quarters.reduce((sum, q) => sum + q.income, 0),
      expense: quarters.reduce((sum, q) => sum + q.expense, 0),
      balance: quarters.reduce((sum, q) => sum + q.balance, 0),
    };

    return NextResponse.json({
      year,
      quarters,
      yearTotal,
    });
  } catch (error) {
    console.error('Quarterly settlement API error:', error);
    return NextResponse.json(
      { error: '분기별 결산 현황을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settlement/quarterly
 * 분기별 결산 마감/해제
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { year, quarter, action } = body;

    if (!year || !quarter || !action) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (action === 'close') {
      // 해당 분기의 월별 결산이 모두 마감되었는지 확인
      const months = QUARTER_MONTHS[quarter];
      const monthlySettlements = await prisma.settlement.findMany({
        where: {
          year,
          type: 'MONTHLY',
          period: { in: months },
        },
      });

      const closedMonths = monthlySettlements.filter((s) => s.status === 'CLOSED');
      if (closedMonths.length < 3) {
        return NextResponse.json(
          { error: '해당 분기의 모든 월이 마감되어야 분기 결산을 마감할 수 있습니다.' },
          { status: 400 }
        );
      }

      // 분기 수입/지출 집계
      const startDate = new Date(year, months[0] - 1, 1);
      const endDate = new Date(year, months[2], 0, 23, 59, 59);

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
            period: quarter,
            type: 'QUARTERLY',
          },
        },
        create: {
          year,
          period: quarter,
          type: 'QUARTERLY',
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
          period: quarter,
          type: 'QUARTERLY',
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
    console.error('Quarterly settlement POST error:', error);
    return NextResponse.json(
      { error: '결산 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
