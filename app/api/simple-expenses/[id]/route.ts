import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  updateSimpleExpenseSchema,
  calculateAmount,
  calculateTotalAmount,
} from '@/lib/schemas/simple-expense-schema';
import { deleteImages } from '@/lib/cloudinary';
import { handleApiError, ApiError } from '@/lib/api/error-handler';

// GET /api/simple-expenses/[id] - 간편 지출결의서 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const expense = await prisma.simpleExpense.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: {
            order: 'asc',
          },
        },
        attachments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!expense) {
      throw new ApiError('지출결의서를 찾을 수 없습니다.', 404);
    }

    return NextResponse.json(expense);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/simple-expenses/[id] - 간편 지출결의서 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 유효성 검증
    const validatedData = updateSimpleExpenseSchema.parse(body);

    // 기존 항목 삭제
    await prisma.simpleExpenseItem.deleteMany({
      where: { expenseId: id },
    });

    // 항목별 금액 계산 및 순서 할당
    const itemsWithCalculatedAmount = validatedData.items?.map((item, index) => ({
      budgetCategory: item.budgetCategory,
      budgetSubcategory: item.budgetSubcategory,
      budgetDetail: item.budgetDetail,
      description: item.description,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      amount: calculateAmount(item.unitPrice, item.quantity),
      order: index + 1,
    })) || [];

    // 전체 청구금액 계산
    const requestAmount = itemsWithCalculatedAmount.length > 0
      ? calculateTotalAmount(itemsWithCalculatedAmount)
      : undefined;

    // 데이터베이스 업데이트
    const expense = await prisma.simpleExpense.update({
      where: { id },
      data: {
        ...(validatedData.expenseDate !== undefined && { expenseDate: validatedData.expenseDate }),
        ...(requestAmount !== undefined && { requestAmount }),
        ...(validatedData.requestDate && { requestDate: validatedData.requestDate }),
        ...(validatedData.applicantName && { applicantName: validatedData.applicantName }),
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

// DELETE /api/simple-expenses/[id] - 간편 지출결의서 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 첨부파일 정보 가져오기
    const attachments = await prisma.simpleExpenseAttachment.findMany({
      where: { expenseId: id },
      select: { publicId: true },
    });

    // Cloudinary에서 이미지 삭제
    if (attachments.length > 0) {
      const publicIds = attachments.map(att => att.publicId);
      try {
        await deleteImages(publicIds);
      } catch (cloudinaryError) {
        console.error('Error deleting images from Cloudinary:', cloudinaryError);
        // Cloudinary 삭제 실패해도 DB는 삭제 진행
      }
    }

    // 데이터베이스에서 지출결의서 삭제 (Cascade로 첨부파일도 함께 삭제됨)
    await prisma.simpleExpense.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
