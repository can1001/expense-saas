import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 관리자 대시보드 KPI 데이터 API
 *
 * GET /api/admin/dashboard?year=2026
 *
 * 반환 데이터:
 * - executionRate: 예산 집행률 (%)
 * - pendingApprovals: 결재 대기 건수
 * - monthlyExpense: 이번 달 지출 합계
 * - pendingPayments: 지급 대기 건수
 * - recentExpenses: 최근 제출된 지출결의서 5건
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    const now = new Date();
    const currentMonth = now.getMonth();
    const monthStart = new Date(year, currentMonth, 1);
    const monthEnd = new Date(year, currentMonth + 1, 0, 23, 59, 59);

    // 1. 예산 집행률 계산
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
    const totalUsed = budgetData._sum.usedAmount || 0;
    const executionRate = totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 1000) / 10 : 0;

    // 2. 결재 대기 건수 (PENDING, APPROVED_STEP_1, APPROVED_STEP_2 상태)
    const pendingApprovals = await prisma.expense.count({
      where: {
        status: {
          in: ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'],
        },
      },
    });

    // 3. 이번 달 지출 합계 (APPROVED_FINAL 상태)
    const monthlyExpenseData = await prisma.expense.aggregate({
      where: {
        status: 'APPROVED_FINAL',
        requestDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: {
        requestAmount: true,
      },
    });
    const monthlyExpense = monthlyExpenseData._sum.requestAmount || 0;

    // 4. 지급 대기 건수 (최종 승인되었지만 지급 미완료)
    const pendingPayments = await prisma.expense.count({
      where: {
        status: 'APPROVED_FINAL',
        NOT: {
          paymentStatus: 'COMPLETED',
        },
      },
    });

    // 5. 최근 제출된 지출결의서 5건
    const recentExpenses = await prisma.expense.findMany({
      where: {
        status: {
          not: 'DRAFT',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        applicantName: true,
        requestAmount: true,
        status: true,
        requestDate: true,
        department: true,
        committee: true,
        createdAt: true,
      },
    });

    // 6. 연간 요약 데이터
    const yearlyExpenseData = await prisma.expense.aggregate({
      where: {
        status: 'APPROVED_FINAL',
        requestDate: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59),
        },
      },
      _sum: {
        requestAmount: true,
      },
      _count: true,
    });

    return NextResponse.json({
      year,
      kpi: {
        executionRate,
        totalBudget,
        totalUsed,
        pendingApprovals,
        monthlyExpense,
        pendingPayments,
      },
      yearly: {
        totalExpense: yearlyExpenseData._sum.requestAmount || 0,
        expenseCount: yearlyExpenseData._count || 0,
      },
      recentExpenses: recentExpenses.map((expense) => ({
        id: expense.id,
        applicantName: expense.applicantName,
        requestAmount: expense.requestAmount,
        status: expense.status,
        requestDate: expense.requestDate,
        department: expense.department,
        committee: expense.committee,
        createdAt: expense.createdAt,
      })),
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: '대시보드 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
