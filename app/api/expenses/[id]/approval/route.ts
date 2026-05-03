import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  canModifyApprovalLine,
  createApprovalSnapshot,
} from '@/lib/approval-engine';
import { getUsedAmountByDetail } from '@/lib/services/budget-service';

/**
 * 세목별 예산 정보 조회 (결재자용)
 */
async function getBudgetInfoForItems(
  items: { budgetDetail: string; amount: number }[],
  year: number,
  excludeExpenseId?: string
) {
  // 세목 이름 목록 추출 (중복 제거)
  const budgetDetailNames = [...new Set(items.map((item) => item.budgetDetail))];

  // BudgetDetail + BudgetDetailYear 조회
  const budgetDetails = await prisma.budgetDetail.findMany({
    where: {
      name: { in: budgetDetailNames },
      isActive: true,
    },
    include: {
      yearSettings: {
        where: { year },
      },
    },
  });

  // 실시간 사용금액 조회 (1차 승인 이상, 현재 지출결의서 제외)
  const usedAmountMap = await getUsedAmountByDetail(budgetDetailNames, year, excludeExpenseId);

  // 세목별 청구금액 합산
  const requestAmountByDetail: Record<string, number> = {};
  for (const item of items) {
    requestAmountByDetail[item.budgetDetail] =
      (requestAmountByDetail[item.budgetDetail] || 0) + item.amount;
  }

  // 예산 정보 매핑
  return budgetDetailNames.map((detailName) => {
    const detail = budgetDetails.find((d) => d.name === detailName);
    const yearSetting = detail?.yearSettings?.[0];

    const budgetAmount = yearSetting?.budgetAmount ?? 0;
    const usedAmount = usedAmountMap.get(detailName) ?? 0;
    const remainingAmount = budgetAmount - usedAmount;
    const requestAmount = requestAmountByDetail[detailName] || 0;
    const afterApproval = remainingAmount - requestAmount;

    return {
      budgetDetailName: detailName,
      budgetAmount,
      usedAmount,
      remainingAmount,
      requestAmount,
      afterApproval,
      isOverBudget: afterApproval < 0,
    };
  });
}

/**
 * GET /api/expenses/[id]/approval
 * 결재선 조회
 * Query params:
 *   - approverName: 현재 사용자 이름 (결재자인 경우 예산 정보 포함)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const approverName = searchParams.get('approverName');

    const expense = await prisma.expense.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        applicantName: true,
        requestAmount: true,
        requestDate: true,
        submittedAt: true,
        approvedAt: true,
        rejectedAt: true,
        items: {
          select: {
            budgetDetail: true,
            amount: true,
          },
        },
        approvalLine: {
          include: {
            steps: {
              orderBy: { stepNumber: 'asc' },
            },
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

    // 결재 로그도 함께 조회
    const logs = await prisma.approvalLog.findMany({
      where: { expenseId: id },
      orderBy: { createdAt: 'desc' },
    });

    // 결재자인지 확인 (결재선에 포함된 사람)
    const isApprover =
      approverName &&
      expense.approvalLine?.steps.some(
        (step) => step.approverName === approverName
      );

    // 신청자인지 확인
    const isApplicant = approverName === expense.applicantName;

    // 결재자 또는 신청자인 경우 예산 정보 추가
    // 현재 지출결의서 ID를 제외하여 이중 차감 방지
    let budgetInfo = null;
    if ((isApprover || isApplicant) && expense.items.length > 0) {
      const year = expense.requestDate
        ? new Date(expense.requestDate).getFullYear()
        : new Date().getFullYear();
      budgetInfo = await getBudgetInfoForItems(expense.items, year, id);
    }

    return NextResponse.json({
      expense: {
        id: expense.id,
        status: expense.status,
        applicantName: expense.applicantName,
        requestAmount: expense.requestAmount,
        submittedAt: expense.submittedAt,
        approvedAt: expense.approvedAt,
        rejectedAt: expense.rejectedAt,
      },
      approvalLine: expense.approvalLine,
      logs,
      budgetInfo, // 결재자 또는 신청자인 경우에만 포함
    });
  } catch (error: any) {
    console.error('Get approval error:', error);
    return NextResponse.json(
      { error: '결재선 조회 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/expenses/[id]/approval
 * 결재선 수정 (제출 전만 가능)
 *
 * Body: {
 *   actorName: string,
 *   steps: ApprovalStepInput[]
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actorName, steps } = body;

    if (!actorName) {
      return NextResponse.json(
        { error: '수정자 이름이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: '결재 단계 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    // 지출결의서 조회
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        approvalLine: {
          include: {
            steps: true,
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

    // 수정 권한 검증
    const validation = canModifyApprovalLine(
      expense.status,
      actorName,
      expense.applicantName
    );

    if (!validation.allowed) {
      return NextResponse.json({ error: validation.reason }, { status: 403 });
    }

    // 이전 결재선 스냅샷 저장
    const beforeSnapshot = expense.approvalLine
      ? {
          steps: expense.approvalLine.steps,
          totalSteps: expense.approvalLine.totalSteps,
        }
      : null;

    // 새 스냅샷 생성
    const newSnapshot = createApprovalSnapshot({
      steps,
      totalSteps: steps.length,
    });

    // 트랜잭션으로 결재선 수정
    const result = await prisma.$transaction(async (tx) => {
      // 1. 기존 결재선 삭제
      if (expense.approvalLine) {
        await tx.approvalLine.delete({
          where: { id: expense.approvalLine.id },
        });
      }

      // 2. 새 결재선 생성
      const approvalLine = await tx.approvalLine.create({
        data: {
          expenseId: id,
          currentStep: 1,
          totalSteps: steps.length,
          isUrgent: false,
          snapshot: newSnapshot,
          steps: {
            create: steps.map((step: any) => ({
              stepNumber: step.stepNumber,
              stepName: step.stepName,
              approverName: step.approverName,
              approverEmail: step.approverEmail,
              approverTitle: step.approverTitle,
              isRequired: step.isRequired,
              isParallel: step.isParallel || false,
              status: 'PENDING',
            })),
          },
        },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' },
          },
        },
      });

      // 3. 감사 로그 생성
      await tx.approvalLog.create({
        data: {
          expenseId: id,
          action: 'MODIFY_LINE',
          actorName,
          actorRole: '작성자',
          previousStatus: expense.status,
          newStatus: expense.status,
          comment: '결재선 수정',
          metadata: {
            userAgent: request.headers.get('user-agent') || '',
            timestamp: new Date().toISOString(),
          },
          beforeSnapshot: beforeSnapshot ?? undefined,
          afterSnapshot: JSON.parse(newSnapshot),
        },
      });

      return approvalLine;
    });

    return NextResponse.json({
      success: true,
      message: '결재선이 수정되었습니다.',
      data: result,
    });
  } catch (error: any) {
    console.error('Update approval error:', error);
    return NextResponse.json(
      { error: '결재선 수정 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
