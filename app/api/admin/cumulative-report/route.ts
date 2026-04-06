import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 분기별 누적 현황 API
 *
 * GET /api/admin/cumulative-report?year=2026&toQuarter=3
 *
 * 1분기부터 선택한 분기(toQuarter)까지의 누적 집행 실적 조회
 */

function getQuarterDateRange(year: number, quarter: number): { start: Date; end: Date } {
  const quarterStartMonth = (quarter - 1) * 3;
  const start = new Date(year, quarterStartMonth, 1);
  const end = new Date(year, quarterStartMonth + 3, 0, 23, 59, 59);
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const toQuarter = parseInt(searchParams.get('toQuarter') || '4');

    // 1. 전체 예산 조회
    const budgetData = await prisma.budgetDetailYear.aggregate({
      where: {
        year,
        isActive: true,
      },
      _sum: {
        budgetAmount: true,
      },
    });
    const totalBudget = budgetData._sum.budgetAmount || 0;

    // 2. 분기별 지출 조회 (1~toQuarter)
    const quarterlyBreakdown: Array<{ quarter: number; spent: number; ratio: number }> = [];
    let cumulativeSpent = 0;

    for (let q = 1; q <= toQuarter; q++) {
      const { start, end } = getQuarterDateRange(year, q);

      const quarterExpense = await prisma.expense.aggregate({
        where: {
          status: 'APPROVED_FINAL',
          requestDate: {
            gte: start,
            lte: end,
          },
        },
        _sum: {
          requestAmount: true,
        },
      });

      const spent = quarterExpense._sum.requestAmount || 0;
      cumulativeSpent += spent;

      quarterlyBreakdown.push({
        quarter: q,
        spent,
        ratio: totalBudget > 0 ? Math.round((spent / totalBudget) * 1000) / 10 : 0,
      });
    }

    // 3. 부서별 누적 집행 현황
    const { start: yearStart } = getQuarterDateRange(year, 1);
    const { end: quarterEnd } = getQuarterDateRange(year, toQuarter);

    // 위원회/부서별 예산 조회
    const budgetByDept = await prisma.budgetDetailYear.findMany({
      where: {
        year,
        isActive: true,
      },
      include: {
        budgetDetail: {
          include: {
            departmentDetails: {
              include: {
                department: {
                  include: {
                    committee: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 부서별 예산 집계
    const deptBudgetMap = new Map<string, { committee: string; department: string; budget: number }>();

    for (const item of budgetByDept) {
      for (const dd of item.budgetDetail.departmentDetails) {
        const key = `${dd.department.committee.name}|${dd.department.name}`;
        const existing = deptBudgetMap.get(key);
        if (existing) {
          existing.budget += item.budgetAmount;
        } else {
          deptBudgetMap.set(key, {
            committee: dd.department.committee.name,
            department: dd.department.name,
            budget: item.budgetAmount,
          });
        }
      }
    }

    // 부서별 지출 조회
    const expensesByDept = await prisma.expense.groupBy({
      by: ['committee', 'department'],
      where: {
        status: 'APPROVED_FINAL',
        requestDate: {
          gte: yearStart,
          lte: quarterEnd,
        },
      },
      _sum: {
        requestAmount: true,
      },
    });

    // 부서별 지출 맵
    const deptExpenseMap = new Map<string, number>();
    for (const item of expensesByDept) {
      const key = `${item.committee || ''}|${item.department || ''}`;
      deptExpenseMap.set(key, item._sum.requestAmount || 0);
    }

    // 부서별 데이터 병합
    const byDepartment: Array<{
      committee: string;
      department: string;
      budget: number;
      cumulativeSpent: number;
      remaining: number;
      executionRate: number;
    }> = [];

    for (const [key, data] of deptBudgetMap) {
      const spent = deptExpenseMap.get(key) || 0;
      const remaining = data.budget - spent;
      const executionRate = data.budget > 0 ? Math.round((spent / data.budget) * 1000) / 10 : 0;

      byDepartment.push({
        committee: data.committee,
        department: data.department,
        budget: data.budget,
        cumulativeSpent: spent,
        remaining,
        executionRate,
      });
    }

    // 위원회, 부서 순으로 정렬
    byDepartment.sort((a, b) => {
      if (a.committee !== b.committee) {
        return a.committee.localeCompare(b.committee);
      }
      return a.department.localeCompare(b.department);
    });

    // 4. 응답
    const remaining = totalBudget - cumulativeSpent;
    const executionRate = totalBudget > 0 ? Math.round((cumulativeSpent / totalBudget) * 1000) / 10 : 0;

    return NextResponse.json({
      year,
      toQuarter,
      summary: {
        totalBudget,
        cumulativeSpent,
        remaining,
        executionRate,
      },
      quarterlyBreakdown,
      byDepartment,
    });
  } catch (error) {
    console.error('Cumulative report API error:', error);
    return NextResponse.json(
      { error: '누적 현황 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
