import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { getCurrentUser } from '@/lib/auth';
import { createRecurringExpenseSchema, calculateNextGenerationDate, RecurringFrequency } from '@/lib/recurring-expense';

// GET /api/recurring-expenses - 자동이체 목록 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      throw new ApiError('로그인이 필요합니다.', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status'); // ACTIVE, PAUSED, COMPLETED, CANCELLED
    const search = searchParams.get('search')?.trim();

    const where: Prisma.RecurringExpenseWhereInput = {
      userId: currentUser.id,
    };

    // 상태 필터
    if (status) {
      where.status = status as Prisma.EnumRecurringExpenseStatusFilter;
    }

    // 검색 필터 (이름, 수취인명에서 검색)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // cursor 기반 페이지네이션
    const recurringExpenses = await prisma.recurringExpense.findMany({
      where,
      take: limit + 1, // 다음 페이지 존재 여부 확인용
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // cursor 자체는 건너뜀
      }),
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 다음 페이지 존재 여부 확인
    const hasMore = recurringExpenses.length > limit;
    const data = hasMore ? recurringExpenses.slice(0, -1) : recurringExpenses;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    return NextResponse.json({
      recurringExpenses: data,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/recurring-expenses - 자동이체 등록
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      throw new ApiError('로그인이 필요합니다.', 401);
    }

    const body = await request.json();

    // 스키마 검증
    const validatedData = createRecurringExpenseSchema.parse({
      ...body,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });

    // 다음 생성일 계산
    const nextGenerationDate = calculateNextGenerationDate(
      validatedData.frequency as RecurringFrequency,
      validatedData.dayOfMonth,
      validatedData.advanceDays,
      validatedData.startDate
    );

    const recurringExpense = await prisma.recurringExpense.create({
      data: {
        userId: currentUser.id,
        name: validatedData.name,
        description: validatedData.description,
        committee: validatedData.committee,
        department: validatedData.department,
        budgetCategory: validatedData.budgetCategory,
        budgetSubcategory: validatedData.budgetSubcategory,
        budgetDetail: validatedData.budgetDetail,
        recipientName: validatedData.recipientName,
        bankName: validatedData.bankName,
        accountNumber: validatedData.accountNumber,
        baseAmount: validatedData.baseAmount,
        frequency: validatedData.frequency,
        dayOfMonth: validatedData.dayOfMonth,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        advanceDays: validatedData.advanceDays,
        nextGenerationDate,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json(recurringExpense, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
