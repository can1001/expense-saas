import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import {
  checkRecurringExpenseAccess,
  canManageAllRecurringExpenses,
} from '@/lib/constants/menu-permissions';
import { generateExpenseFromRecurring } from '@/lib/services/recurring-expense-service';

// POST /api/recurring-expenses/[id]/generate
// 자동이체 템플릿에서 지출결의서를 즉시(수동) 생성
// nextGenerationDate가 미래여도 강제 생성 가능 - cron 지연/장애 시 운영용 fallback
const handlePost: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;

    const accessError = checkRecurringExpenseAccess(user.role);
    if (accessError) {
      throw new ApiError(accessError.error, accessError.status);
    }

    const recurringExpense = await prisma.recurringExpense.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!recurringExpense) {
      throw new ApiError('자동이체를 찾을 수 없습니다.', 404);
    }

    if (
      !canManageAllRecurringExpenses(user.role) &&
      recurringExpense.userId !== user.id
    ) {
      throw new ApiError('생성 권한이 없습니다.', 403);
    }

    const result = await generateExpenseFromRecurring(id);

    if (!result.success) {
      throw new ApiError(result.error || '지출결의서 생성에 실패했습니다.', 400);
    }

    return NextResponse.json({ expenseId: result.expenseId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
};

export const POST = withAuth(handlePost);
