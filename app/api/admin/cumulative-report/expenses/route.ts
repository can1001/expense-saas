import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 부서별 세목 상세 지출 내역 API
 *
 * GET /api/admin/cumulative-report/expenses?year=2026&toQuarter=3&committee=기획위원회&department=재정팀
 *
 * 1분기부터 선택한 분기(toQuarter)까지의 해당 부서의 항/목/세목별 지출 상세 조회
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
    const committee = searchParams.get('committee');
    const department = searchParams.get('department');

    if (!committee || !department) {
      return NextResponse.json(
        { error: '위원회(committee)와 부서(department)가 필요합니다.' },
        { status: 400 }
      );
    }

    // 누적 기간 설정 (1분기~선택분기)
    const { start: yearStart } = getQuarterDateRange(year, 1);
    const { end: quarterEnd } = getQuarterDateRange(year, toQuarter);

    // 해당 부서의 APPROVED_FINAL 상태 지출 내역 조회
    const expenses = await prisma.expense.findMany({
      where: {
        status: 'APPROVED_FINAL',
        committee,
        department,
        requestDate: {
          gte: yearStart,
          lte: quarterEnd,
        },
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { requestDate: 'desc' },
    });

    // 항 > 목 > 세목 계층별 집계
    const categoryMap = new Map<
      string,
      {
        amount: number;
        count: number;
        subcategories: Map<
          string,
          {
            amount: number;
            count: number;
            details: Map<string, { amount: number; count: number }>;
          }
        >;
      }
    >();

    for (const expense of expenses) {
      for (const item of expense.items) {
        const category = item.budgetCategory || '(미분류)';
        const subcategory = item.budgetSubcategory || '(미분류)';
        const detail = item.budgetDetail || '(미분류)';

        // 항 레벨
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            amount: 0,
            count: 0,
            subcategories: new Map(),
          });
        }
        const categoryData = categoryMap.get(category)!;
        categoryData.amount += item.amount;
        categoryData.count += 1;

        // 목 레벨
        if (!categoryData.subcategories.has(subcategory)) {
          categoryData.subcategories.set(subcategory, {
            amount: 0,
            count: 0,
            details: new Map(),
          });
        }
        const subcategoryData = categoryData.subcategories.get(subcategory)!;
        subcategoryData.amount += item.amount;
        subcategoryData.count += 1;

        // 세목 레벨
        if (!subcategoryData.details.has(detail)) {
          subcategoryData.details.set(detail, {
            amount: 0,
            count: 0,
          });
        }
        const detailData = subcategoryData.details.get(detail)!;
        detailData.amount += item.amount;
        detailData.count += 1;
      }
    }

    // Map을 배열로 변환
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, categoryData]) => ({
        category,
        amount: categoryData.amount,
        count: categoryData.count,
        subcategories: Array.from(categoryData.subcategories.entries())
          .map(([subcategory, subData]) => ({
            subcategory,
            amount: subData.amount,
            count: subData.count,
            details: Array.from(subData.details.entries())
              .map(([detail, detailData]) => ({
                detail,
                amount: detailData.amount,
                count: detailData.count,
              }))
              .sort((a, b) => b.amount - a.amount),
          }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount);

    // 개별 지출 내역 변환
    const expenseList = expenses.map((expense) => ({
      id: expense.id,
      requestDate: expense.requestDate.toISOString().split('T')[0],
      applicantName: expense.applicantName,
      paymentStatus: expense.paymentStatus,
      items: expense.items.map((item) => ({
        description: item.description,
        amount: item.amount,
        budgetCategory: item.budgetCategory || '',
        budgetSubcategory: item.budgetSubcategory || '',
        budgetDetail: item.budgetDetail,
      })),
    }));

    // 요약 계산
    const totalAmount = expenses.reduce((sum, e) => sum + e.requestAmount, 0);
    const totalCount = expenses.length;

    return NextResponse.json({
      categoryBreakdown,
      expenses: expenseList,
      summary: {
        totalCount,
        totalAmount,
      },
      filterInfo: {
        year,
        toQuarter,
        committee,
        department,
      },
    });
  } catch (error) {
    console.error('Department expense detail API error:', error);
    return NextResponse.json(
      { error: '부서별 지출 상세 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
