import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/approvals
 * 결재 대기 목록 조회
 *
 * Query params:
 * - approverName: 결재자 이름 (필수)
 * - status: 필터 (pending, completed, all) - 기본값: pending
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지 크기 (기본값: 10)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const approverName = searchParams.get('approverName');
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    if (!approverName) {
      return NextResponse.json(
        { error: '결재자 이름이 필요합니다. (approverName)' },
        { status: 400 }
      );
    }

    // pending 상태: isMyTurn 필터링이 필요하므로 별도 처리
    if (status === 'pending') {
      return handlePendingStatus(approverName, page, limit, skip);
    }

    // completed / all 상태: DB 레벨 페이지네이션 적용
    return handleCompletedOrAllStatus(approverName, status, page, limit, skip);
  } catch (error: any) {
    console.error('Get approvals error:', error);
    return NextResponse.json(
      { error: '결재 목록 조회 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * pending 상태 처리 - isMyTurn 필터링 필요
 * 2단계 쿼리로 최적화: ApprovalStep에서 ID 조회 후 ApprovalLine 조회
 */
async function handlePendingStatus(
  approverName: string,
  page: number,
  limit: number,
  skip: number
) {
  // 1단계: ApprovalStep에서 해당 결재자의 PENDING 상태인 approvalLineId 목록 조회
  const pendingSteps = await prisma.approvalStep.findMany({
    where: {
      approverName: approverName,
      status: 'PENDING',
    },
    select: { approvalLineId: true },
    distinct: ['approvalLineId'],
  });

  // 빈 결과 조기 반환
  if (pendingSteps.length === 0) {
    return NextResponse.json({
      approvals: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    });
  }

  const approvalLineIds = pendingSteps.map((s) => s.approvalLineId);

  // 2단계: 해당 ID로 ApprovalLine 조회 (PK 조회로 빠름)
  const approvalLines = await prisma.approvalLine.findMany({
    where: {
      id: { in: approvalLineIds },
      expense: {
        status: {
          in: ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'],
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      expense: {
        include: {
          items: {
            take: 1,  // 첫 번째 항목만 로드
            orderBy: { order: 'asc' },
          },
        },
      },
      steps: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  // 현재 결재자 차례인 건만 필터
  const filteredResults = approvalLines.filter((line) => {
    const currentStep = line.steps.find(
      (step) => step.stepNumber === line.currentStep
    );
    return currentStep?.approverName === approverName;
  });

  const totalFiltered = filteredResults.length;
  const paginatedResults = filteredResults.slice(skip, skip + limit);

  const approvals = mapApprovalLines(paginatedResults, approverName);

  return NextResponse.json({
    approvals,
    pagination: {
      page,
      limit,
      total: totalFiltered,
      totalPages: Math.ceil(totalFiltered / limit),
    },
  });
}

/**
 * completed / all 상태 처리 - DB 레벨 페이지네이션 적용
 * 2단계 쿼리로 최적화: ApprovalStep에서 ID 조회 후 ApprovalLine 조회
 */
async function handleCompletedOrAllStatus(
  approverName: string,
  status: string,
  page: number,
  limit: number,
  skip: number
) {
  // 1단계: ApprovalStep에서 해당 결재자의 approvalLineId 목록 조회
  const stepWhereCondition: any = {
    approverName: approverName,
  };

  if (status === 'completed') {
    stepWhereCondition.status = { in: ['APPROVED', 'REJECTED'] };
  }

  const steps = await prisma.approvalStep.findMany({
    where: stepWhereCondition,
    select: { approvalLineId: true },
    distinct: ['approvalLineId'],
  });

  // 빈 결과 조기 반환
  if (steps.length === 0) {
    return NextResponse.json({
      approvals: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    });
  }

  const approvalLineIds = steps.map((s) => s.approvalLineId);
  const total = approvalLineIds.length;

  // 2단계: 해당 ID로 ApprovalLine 조회 (PK 조회로 빠름)
  const approvalLines = await prisma.approvalLine.findMany({
    where: {
      id: { in: approvalLineIds },
    },
    orderBy: { createdAt: 'desc' },
    skip,  // DB 레벨 페이지네이션
    take: limit,
    include: {
      expense: {
        include: {
          items: {
            take: 1,  // 첫 번째 항목만 로드 (N+1 최적화)
            orderBy: { order: 'asc' },
          },
        },
      },
      steps: {
        orderBy: { stepNumber: 'asc' },
      },
    },
  });

  const approvals = mapApprovalLines(approvalLines, approverName);

  return NextResponse.json({
    approvals,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * ApprovalLine 배열을 응답 형식으로 변환
 */
function mapApprovalLines(lines: any[], approverName: string) {
  return lines.map((line) => {
    const currentStep = line.steps.find(
      (step: any) => step.stepNumber === line.currentStep
    );
    const myStep = line.steps.find(
      (step: any) => step.approverName === approverName
    );
    const firstItem = line.expense.items[0];

    return {
      id: line.expense.id,
      expense: {
        id: line.expense.id,
        committee: line.expense.committee,
        department: line.expense.department,
        budgetCategory: firstItem?.budgetCategory || '',
        budgetSubcategory: firstItem?.budgetSubcategory || '',
        requestAmount: line.expense.requestAmount,
        applicantName: line.expense.applicantName,
        status: line.expense.status,
        submittedAt: line.expense.submittedAt,
        createdAt: line.expense.createdAt,
        items: line.expense.items,
      },
      approvalLine: {
        id: line.id,
        currentStep: line.currentStep,
        totalSteps: line.totalSteps,
        isUrgent: line.isUrgent,
        steps: line.steps,
      },
      myStep: myStep
        ? {
            stepNumber: myStep.stepNumber,
            stepName: myStep.stepName,
            status: myStep.status,
            approvedAt: myStep.approvedAt,
            rejectedAt: myStep.rejectedAt,
            comment: myStep.comment,
          }
        : null,
      isMyTurn: currentStep?.approverName === approverName,
    };
  });
}
