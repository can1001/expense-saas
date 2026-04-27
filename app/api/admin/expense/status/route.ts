import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'admin_assistant', 'accountant', 'finance_head', 'finance_member'];

/**
 * GET /api/admin/expense/status
 * 지출 현황 조회 (연도별 위원회/월별 집계)
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

    // 1. 총 예산
    const budgetData = await prisma.budgetDetailYear.aggregate({
      where: {
        year,
        isActive: true,
      },
      _sum: {
        budgetAmount: true,
        usedAmount: true,
      },
    });

    const totalBudget = budgetData._sum.budgetAmount || 0;
    const totalExpense = budgetData._sum.usedAmount || 0;
    const executionRate = totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 1000) / 10 : 0;

    // 2. 위원회별 현황
    const committeeData = await prisma.expense.groupBy({
      by: ['committee'],
      where: {
        status: 'APPROVED_FINAL',
        requestDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        requestAmount: true,
      },
    });

    // 위원회별 예산 조회 (Committee → Department → BudgetDetail 연결)
    const committees = await prisma.committee.findMany({
      where: { isActive: true },
      include: {
        departments: {
          include: {
            budgetDetails: {
              include: {
                budgetDetail: {
                  include: {
                    yearSettings: {
                      where: { year, isActive: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const byCommittee = committees.map((committee) => {
      // 위원회별 예산 합계
      let budgetAmount = 0;
      committee.departments.forEach((dept) => {
        dept.budgetDetails.forEach((dbd) => {
          dbd.budgetDetail.yearSettings.forEach((ys) => {
            budgetAmount += ys.budgetAmount;
          });
        });
      });

      // 위원회별 집행 금액
      const expenseData = committeeData.find((c) => c.committee === committee.name);
      const usedAmount = expenseData?._sum.requestAmount || 0;

      const rate = budgetAmount > 0 ? Math.round((usedAmount / budgetAmount) * 1000) / 10 : 0;

      return {
        committee: committee.name,
        budgetAmount,
        usedAmount,
        rate,
      };
    });

    // 3. 월별 추이
    const monthlyData = await prisma.$queryRaw<Array<{ month: number; amount: bigint }>>`
      SELECT
        EXTRACT(MONTH FROM "requestDate")::int as month,
        COALESCE(SUM("requestAmount"), 0) as amount
      FROM "Expense"
      WHERE status = 'APPROVED_FINAL'
        AND "requestDate" >= ${startDate}
        AND "requestDate" <= ${endDate}
      GROUP BY EXTRACT(MONTH FROM "requestDate")
      ORDER BY month
    `;

    // 12개월 데이터 초기화
    const monthMap = new Map<number, number>();
    for (let m = 1; m <= 12; m++) {
      monthMap.set(m, 0);
    }

    monthlyData.forEach((item) => {
      monthMap.set(item.month, Number(item.amount));
    });

    const byMonth = Array.from(monthMap.entries()).map(([month, amount]) => ({
      month,
      amount,
    }));

    return NextResponse.json({
      year,
      totalExpense,
      totalBudget,
      executionRate,
      byCommittee: byCommittee.sort((a, b) => b.usedAmount - a.usedAmount),
      byMonth,
    });
  } catch (error) {
    console.error('Expense status API error:', error);
    return NextResponse.json(
      { error: '지출 현황을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
