import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { calculateNextGenerationDate, RecurringFrequency } from '@/lib/recurring-expense';
import {
  checkRecurringExpenseAccess,
  canManageAllRecurringExpenses,
} from '@/lib/constants/menu-permissions';
import { z } from 'zod';

// 업데이트 스키마
const updateRecurringExpenseSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  recipientName: z.string().min(1).optional(),
  bankName: z.string().min(1).optional(),
  accountNumber: z.string().min(1).optional(),
  baseAmount: z.number().int().min(0).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  advanceDays: z.number().int().min(0).max(30).optional(),
  endDate: z.date().optional().nullable(),
  // 취소는 DELETE 엔드포인트로 일원화 (deletedAt 동시 세팅을 위해)
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
});

// GET /api/recurring-expenses/[id] - 자동이체 상세 조회
const handleGet: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;

    // 역할 기반 접근 권한 확인
    const accessError = checkRecurringExpenseAccess(user.role);
    if (accessError) {
      throw new ApiError(accessError.error, accessError.status);
    }

    const recurringExpense = await prisma.recurringExpense.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true },
        },
        generatedExpenses: {
          select: {
            id: true,
            requestAmount: true,
            status: true,
            createdAt: true,
            accountHolder: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!recurringExpense) {
      throw new ApiError('자동이체를 찾을 수 없습니다.', 404);
    }

    // 소유권 확인 (전체 관리 권한자는 우회)
    if (
      !canManageAllRecurringExpenses(user.role) &&
      recurringExpense.userId !== user.id
    ) {
      throw new ApiError('조회 권한이 없습니다.', 403);
    }

    return NextResponse.json(recurringExpense);
  } catch (error) {
    return handleApiError(error);
  }
};

// PUT /api/recurring-expenses/[id] - 자동이체 수정
const handlePut: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;

    // 역할 기반 접근 권한 확인
    const accessError = checkRecurringExpenseAccess(user.role);
    if (accessError) {
      throw new ApiError(accessError.error, accessError.status);
    }

    const recurringExpense = await prisma.recurringExpense.findUnique({
      where: { id },
      select: {
        userId: true,
        status: true,
        frequency: true,
        dayOfMonth: true,
        advanceDays: true,
      },
    });

    if (!recurringExpense) {
      throw new ApiError('자동이체를 찾을 수 없습니다.', 404);
    }

    // 소유권 확인 (전체 관리 권한자는 우회)
    if (
      !canManageAllRecurringExpenses(user.role) &&
      recurringExpense.userId !== user.id
    ) {
      throw new ApiError('수정 권한이 없습니다.', 403);
    }

    // 취소/완료 상태는 수정 불가
    if (recurringExpense.status === 'CANCELLED' || recurringExpense.status === 'COMPLETED') {
      throw new ApiError('취소되거나 완료된 자동이체는 수정할 수 없습니다.', 400);
    }

    const body = await request.json();
    const validatedData = updateRecurringExpenseSchema.parse({
      ...body,
      endDate: body.endDate ? new Date(body.endDate) : body.endDate,
    });

    // dayOfMonth나 advanceDays가 변경되면 nextGenerationDate 재계산
    let nextGenerationDate: Date | undefined;
    if (validatedData.dayOfMonth !== undefined || validatedData.advanceDays !== undefined) {
      const newDayOfMonth = validatedData.dayOfMonth ?? recurringExpense.dayOfMonth;
      const newAdvanceDays = validatedData.advanceDays ?? recurringExpense.advanceDays;
      nextGenerationDate = calculateNextGenerationDate(
        recurringExpense.frequency as RecurringFrequency,
        newDayOfMonth,
        newAdvanceDays
      );
    }

    const updated = await prisma.recurringExpense.update({
      where: { id },
      data: {
        ...validatedData,
        ...(nextGenerationDate && { nextGenerationDate }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
};

// DELETE /api/recurring-expenses/[id] - 자동이체 삭제 (취소)
const handleDelete: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;

    // 역할 기반 접근 권한 확인
    const accessError = checkRecurringExpenseAccess(user.role);
    if (accessError) {
      throw new ApiError(accessError.error, accessError.status);
    }

    const recurringExpense = await prisma.recurringExpense.findUnique({
      where: { id },
      select: {
        userId: true,
        status: true,
      },
    });

    if (!recurringExpense) {
      throw new ApiError('자동이체를 찾을 수 없습니다.', 404);
    }

    // 소유권 확인 (전체 관리 권한자는 우회)
    if (
      !canManageAllRecurringExpenses(user.role) &&
      recurringExpense.userId !== user.id
    ) {
      throw new ApiError('삭제 권한이 없습니다.', 403);
    }

    // 이미 취소된 경우
    if (recurringExpense.status === 'CANCELLED') {
      throw new ApiError('이미 취소된 자동이체입니다.', 400);
    }

    // 소프트 삭제: 상태를 CANCELLED로 변경 + 삭제 시각 기록
    await prisma.recurringExpense.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ message: '자동이체가 취소되었습니다.' });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
