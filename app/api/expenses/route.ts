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
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { getEffectiveRole, CURRENT_YEAR } from '@/lib/services/user-service';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';

// 서버 정렬 허용 키 — Expense 직속 컬럼 8개
// 예산 3개(budgetCategory/Subcategory/Detail)는 ExpenseItem 1:N 관계라 Prisma orderBy 불가 → 클라에서 비활성화
const SORTABLE_KEYS = [
  'requestDate',
  'applicantName',
  'requestAmount',
  'committee',
  'status',
  'approvedAt',
  'expenseDate',
  'paymentStatus',
  'createdAt',
] as const;
type SortableKey = (typeof SORTABLE_KEYS)[number];

function isSortableKey(value: string): value is SortableKey {
  return (SORTABLE_KEYS as readonly string[]).includes(value);
}

// GET /api/expenses - 지출결의서 목록 조회 (역할 기반 필터링 + 사용자 필터 + 서버 정렬/페이지네이션 + 합계)
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    // 연도별 유효 역할 조회 (UserYearRole 테이블 기준)
    const { role: effectiveRole, departmentId: effectiveDepartmentId } =
      await getEffectiveRole(user.id, CURRENT_YEAR);

    // departmentId가 있으면 해당 부서 경로 조회
    let effectiveDepartment: string | null = null;
    if (effectiveDepartmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: effectiveDepartmentId },
        include: { committee: { select: { name: true } } },
      });
      if (dept) {
        effectiveDepartment = `${dept.committee.name}/${dept.name}`;
      }
    }

    // 역할 기반 권한 where 절
    const permissionWhere: Prisma.ExpenseWhereInput = {};

    if (roleHasPermission(effectiveRole, PERMISSIONS.EXPENSE_READ_ALL)) {
      // 전체 조회 권한: 필터 없음
    } else if (effectiveRole === 'team_leader') {
      const department = effectiveDepartment ?? user.department;
      if (department) {
        permissionWhere.department = department;
      } else {
        permissionWhere.userId = user.id;
      }
    } else {
      permissionWhere.userId = user.id;
    }

    // 사용자 필터 (쿼리스트링)
    const userFilters: Prisma.ExpenseWhereInput[] = [];

    const committee = searchParams.get('committee');
    if (committee) userFilters.push({ committee });

    const department = searchParams.get('department');
    if (department) userFilters.push({ department });

    const category = searchParams.get('category');
    if (category) {
      // 예산 카테고리는 ExpenseItem 컬럼이므로 items.some 으로 매칭
      userFilters.push({ items: { some: { budgetCategory: category } } });
    }

    const startDate = searchParams.get('startDate');
    if (startDate) userFilters.push({ requestDate: { gte: new Date(startDate) } });

    const endDate = searchParams.get('endDate');
    if (endDate) userFilters.push({ requestDate: { lte: new Date(endDate) } });

    const minAmount = searchParams.get('minAmount');
    if (minAmount) userFilters.push({ requestAmount: { gte: Number(minAmount) } });

    const maxAmount = searchParams.get('maxAmount');
    if (maxAmount) userFilters.push({ requestAmount: { lte: Number(maxAmount) } });

    const status = searchParams.get('status');
    if (status) userFilters.push({ status: status as Prisma.ExpenseWhereInput['status'] });

    // 지급 상태 필터: 최종 승인된 항목 중 paymentStatus 일치 (클라 기존 동작 보존)
    const paymentStatus = searchParams.get('paymentStatus');
    if (paymentStatus) {
      userFilters.push({
        status: 'APPROVED_FINAL',
        paymentStatus: paymentStatus as Prisma.ExpenseWhereInput['paymentStatus'],
      });
    }

    const approvedStart = searchParams.get('approvedStart');
    if (approvedStart) userFilters.push({ approvedAt: { gte: new Date(approvedStart) } });

    const approvedEnd = searchParams.get('approvedEnd');
    if (approvedEnd) userFilters.push({ approvedAt: { lte: new Date(approvedEnd) } });

    const expenseStart = searchParams.get('expenseStart');
    if (expenseStart) userFilters.push({ expenseDate: { gte: new Date(expenseStart) } });

    const expenseEnd = searchParams.get('expenseEnd');
    if (expenseEnd) userFilters.push({ expenseDate: { lte: new Date(expenseEnd) } });

    // 검색어: applicantName/committee/department/items.budgetCategory contains (대소문자 무시)
    const q = searchParams.get('q');
    if (q && q.trim()) {
      const query = q.trim();
      userFilters.push({
        OR: [
          { applicantName: { contains: query, mode: 'insensitive' } },
          { committee: { contains: query, mode: 'insensitive' } },
          { department: { contains: query, mode: 'insensitive' } },
          { items: { some: { budgetCategory: { contains: query, mode: 'insensitive' } } } },
        ],
      });
    }

    // 권한 where 와 사용자 필터를 AND 로 결합
    const where: Prisma.ExpenseWhereInput =
      userFilters.length > 0 ? { AND: [permissionWhere, ...userFilters] } : permissionWhere;

    // 정렬
    const sortByRaw = searchParams.get('sortBy') || 'createdAt';
    const sortDirRaw = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
    const sortBy: SortableKey = isSortableKey(sortByRaw) ? sortByRaw : 'createdAt';
    const orderBy: Prisma.ExpenseOrderByWithRelationInput = { [sortBy]: sortDirRaw };

    const [expenses, total, aggregate] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          items: {
            orderBy: {
              order: 'asc',
            },
          },
          attachments: {
            select: {
              id: true,
              secureUrl: true,
              format: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
            take: 1,
          },
        },
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        where,
        _sum: { requestAmount: true },
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
      aggregates: {
        totalCount: total,
        totalRequestAmount: aggregate._sum.requestAmount ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
};

// POST /api/expenses - 지출결의서 생성
const handlePost: UserApiHandler = async (request, { user }) => {
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

    // 첫 번째 항목에서 예산 정보 가져오기
    const firstItem = validatedData.items[0];

    // 항목별 금액 계산 및 순서 할당 (항/목/세목 포함)
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
    const requestAmount = calculateTotal(itemsWithCalculatedAmount);

    // 상태 처리: 클라이언트에서 전달된 status 사용 (기본값: DRAFT)
    // 신규 생성 시 PENDING 직접 제출은 서명 누락 문제가 있으므로 차단
    // 제출은 /api/expenses/[id]/submit API를 통해 서명과 함께 처리해야 함
    if (body.status === 'PENDING') {
      throw new ApiError(
        '신규 생성 시 직접 제출은 지원하지 않습니다. DRAFT로 저장 후 submit API를 사용해주세요.',
        400
      );
    }

    const isSubmit = false; // 신규 생성은 항상 DRAFT
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
      // 정규화된 테이블 기반 결재선 자동 산출 (첫 번째 항목 기준)
      const year = validatedData.requestDate.getFullYear();

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

    // 트랜잭션으로 데이터베이스에 저장
    const expense = await prisma.$transaction(async (tx) => {
      // 1. 지출결의서 생성 (budgetCategory, budgetSubcategory는 items에만 저장)
      const createdExpense = await tx.expense.create({
        data: {
          userId: user.id,
          committee: validatedData.committee,
          department: validatedData.department,
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
};

// Export handlers with auth wrapper
export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
