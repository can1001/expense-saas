import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createExpenseSchema, calculateAmount, calculateTotal } from '@/lib/validators';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { deriveRequestTeam } from '@/lib/domain/request-team';

// GET /api/expenses - 지출결의서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
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
      prisma.expense.count(),
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

// POST /api/expenses - 지출결의서 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 유효성 검증
    const validatedData = createExpenseSchema.parse(body);

    // 청구팀은 "위원회 + 사역팀(부)"로 강제
    const derivedRequestTeam = deriveRequestTeam(
      validatedData.committee,
      validatedData.department
    );
    if (!derivedRequestTeam) {
      throw new ApiError('청구팀을 생성할 수 없습니다. 위원회/사역팀을 확인해주세요.', 400);
    }
    if (
      typeof body.requestTeam === 'string' &&
      body.requestTeam.trim() !== '' &&
      body.requestTeam !== derivedRequestTeam
    ) {
      throw new ApiError('청구팀은 선택한 위원회/사역팀과 동일해야 합니다.', 400);
    }

    // 항목별 금액 계산 및 순서 할당
    const itemsWithCalculatedAmount = validatedData.items.map((item, index) => ({
      ...item,
      amount: calculateAmount(item.unitPrice, item.quantity),
      order: index + 1,
    }));

    // 전체 청구금액 계산
    const requestAmount = calculateTotal(itemsWithCalculatedAmount);

    // 상태 처리: 클라이언트에서 전달된 status 사용 (기본값: DRAFT)
    const status = body.status === 'PENDING' ? 'PENDING' : 'DRAFT';
    const submittedAt = status === 'PENDING' ? new Date() : null;

    // 데이터베이스에 저장
    const expense = await prisma.expense.create({
      data: {
        committee: validatedData.committee,
        department: validatedData.department,
        budgetCategory: validatedData.budgetCategory,
        budgetSubcategory: validatedData.budgetSubcategory,
        expenseDate: validatedData.expenseDate,
        requestAmount,
        requestDate: validatedData.requestDate,
        requestTeam: derivedRequestTeam,
        applicantName: validatedData.applicantName,
        applicantTitle: validatedData.applicantTitle,
        bankName: validatedData.bankName,
        accountNumber: validatedData.accountNumber,
        accountHolder: validatedData.accountHolder,
        status,
        submittedAt,
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
  } catch (error: any) {
    if (error.name === 'ZodError' && error.errors) {
      const errorMessages = error.errors.map((err: any) =>
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
