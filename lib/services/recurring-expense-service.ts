/**
 * 자동이체 서비스
 *
 * 자동이체 템플릿에서 지출결의서를 생성하고 관리합니다.
 */

import { prisma } from '@/lib/prisma';
import { calculateNextGenerationDate, RecurringFrequency } from '@/lib/recurring-expense';
import { deriveRequestTeam } from '@/lib/domain/request-team';
import { format } from 'date-fns';

interface GenerateExpenseResult {
  success: boolean;
  expenseId?: string;
  error?: string;
}

interface ProcessRecurringExpensesResult {
  processed: number;
  generated: number;
  errors: Array<{
    recurringExpenseId: string;
    error: string;
  }>;
}

/**
 * 단일 자동이체 템플릿에서 지출결의서 생성
 */
export async function generateExpenseFromRecurring(
  recurringExpenseId: string
): Promise<GenerateExpenseResult> {
  try {
    const recurring = await prisma.recurringExpense.findUnique({
      where: { id: recurringExpenseId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            department: true,
          },
        },
      },
    });

    if (!recurring) {
      return { success: false, error: '자동이체를 찾을 수 없습니다.' };
    }

    if (recurring.status !== 'ACTIVE') {
      return { success: false, error: '활성화된 자동이체만 생성할 수 있습니다.' };
    }

    // 종료일 체크
    if (recurring.endDate && recurring.endDate < new Date()) {
      // 종료일이 지났으면 상태를 COMPLETED로 변경
      await prisma.recurringExpense.update({
        where: { id: recurringExpenseId },
        data: { status: 'COMPLETED' },
      });
      return { success: false, error: '자동이체 종료일이 지났습니다.' };
    }

    // 요청 팀 계산
    const requestTeam = deriveRequestTeam(
      recurring.committee,
      recurring.department,
    );

    // 지출결의서 생성 (DRAFT 상태로 생성, 결재선은 제출 시 계산됨)
    const expense = await prisma.expense.create({
      data: {
        userId: recurring.userId,
        committee: recurring.committee,
        department: recurring.department,
        applicantName: recurring.user.username,
        accountHolder: recurring.recipientName, // 수취인 이름을 예금주로 설정
        bankName: recurring.bankName,
        accountNumber: recurring.accountNumber,
        requestAmount: recurring.baseAmount,
        requestDate: new Date(),
        status: 'DRAFT',
        requestTeam,
        recurringExpenseId: recurring.id,
        items: {
          create: [{
            budgetCategory: recurring.budgetCategory,
            budgetSubcategory: recurring.budgetSubcategory,
            budgetDetail: recurring.budgetDetail || '',
            description: `${recurring.name} - ${format(new Date(), 'yyyy년 MM월')}`,
            unitPrice: recurring.baseAmount,
            quantity: 1,
            amount: recurring.baseAmount,
            order: 0,
          }],
        },
      },
    });

    // 다음 생성일 계산 및 업데이트
    const nextGenerationDate = calculateNextGenerationDate(
      recurring.frequency as RecurringFrequency,
      recurring.dayOfMonth,
      recurring.advanceDays
    );

    await prisma.recurringExpense.update({
      where: { id: recurringExpenseId },
      data: {
        lastGeneratedDate: new Date(),
        nextGenerationDate,
      },
    });

    return { success: true, expenseId: expense.id };
  } catch (error) {
    console.error('자동이체 생성 실패:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/**
 * 생성이 필요한 모든 자동이체 처리
 */
export async function processRecurringExpenses(): Promise<ProcessRecurringExpensesResult> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // 생성이 필요한 자동이체 조회
  // - 상태가 ACTIVE
  // - nextGenerationDate가 오늘 이전 또는 오늘
  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: {
      status: 'ACTIVE',
      nextGenerationDate: {
        lte: now,
      },
    },
    orderBy: {
      nextGenerationDate: 'asc',
    },
  });

  const result: ProcessRecurringExpensesResult = {
    processed: recurringExpenses.length,
    generated: 0,
    errors: [],
  };

  // 각 자동이체 처리 (개별 에러 격리)
  for (const recurring of recurringExpenses) {
    try {
      const generateResult = await generateExpenseFromRecurring(recurring.id);

      if (generateResult.success) {
        result.generated++;
      } else {
        result.errors.push({
          recurringExpenseId: recurring.id,
          error: generateResult.error || '알 수 없는 오류',
        });
      }
    } catch (error) {
      // 예상치 못한 예외 발생 시에도 다른 건 계속 처리
      result.errors.push({
        recurringExpenseId: recurring.id,
        error: error instanceof Error ? error.message : '예상치 못한 오류 발생',
      });
      console.error(`[RecurringExpense] 처리 실패 (id: ${recurring.id}):`, error);
    }
  }

  return result;
}

/**
 * 특정 자동이체의 다음 생성일 재계산
 */
export async function recalculateNextGenerationDate(
  recurringExpenseId: string
): Promise<Date | null> {
  const recurring = await prisma.recurringExpense.findUnique({
    where: { id: recurringExpenseId },
    select: {
      frequency: true,
      dayOfMonth: true,
      advanceDays: true,
      status: true,
    },
  });

  if (!recurring || recurring.status !== 'ACTIVE') {
    return null;
  }

  const nextGenerationDate = calculateNextGenerationDate(
    recurring.frequency as RecurringFrequency,
    recurring.dayOfMonth,
    recurring.advanceDays
  );

  await prisma.recurringExpense.update({
    where: { id: recurringExpenseId },
    data: { nextGenerationDate },
  });

  return nextGenerationDate;
}
