import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createSimpleExpenseSchema,
  calculateAmount,
  calculateTotalAmount,
} from '@/lib/schemas/simple-expense-schema';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { getCurrentUser } from '@/lib/auth';
import { lookupBudgetHierarchy, getManagerIdForDetail } from '@/lib/services/budget-lookup-service';
import { deriveRequestTeam } from '@/lib/domain/request-team';
import {
  calculateApprovalLineForExpense,
  ApprovalLineInfo,
} from '@/lib/services/approval-line-service';
import type { ApprovalStatus } from '@/lib/types';

// GET /api/simple-expenses - 간편 지출결의서 목록 조회
// Note: 간편 지출결의서는 이제 Expense 테이블에 저장되므로,
// /api/expenses를 사용하여 목록을 조회해야 합니다.
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // 간편 지출결의서 (version 4.1.4)만 필터링
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where: {
          version: '4.1.4',
        },
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
      prisma.expense.count({
        where: {
          version: '4.1.4',
        },
      }),
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
// 이제 Expense 테이블에 저장됩니다.
// 첫 번째 항목의 담당자와 같은 담당자의 세목만 등록 가능합니다.
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 유효성 검증
    const validatedData = createSimpleExpenseSchema.parse(body);

    const year = validatedData.requestDate.getFullYear();

    // 첫 번째 항목의 담당자 ID 조회
    const firstItem = validatedData.items[0];
    const firstManagerInfo = await getManagerIdForDetail(
      firstItem.budgetCategory,
      firstItem.budgetSubcategory,
      firstItem.budgetDetail,
      year
    );

    // 모든 항목의 담당자가 첫 번째 항목과 동일한지 검증
    for (let i = 1; i < validatedData.items.length; i++) {
      const item = validatedData.items[i];
      const managerInfo = await getManagerIdForDetail(
        item.budgetCategory,
        item.budgetSubcategory,
        item.budgetDetail,
        year
      );

      if (managerInfo.managerId !== firstManagerInfo.managerId) {
        throw new ApiError(
          `항목 ${i + 1}의 세목 "${item.budgetDetail}"은 결재선이 다릅니다. ` +
          `담당자: "${managerInfo.managerName || '미지정'}", ` +
          `기준 담당자: "${firstManagerInfo.managerName || '미지정'}"`,
          400
        );
      }
    }

    // 첫 번째 항목에서 위원회/사역팀 정보 조회
    const budgetHierarchy = await lookupBudgetHierarchy(
      firstItem.budgetCategory,
      firstItem.budgetSubcategory,
      firstItem.budgetDetail
    );

    if (!budgetHierarchy) {
      throw new ApiError(
        `예산 정보를 찾을 수 없습니다: ${firstItem.budgetCategory} > ${firstItem.budgetSubcategory} > ${firstItem.budgetDetail}`,
        400
      );
    }

    // 청구팀 자동 생성
    const requestTeam = deriveRequestTeam(
      budgetHierarchy.committee,
      budgetHierarchy.department
    );

    if (!requestTeam) {
      throw new ApiError(
        `청구팀을 생성할 수 없습니다: ${budgetHierarchy.committee} ${budgetHierarchy.department}`,
        400
      );
    }

    // 항목별 금액 계산 및 순서 할당 (ExpenseItem에 항/목/세목 저장)
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

    // 상태 처리
    const isSubmit = validatedData.status === 'PENDING';
    const now = new Date();

    // 결재선 처리
    let approvalLineInfo: ApprovalLineInfo | null = null;
    let snapshot: string | null = null;
    type ApprovalStepInfo = ApprovalLineInfo['steps'][number];
    const consecutiveAutoApprovedSteps: ApprovalStepInfo[] = [];
    let autoApprovedCount = 0;
    let firstPendingStep = 1;
    let isAllAutoApproved = false;
    let finalStatus: ApprovalStatus = isSubmit ? 'PENDING' : 'DRAFT';

    if (isSubmit) {
      try {
        approvalLineInfo = await calculateApprovalLineForExpense(
          firstItem.budgetCategory,
          firstItem.budgetSubcategory,
          firstItem.budgetDetail,
          year
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '결재선 산출 실패';
        throw new ApiError(message, 400);
      }

      snapshot = JSON.stringify({
        ...approvalLineInfo,
        snapshotTimestamp: now.toISOString(),
      });

      // 연속된 전결 단계 계산
      for (const step of approvalLineInfo.steps) {
        if (step.isAutoApproved) {
          consecutiveAutoApprovedSteps.push(step);
        } else {
          break;
        }
      }
      autoApprovedCount = consecutiveAutoApprovedSteps.length;
      firstPendingStep = autoApprovedCount + 1;
      isAllAutoApproved = firstPendingStep > approvalLineInfo.totalSteps;

      // 최종 상태 결정
      if (isAllAutoApproved) {
        finalStatus = 'APPROVED_FINAL';
      } else if (autoApprovedCount >= approvalLineInfo.totalSteps) {
        finalStatus = 'APPROVED_FINAL';
      } else if (autoApprovedCount === 2) {
        finalStatus = 'APPROVED_STEP_2';
      } else if (autoApprovedCount === 1) {
        finalStatus = 'APPROVED_STEP_1';
      }
    }

    // 트랜잭션으로 Expense 저장
    const expense = await prisma.$transaction(async (tx) => {
      // 1. Expense 생성 (budgetCategory, budgetSubcategory는 items에만 저장)
      const createdExpense = await tx.expense.create({
        data: {
          userId: currentUser.id,
          committee: budgetHierarchy.committee,
          department: budgetHierarchy.department,
          expenseDate: validatedData.expenseDate,
          requestAmount,
          requestDate: validatedData.requestDate,
          requestTeam,
          applicantName: validatedData.applicantName,
          applicantTitle: null,
          bankName: validatedData.bankName,
          accountNumber: validatedData.accountNumber,
          accountHolder: validatedData.accountHolder,
          status: finalStatus,
          submittedAt: isSubmit ? now : null,
          approvedAt: isAllAutoApproved ? now : null,
          version: '4.1.4', // 간편 지출결의서 버전
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

      // 2. 제출인 경우 결재선 생성
      if (isSubmit && approvalLineInfo && snapshot) {
        const consecutiveStepNumbers = new Set(
          consecutiveAutoApprovedSteps.map((s) => s.stepNumber)
        );

        await tx.approvalLine.create({
          data: {
            expenseId: createdExpense.id,
            currentStep: isAllAutoApproved
              ? approvalLineInfo.totalSteps
              : firstPendingStep,
            totalSteps: approvalLineInfo.totalSteps,
            isUrgent: false,
            snapshot,
            steps: {
              create: approvalLineInfo.steps.map((step) => {
                const isConsecutiveAutoApproved = consecutiveStepNumbers.has(step.stepNumber);
                return {
                  stepNumber: step.stepNumber,
                  stepName: step.stepName,
                  approverName: step.approverName,
                  approverEmail: step.approverEmail || null,
                  approverTitle: step.role,
                  isRequired: true,
                  isParallel: false,
                  status: isConsecutiveAutoApproved ? 'APPROVED' : 'PENDING',
                  approvedAt: isConsecutiveAutoApproved ? now : null,
                  comment: isConsecutiveAutoApproved
                    ? (step.stepName.includes('전결') ? '전결 처리 (1차 자동 승인)' : null)
                    : null,
                };
              }),
            },
          },
        });

        // 3. 감사 로그 생성 - 제출
        await tx.approvalLog.create({
          data: {
            expenseId: createdExpense.id,
            action: 'SUBMIT',
            actorName: validatedData.applicantName,
            actorRole: '작성자',
            previousStatus: 'NEW',
            newStatus: 'PENDING',
            comment: '간편 지출결의서 제출',
            metadata: {
              timestamp: now.toISOString(),
              isSimpleExpense: true,
            },
            afterSnapshot: JSON.parse(snapshot),
          },
        });

        // 4. 전결 단계 감사 로그
        for (const step of consecutiveAutoApprovedSteps) {
          await tx.approvalLog.create({
            data: {
              expenseId: createdExpense.id,
              action: 'APPROVE',
              actorName: step.approverName,
              actorRole: step.stepName,
              stepNumber: step.stepNumber,
              stepName: step.stepName,
              previousStatus:
                step.stepNumber === 1
                  ? 'PENDING'
                  : `APPROVED_STEP_${step.stepNumber - 1}`,
              newStatus:
                step.stepNumber === approvalLineInfo.totalSteps
                  ? 'APPROVED_FINAL'
                  : `APPROVED_STEP_${step.stepNumber}`,
              comment: '전결 처리 (담당자 = 재정팀장)',
              metadata: {
                autoApproved: true,
                isDirectApproval: approvalLineInfo.isDirectApproval,
                timestamp: now.toISOString(),
              },
            },
          });
        }
      }

      return createdExpense;
    });

    // 응답
    const result = {
      success: true,
      message: '지출결의서가 생성되었습니다.',
      id: expense.id,
      expense,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      const zodError = error as unknown as { errors: Array<{ path: string[]; message: string }> };
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
