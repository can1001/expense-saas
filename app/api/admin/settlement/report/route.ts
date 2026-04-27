import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'admin_assistant', 'finance_member'];

const QUARTER_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

/**
 * GET /api/admin/settlement/report
 * 재정보고서 데이터 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const quarter = parseInt(searchParams.get('quarter') || '1');

    // 기간 설정 (누적: 1월 ~ 해당 분기 말)
    const months = QUARTER_MONTHS[quarter];
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, months[2], 0, 23, 59, 59);

    // 전기이월 (전년도 결산)
    const prevYearSettlement = await prisma.settlement.findFirst({
      where: {
        year: year - 1,
        period: 0,
        type: 'ANNUAL',
      },
    });
    const previousBalance = prevYearSettlement?.balance || 0;

    // 수입 집계 (헌금 종류별)
    const incomeByType = await prisma.offering.groupBy({
      by: ['type'],
      where: {
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    // 연간 예산 (헌금 예산은 별도 관리 필요 - 일단 0으로 처리)
    const totalIncome = incomeByType.reduce((sum, item) => sum + (item._sum.amount || 0), 0);

    // 지출 집계 (예산 항목별)
    const expenseByCategory = await prisma.$queryRaw<Array<{
      category: string;
      amount: bigint;
    }>>`
      SELECT
        COALESCE(ei."budgetCategory", '기타') as category,
        COALESCE(SUM(ei.amount), 0) as amount
      FROM "Expense" e
      JOIN "ExpenseItem" ei ON e.id = ei."expenseId"
      WHERE e.status = 'APPROVED_FINAL'
        AND e."requestDate" >= ${startDate}
        AND e."requestDate" <= ${endDate}
      GROUP BY ei."budgetCategory"
      ORDER BY amount DESC
    `;

    const totalExpense = expenseByCategory.reduce((sum, item) => sum + Number(item.amount), 0);

    // 예산 데이터 (항목별)
    const budgetByCategory = await prisma.$queryRaw<Array<{
      category: string;
      budget: bigint;
    }>>`
      SELECT
        bc.name as category,
        COALESCE(SUM(bdy."budgetAmount"), 0) as budget
      FROM "BudgetCategory" bc
      JOIN "BudgetSubcategory" bs ON bc.id = bs."categoryId"
      JOIN "BudgetDetail" bd ON bs.id = bd."subcategoryId"
      JOIN "BudgetDetailYear" bdy ON bd.id = bdy."budgetDetailId"
      WHERE bdy.year = ${year} AND bdy."isActive" = true
      GROUP BY bc.name
      ORDER BY bc."sortOrder"
    `;

    const budgetMap = new Map(budgetByCategory.map((b) => [b.category, Number(b.budget)]));

    // 위원회별 지출
    const committeeExpense = await prisma.expense.groupBy({
      by: ['committee'],
      where: {
        status: 'APPROVED_FINAL',
        requestDate: { gte: startDate, lte: endDate },
      },
      _sum: { requestAmount: true },
    });

    const totalCommitteeExpense = committeeExpense.reduce(
      (sum, c) => sum + (c._sum.requestAmount || 0),
      0
    );

    // 수지 계산
    const balance = totalIncome - totalExpense;
    const currentBalance = previousBalance + balance;

    return NextResponse.json({
      year,
      quarter,
      summary: {
        totalIncome,
        totalExpense,
        balance,
        previousBalance,
        currentBalance,
      },
      income: incomeByType.map((item) => ({
        category: getOfferingTypeName(item.type),
        budget: 0, // 수입 예산은 별도 관리 필요
        actual: item._sum.amount || 0,
        rate: 0,
      })),
      expense: expenseByCategory.map((item) => {
        const budget = budgetMap.get(item.category) || 0;
        const actual = Number(item.amount);
        return {
          category: item.category,
          budget,
          actual,
          rate: budget > 0 ? Math.round((actual / budget) * 1000) / 10 : 0,
        };
      }),
      committeeExpense: committeeExpense.map((c) => ({
        committee: c.committee,
        amount: c._sum.requestAmount || 0,
        percentage: totalCommitteeExpense > 0
          ? Math.round(((c._sum.requestAmount || 0) / totalCommitteeExpense) * 1000) / 10
          : 0,
      })).sort((a, b) => b.amount - a.amount),
    });
  } catch (error) {
    console.error('Settlement report API error:', error);
    return NextResponse.json(
      { error: '재정보고서를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

function getOfferingTypeName(type: string): string {
  const names: Record<string, string> = {
    TITHE: '십일조',
    THANKSGIVING: '감사헌금',
    SPECIAL: '특별헌금',
    MISSION: '선교헌금',
    BUILDING: '건축헌금',
    RELIEF: '구제헌금',
    OTHER: '기타',
  };
  return names[type] || type;
}
