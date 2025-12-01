import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateExpenseSchema, calculateAmount, calculateTotal } from '@/lib/validators';

// GET /api/expenses/[id] - 지출결의서 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json(
        { error: '지출결의서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    return NextResponse.json(
      { error: '지출결의서를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT /api/expenses/[id] - 지출결의서 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // 유효성 검증
    const validatedData = updateExpenseSchema.parse(body);

    // 기존 항목 삭제
    await prisma.expenseItem.deleteMany({
      where: { expenseId: params.id },
    });

    // 항목별 금액 계산 및 순서 할당
    const itemsWithCalculatedAmount = validatedData.items?.map((item, index) => ({
      ...item,
      amount: calculateAmount(item.unitPrice, item.quantity),
      order: index + 1,
    })) || [];

    // 전체 청구금액 계산
    const requestAmount = itemsWithCalculatedAmount.length > 0
      ? calculateTotal(itemsWithCalculatedAmount)
      : undefined;

    // 데이터베이스 업데이트
    const expense = await prisma.expense.update({
      where: { id: params.id },
      data: {
        ...(validatedData.committee && { committee: validatedData.committee }),
        ...(validatedData.department && { department: validatedData.department }),
        ...(validatedData.budgetCategory && { budgetCategory: validatedData.budgetCategory }),
        ...(validatedData.budgetSubcategory && { budgetSubcategory: validatedData.budgetSubcategory }),
        ...(validatedData.expenseDate !== undefined && { expenseDate: validatedData.expenseDate }),
        ...(requestAmount !== undefined && { requestAmount }),
        ...(validatedData.requestDate && { requestDate: validatedData.requestDate }),
        ...(validatedData.requestTeam && { requestTeam: validatedData.requestTeam }),
        ...(validatedData.applicantName && { applicantName: validatedData.applicantName }),
        ...(validatedData.applicantTitle !== undefined && { applicantTitle: validatedData.applicantTitle }),
        ...(validatedData.bankName && { bankName: validatedData.bankName }),
        ...(validatedData.accountNumber && { accountNumber: validatedData.accountNumber }),
        ...(validatedData.accountHolder && { accountHolder: validatedData.accountHolder }),
        ...(itemsWithCalculatedAmount.length > 0 && {
          items: {
            create: itemsWithCalculatedAmount,
          },
        }),
      },
      include: {
        items: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error updating expense:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '입력 데이터가 유효하지 않습니다.', details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '지출결의서 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/expenses/[id] - 지출결의서 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.expense.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: '지출결의서 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
