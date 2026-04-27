import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'finance_head'];

/**
 * GET /api/admin/settlement/annual
 * 연간 결산 현황 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // 연간 결산 데이터 조회
    const annualSettlement = await prisma.settlement.findFirst({
      where: {
        year,
        period: 0,
        type: 'ANNUAL',
      },
    });

    // 분기별 결산 상태 조회
    const quarterlySettlements = await prisma.settlement.findMany({
      where: {
        year,
        type: 'QUARTERLY',
      },
      orderBy: { period: 'asc' },
    });

    const quarterStatus = [1, 2, 3, 4].map((quarter) => {
      const settlement = quarterlySettlements.find((s) => s.period === quarter);
      return {
        quarter,
        status: settlement?.status || 'OPEN',
      };
    });

    // 전기이월 (전년도 연간 결산의 currentBalance)
    const prevYearSettlement = await prisma.settlement.findFirst({
      where: {
        year: year - 1,
        period: 0,
        type: 'ANNUAL',
      },
    });
    const previousBalance = prevYearSettlement?.balance || 0;

    // 연간 수입/지출 집계
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
    const currentBalance = previousBalance + balance;

    return NextResponse.json({
      year,
      income,
      expense,
      balance,
      previousBalance,
      currentBalance,
      status: annualSettlement?.status || 'OPEN',
      closedAt: annualSettlement?.closedAt?.toISOString(),
      closedBy: annualSettlement?.closedByName,
      quarterStatus,
    });
  } catch (error) {
    console.error('Annual settlement API error:', error);
    return NextResponse.json(
      { error: '연간 결산 현황을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settlement/annual
 * 연간 결산 확정/해제
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { year, action } = body;

    if (!year || !action) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (action === 'close') {
      // 모든 분기가 마감되었는지 확인
      const quarterlySettlements = await prisma.settlement.findMany({
        where: {
          year,
          type: 'QUARTERLY',
        },
      });

      const closedQuarters = quarterlySettlements.filter((s) => s.status === 'CLOSED');
      if (closedQuarters.length < 4) {
        return NextResponse.json(
          { error: '모든 분기가 마감되어야 연간 결산을 확정할 수 있습니다.' },
          { status: 400 }
        );
      }

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      // 전기이월
      const prevYearSettlement = await prisma.settlement.findFirst({
        where: {
          year: year - 1,
          period: 0,
          type: 'ANNUAL',
        },
      });
      const previousBalance = prevYearSettlement?.balance || 0;

      // 연간 수입/지출 집계
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
      const balance = previousBalance + income - expense;

      await prisma.settlement.upsert({
        where: {
          year_period_type: {
            year,
            period: 0,
            type: 'ANNUAL',
          },
        },
        create: {
          year,
          period: 0,
          type: 'ANNUAL',
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
      // 확정 해제
      await prisma.settlement.updateMany({
        where: {
          year,
          period: 0,
          type: 'ANNUAL',
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
    console.error('Annual settlement POST error:', error);
    return NextResponse.json(
      { error: '결산 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
