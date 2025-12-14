import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createSimpleExpenseSchema,
  calculateAmount,
  calculateTotalAmount,
} from '@/lib/schemas/simple-expense-schema';
import { handleApiError } from '@/lib/api/error-handler';

// GET /api/simple-expenses - 간편 지출결의서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      prisma.simpleExpense.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          items: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      }),
      prisma.simpleExpense.count(),
    ]);

    return NextResponse.json({
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/simple-expenses - 간편 지출결의서 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 유효성 검증
    const validatedData = createSimpleExpenseSchema.parse(body);

    // 항목별 금액 계산 및 순서 할당
    const itemsWithCalculatedAmount = validatedData.items.map((item, index) => ({
      budgetCategory: item.budgetCategory,
      budgetSubcategory: item.budgetSubcategory,
      budgetDetail: item.budgetDetail,
      description: item.description,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      amount: calculateAmount(item.unitPrice, item.quantity),
      order: index + 1,
    }));

    // 전체 청구금액 계산
    const requestAmount = calculateTotalAmount(itemsWithCalculatedAmount);

    // 데이터베이스에 저장
    const expense = await prisma.simpleExpense.create({
      data: {
        expenseDate: validatedData.expenseDate,
        requestAmount,
        requestDate: validatedData.requestDate,
        applicantName: validatedData.applicantName,
        bankName: validatedData.bankName,
        accountNumber: validatedData.accountNumber,
        accountHolder: validatedData.accountHolder,
        items: {
          create: itemsWithCalculatedAmount,
        },
      },
      include: {
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      const zodError = error as { errors: Array<{ path: string[]; message: string }> };
      const errorMessages = zodError.errors.map((err) =>
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return NextResponse.json(
        { error: '입력 데이터가 유효하지 않습니다.', details: errorMessages },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}
