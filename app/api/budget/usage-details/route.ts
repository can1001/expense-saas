import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import type { ApprovalStatus } from '@/lib/types';

/**
 * GET /api/budget/usage-details - 세목별 사용금액 상세 내역 조회
 *
 * Query Parameters:
 * - budgetDetail: 세목 이름 (필수)
 * - year: 조회 연도 (필수)
 *
 * Returns: 승인된(APPROVED_STEP_1 이상) 지출 항목 목록
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const budgetDetail = searchParams.get('budgetDetail');
    const yearParam = searchParams.get('year');

    if (!budgetDetail) {
      throw new ApiError('세목(budgetDetail) 파라미터가 필요합니다.', 400);
    }

    if (!yearParam) {
      throw new ApiError('연도(year) 파라미터가 필요합니다.', 400);
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year)) {
      throw new ApiError('연도(year)는 숫자여야 합니다.', 400);
    }

    // 해당 연도의 시작일과 종료일
    const startDate = new Date(year, 0, 1); // 1월 1일
    const endDate = new Date(year + 1, 0, 1); // 다음 연도 1월 1일

    // 승인된 상태 목록 (APPROVED_STEP_1 이상)
    const approvedStatuses: ApprovalStatus[] = ['APPROVED_STEP_1', 'APPROVED_STEP_2', 'APPROVED_FINAL'];

    // 세목별 승인된 지출 항목 조회
    const expenseItems = await prisma.expenseItem.findMany({
      where: {
        budgetDetail: budgetDetail,
        expense: {
          status: {
            in: approvedStatuses,
          },
          requestDate: {
            gte: startDate,
            lt: endDate,
          },
        },
      },
      include: {
        expense: {
          select: {
            id: true,
            requestDate: true,
            applicantName: true,
            status: true,
          },
        },
      },
      orderBy: {
        expense: {
          requestDate: 'desc',
        },
      },
    });

    // 응답 데이터 변환
    const usageDetails = expenseItems.map((item) => ({
      id: item.id,
      expenseId: item.expense.id,
      requestDate: item.expense.requestDate.toISOString().split('T')[0],
      applicantName: item.expense.applicantName,
      description: item.description,
      amount: item.amount,
      status: item.expense.status,
    }));

    // 총 금액 계산
    const totalAmount = expenseItems.reduce((sum, item) => sum + item.amount, 0);

    return NextResponse.json({
      budgetDetail,
      year,
      items: usageDetails,
      totalAmount,
      count: usageDetails.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
