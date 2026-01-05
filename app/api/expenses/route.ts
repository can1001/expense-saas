import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { createExpenseSchema, calculateAmount, calculateTotal } from '@/lib/validators';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { deriveRequestTeam } from '@/lib/domain/request-team';
import {
  calculateApprovalLineForExpense,
  ApprovalLineInfo,
} from '@/lib/services/approval-line-service';
import type { ApprovalStatus } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';

// 전체 조회 권한이 있는 역할
const FULL_ACCESS_ROLES = ['admin', 'finance_head', 'accountant', 'admin_assistant'];

// GET /api/expenses - 지출결의서 목록 조회 (역할 기반 필터링)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // 역할에 따른 조회 조건 설정
    const where: Prisma.ExpenseWhereInput = {};

    if (FULL_ACCESS_ROLES.includes(currentUser.role)) {
      // 전체 조회 권한: 필터 없음
    } else if (currentUser.role === 'team_leader') {
      // 팀장: 본인 부서 지출결의서만 조회
      if (currentUser.department) {
        where.department = currentUser.department;
      } else {
        // 부서가 없으면 본인 작성만
        where.userId = currentUser.id;
      }
    } else {
      // 일반 사용자: 본인 작성 지출결의서만 조회
      where.userId = currentUser.id;
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
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
      prisma.expense.count({ where }),
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
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

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
    const isSubmit = body.status === 'PENDING';
    const now = new Date();

    // 제출인 경우 결재선 데이터 준비
    let approvalLineInfo: ApprovalLineInfo | null = null;
    let snapshot: string | null = null;
    type ApprovalStepInfo = ApprovalLineInfo['steps'][number];
    const consecutiveAutoApprovedSteps: ApprovalStepInfo[] = [];
    let autoApprovedCount = 0;
    let firstPendingStep = 1;
    let isAllAutoApproved = false;
    let finalStatus: ApprovalStatus = isSubmit ? 'PENDING' : 'DRAFT';

    if (isSubmit) {
      // 정규화된 테이블 기반 결재선 자동 산출
      const firstItem = itemsWithCalculatedAmount[0];
      const year = validatedData.requestDate.getFullYear();

      try {
        approvalLineInfo = await calculateApprovalLineForExpense(
          validatedData.budgetCategory,
          validatedData.budgetSubcategory,
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

    // 트랜잭션으로 데이터베이스에 저장
    const expense = await prisma.$transaction(async (tx) => {
      // 1. 지출결의서 생성
      const createdExpense = await tx.expense.create({
        data: {
          userId: currentUser.id,
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
          status: finalStatus,
          submittedAt: isSubmit ? now : null,
          approvedAt: isAllAutoApproved ? now : null,
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
            comment: '지출결의서 제출',
            metadata: {
              timestamp: now.toISOString(),
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

    // 결재선 포함해서 반환
    const result = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: {
        items: { orderBy: { order: 'asc' } },
        approvalLine: { include: { steps: true } },
      },
    });

    return NextResponse.json(result, { status: 201 });
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
