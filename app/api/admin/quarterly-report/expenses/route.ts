import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { getCurrentUser } from '@/lib/auth';

// 재정보고서 접근 권한이 있는 역할
const QUARTERLY_REPORT_ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'finance_member'];

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
 * GET /api/admin/quarterly-report/expenses
 * 세목별 상세 지출 내역 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !QUARTERLY_REPORT_ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const quarter = parseInt(searchParams.get('quarter') || '1');
    const budgetCategory = searchParams.get('budgetCategory') || '';
    const budgetSubcategory = searchParams.get('budgetSubcategory') || '';
    const budgetDetail = searchParams.get('budgetDetail') || '';
    const committee = searchParams.get('committee') || '';
    const department = searchParams.get('department') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';

    // 필수 파라미터 검증
    if (!budgetCategory || !budgetSubcategory || !budgetDetail) {
      return NextResponse.json(
        { error: '예산 항목 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    const { startDate, endDate } = getQuarterDateRange(year, quarter);

    // 기본 필터 조건
    const expenseWhere = {
      status: 'APPROVED_FINAL' as const,
      requestDate: {
        gte: startDate,
        lte: endDate,
      },
      ...(committee && { committee }),
      ...(department && { department }),
      ...(paymentStatus && { paymentStatus: paymentStatus as 'PENDING' | 'HOLD' | 'CANCELLED' | 'COMPLETED' }),
    };

    // 해당 세목을 포함하는 지출결의서 조회
    const expensesWithItems = await prisma.expense.findMany({
      where: {
        ...expenseWhere,
        items: {
          some: {
            budgetCategory,
            budgetSubcategory,
            budgetDetail,
          },
        },
      },
      include: {
        items: {
          where: {
            budgetCategory,
            budgetSubcategory,
            budgetDetail,
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { requestDate: 'desc' },
    });

    // 응답 데이터 구성
    const expenses = expensesWithItems.map((expense) => ({
      id: expense.id,
      requestDate: expense.requestDate.toISOString().split('T')[0],
      applicantName: expense.applicantName,
      committee: expense.committee,
      department: expense.department,
      paymentStatus: expense.paymentStatus,
      items: expense.items.map((item) => ({
        description: item.description,
        amount: item.amount,
        budgetDetail: item.budgetDetail,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    }));

    // 요약 정보
    const totalCount = expenses.length;
    const totalAmount = expenses.reduce(
      (sum, exp) => sum + exp.items.reduce((itemSum, item) => itemSum + item.amount, 0),
      0
    );

    return NextResponse.json({
      expenses,
      summary: {
        totalCount,
        totalAmount,
      },
      filterInfo: {
        year,
        quarter,
        budgetCategory,
        budgetSubcategory,
        budgetDetail,
        committee: committee || null,
        department: department || null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
