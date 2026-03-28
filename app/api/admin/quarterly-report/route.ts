import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * 분기별 날짜 범위 계산
 */
function getQuarterDateRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { startDate, endDate };
}

/**
 * 연간 날짜 범위 계산
 */
function getYearDateRange(year: number) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  return { startDate, endDate };
}

/**
 * GET /api/admin/quarterly-report
 * 분기별 회계보고 데이터 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const quarter = parseInt(searchParams.get('quarter') || String(Math.floor(new Date().getMonth() / 3) + 1));
    const department = searchParams.get('department') || '';
    const category = searchParams.get('category') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';

    const { startDate, endDate } = getQuarterDateRange(year, quarter);
    const { startDate: yearStartDate, endDate: yearEndDate } = getYearDateRange(year);

    // 기본 필터 조건
    const baseWhere = {
      status: 'APPROVED_FINAL' as const,
      requestDate: {
        gte: startDate,
        lte: endDate,
      },
      ...(department && { department }),
      ...(paymentStatus && { paymentStatus: paymentStatus as 'PENDING' | 'HOLD' | 'CANCELLED' | 'COMPLETED' }),
    };

    // 계정과목 필터가 있는 경우 ExpenseItem 조건 추가
    const categoryWhere = category
      ? {
          items: {
            some: { budgetCategory: category },
          },
        }
      : {};

    const finalWhere = { ...baseWhere, ...categoryWhere };

    // 1. 요약 통계
    const [totalStats, completedStats, pendingStats] = await Promise.all([
      prisma.expense.aggregate({
        where: finalWhere,
        _count: { id: true },
        _sum: { requestAmount: true },
      }),
      prisma.expense.aggregate({
        where: { ...finalWhere, paymentStatus: 'COMPLETED' },
        _sum: { requestAmount: true },
      }),
      prisma.expense.aggregate({
        where: { ...finalWhere, paymentStatus: 'PENDING' },
        _sum: { requestAmount: true },
      }),
    ]);

    // 2. 월별 집계 (requestDate 기준)
    const expenses = await prisma.expense.findMany({
      where: finalWhere,
      select: {
        requestDate: true,
        requestAmount: true,
      },
    });

    // JS에서 월별 그룹핑
    const monthlyMap = new Map<number, { count: number; amount: number }>();
    for (let m = 1; m <= 3; m++) {
      monthlyMap.set(m, { count: 0, amount: 0 });
    }

    expenses.forEach((exp) => {
      const month = exp.requestDate.getMonth() - (quarter - 1) * 3 + 1;
      if (month >= 1 && month <= 3) {
        const current = monthlyMap.get(month)!;
        current.count += 1;
        current.amount += exp.requestAmount;
      }
    });

    const totalAmount = totalStats._sum.requestAmount || 0;
    const byMonth = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month: (quarter - 1) * 3 + month,
      monthLabel: `${(quarter - 1) * 3 + month}월`,
      count: data.count,
      amount: data.amount,
      ratio: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 1000) / 10 : 0,
    }));

    // 3. 부서별 집계
    const departmentAggregation = await prisma.expense.groupBy({
      by: ['committee', 'department'],
      where: finalWhere,
      _count: { id: true },
      _sum: { requestAmount: true },
      orderBy: [{ committee: 'asc' }, { department: 'asc' }],
    });

    // 3-1. 부서+계정과목 교차 집계 (상세내역용)
    const departmentCategoryItems = await prisma.expenseItem.findMany({
      where: { expense: finalWhere },
      select: {
        budgetCategory: true,
        budgetSubcategory: true,
        amount: true,
        expense: {
          select: {
            committee: true,
            department: true,
          },
        },
      },
    });

    // 부서별로 계정과목 집계
    const deptCategoryMap = new Map<string, Map<string, { count: number; amount: number }>>();
    departmentCategoryItems.forEach((item) => {
      const deptKey = `${item.expense.committee}|${item.expense.department}`;
      const catKey = `${item.budgetCategory}|${item.budgetSubcategory}`;

      if (!deptCategoryMap.has(deptKey)) {
        deptCategoryMap.set(deptKey, new Map());
      }

      const catMap = deptCategoryMap.get(deptKey)!;
      const existing = catMap.get(catKey) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += item.amount;
      catMap.set(catKey, existing);
    });

    const byDepartment = departmentAggregation.map((item) => {
      const deptKey = `${item.committee}|${item.department}`;
      const deptAmount = item._sum.requestAmount || 0;
      const catMap = deptCategoryMap.get(deptKey) || new Map();

      // 계정과목별 상세내역 생성
      const categoryDetails = Array.from(catMap.entries())
        .map(([catKey, data]) => {
          const [category, subcategory] = catKey.split('|');
          return {
            category,
            subcategory,
            count: data.count,
            amount: data.amount,
            ratio: deptAmount > 0 ? Math.round((data.amount / deptAmount) * 1000) / 10 : 0,
          };
        })
        .sort((a, b) => a.category.localeCompare(b.category) || a.subcategory.localeCompare(b.subcategory));

      return {
        committee: item.committee,
        department: item.department,
        count: item._count.id,
        amount: deptAmount,
        ratio: totalAmount > 0 ? Math.round((deptAmount / totalAmount) * 1000) / 10 : 0,
        categoryDetails,
      };
    });

    // 4. 예산 데이터 조회 (BudgetCategory → BudgetSubcategory → BudgetDetail → BudgetDetailYear)
    const budgetCategories = await prisma.budgetCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            details: {
              where: { isActive: true },
              include: {
                yearSettings: {
                  where: { year, isActive: true },
                },
              },
            },
          },
        },
      },
    });

    // 예산항별/예산목별 예산액 집계
    const budgetByCategory = new Map<string, number>();
    const budgetBySubcategory = new Map<string, number>();
    let totalBudgetAmount = 0;

    budgetCategories.forEach((cat) => {
      let catTotal = 0;
      cat.subcategories.forEach((sub) => {
        let subTotal = 0;
        sub.details.forEach((detail) => {
          const budgetAmount = detail.yearSettings[0]?.budgetAmount || 0;
          subTotal += budgetAmount;
        });
        budgetBySubcategory.set(`${cat.name}|${sub.name}`, subTotal);
        catTotal += subTotal;
      });
      budgetByCategory.set(cat.name, catTotal);
      totalBudgetAmount += catTotal;
    });

    // 5. 계정과목별 집계 (ExpenseItem 기준)
    const itemBaseWhere = {
      expense: finalWhere,
    };

    const categoryAggregation = await prisma.expenseItem.groupBy({
      by: ['budgetCategory', 'budgetSubcategory'],
      where: itemBaseWhere,
      _count: { id: true },
      _sum: { amount: true },
      orderBy: [{ budgetCategory: 'asc' }, { budgetSubcategory: 'asc' }],
    });

    // 예산항별로 그룹핑하고 예산목을 하위로 정리 (예산 정보 포함)
    const categoryMap = new Map<string, {
      category: string;
      count: number;
      spentAmount: number;
      budgetAmount: number;
      subcategories: Array<{
        subcategory: string;
        count: number;
        spentAmount: number;
        budgetAmount: number;
      }>;
    }>();

    let itemTotalAmount = 0;
    categoryAggregation.forEach((item) => {
      itemTotalAmount += item._sum.amount || 0;

      if (!categoryMap.has(item.budgetCategory)) {
        categoryMap.set(item.budgetCategory, {
          category: item.budgetCategory,
          count: 0,
          spentAmount: 0,
          budgetAmount: budgetByCategory.get(item.budgetCategory) || 0,
          subcategories: [],
        });
      }

      const cat = categoryMap.get(item.budgetCategory)!;
      cat.count += item._count.id;
      cat.spentAmount += item._sum.amount || 0;

      const subBudget = budgetBySubcategory.get(`${item.budgetCategory}|${item.budgetSubcategory}`) || 0;
      cat.subcategories.push({
        subcategory: item.budgetSubcategory,
        count: item._count.id,
        spentAmount: item._sum.amount || 0,
        budgetAmount: subBudget,
      });
    });

    // 지출이 없는 예산항도 포함
    budgetCategories.forEach((cat) => {
      if (!categoryMap.has(cat.name) && budgetByCategory.get(cat.name)! > 0) {
        categoryMap.set(cat.name, {
          category: cat.name,
          count: 0,
          spentAmount: 0,
          budgetAmount: budgetByCategory.get(cat.name) || 0,
          subcategories: cat.subcategories
            .filter((sub) => (budgetBySubcategory.get(`${cat.name}|${sub.name}`) || 0) > 0)
            .map((sub) => ({
              subcategory: sub.name,
              count: 0,
              spentAmount: 0,
              budgetAmount: budgetBySubcategory.get(`${cat.name}|${sub.name}`) || 0,
            })),
        });
      }
    });

    const byCategory = Array.from(categoryMap.values())
      .sort((a, b) => a.category.localeCompare(b.category))
      .map((cat) => {
        // 연간 기준
        const executionRate = cat.budgetAmount > 0
          ? Math.round((cat.spentAmount / cat.budgetAmount) * 1000) / 10
          : 0;
        // 분기 기준
        const quarterlyBudget = Math.round(cat.budgetAmount / 4);
        const quarterlyRemaining = quarterlyBudget - cat.spentAmount;
        const quarterlyExecutionRate = quarterlyBudget > 0
          ? Math.round((cat.spentAmount / quarterlyBudget) * 1000) / 10
          : 0;
        return {
          ...cat,
          remainingAmount: cat.budgetAmount - cat.spentAmount,
          executionRate,
          quarterlyBudget,
          quarterlyRemaining,
          quarterlyExecutionRate,
          ratio: itemTotalAmount > 0 ? Math.round((cat.spentAmount / itemTotalAmount) * 1000) / 10 : 0,
          subcategories: cat.subcategories.map((sub) => {
            // 연간 기준
            const subExecutionRate = sub.budgetAmount > 0
              ? Math.round((sub.spentAmount / sub.budgetAmount) * 1000) / 10
              : 0;
            // 분기 기준
            const subQuarterlyBudget = Math.round(sub.budgetAmount / 4);
            const subQuarterlyRemaining = subQuarterlyBudget - sub.spentAmount;
            const subQuarterlyExecutionRate = subQuarterlyBudget > 0
              ? Math.round((sub.spentAmount / subQuarterlyBudget) * 1000) / 10
              : 0;
            return {
              ...sub,
              remainingAmount: sub.budgetAmount - sub.spentAmount,
              executionRate: subExecutionRate,
              quarterlyBudget: subQuarterlyBudget,
              quarterlyRemaining: subQuarterlyRemaining,
              quarterlyExecutionRate: subQuarterlyExecutionRate,
              ratio: itemTotalAmount > 0 ? Math.round((sub.spentAmount / itemTotalAmount) * 1000) / 10 : 0,
            };
          }),
        };
      });

    // 6. 연간 총지출 조회 (1월~12월)
    const yearlySpentStats = await prisma.expense.aggregate({
      where: {
        status: 'APPROVED_FINAL',
        requestDate: { gte: yearStartDate, lte: yearEndDate },
      },
      _sum: { requestAmount: true },
    });
    const yearlySpent = yearlySpentStats._sum.requestAmount || 0;

    // 7. 필터 옵션 (부서, 예산항 목록)
    const [departments, categories] = await Promise.all([
      prisma.expense.findMany({
        where: {
          status: 'APPROVED_FINAL',
          requestDate: { gte: startDate, lte: endDate },
        },
        select: { committee: true, department: true },
        distinct: ['committee', 'department'],
        orderBy: [{ committee: 'asc' }, { department: 'asc' }],
      }),
      prisma.expenseItem.findMany({
        where: {
          expense: {
            status: 'APPROVED_FINAL',
            requestDate: { gte: startDate, lte: endDate },
          },
        },
        select: { budgetCategory: true },
        distinct: ['budgetCategory'],
        orderBy: { budgetCategory: 'asc' },
      }),
    ]);

    // 연간 집행률 계산
    const quarterlySpent = totalStats._sum.requestAmount || 0;
    const yearlyRemaining = totalBudgetAmount - yearlySpent;
    const yearlyExecutionRate = totalBudgetAmount > 0
      ? Math.round((yearlySpent / totalBudgetAmount) * 1000) / 10
      : 0;

    // 분기별 집행률 계산 (분기 예산 = 연간 예산 / 4)
    const quarterlyBudget = Math.round(totalBudgetAmount / 4);
    const quarterlyRemaining = quarterlyBudget - quarterlySpent;
    const quarterlyExecutionRate = quarterlyBudget > 0
      ? Math.round((quarterlySpent / quarterlyBudget) * 1000) / 10
      : 0;

    return NextResponse.json({
      year,
      quarter,
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      summary: {
        totalExpenses: totalStats._count.id,
        totalAmount: totalStats._sum.requestAmount || 0,
        completedAmount: completedStats._sum.requestAmount || 0,
        pendingAmount: pendingStats._sum.requestAmount || 0,
      },
      budgetSummary: {
        // 연간
        totalBudget: totalBudgetAmount,
        yearlySpent,
        yearlyRemaining,
        yearlyExecutionRate,
        // 분기별
        quarterlyBudget,
        quarterlySpent,
        quarterlyRemaining,
        quarterlyExecutionRate,
      },
      byMonth,
      byDepartment,
      byCategory,
      filterOptions: {
        departments: departments.map((d) => ({ committee: d.committee, department: d.department })),
        categories: categories.map((c) => c.budgetCategory),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
