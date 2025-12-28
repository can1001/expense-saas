import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateApprovalLine,
  createApprovalSnapshot,
  calculateApprovalStatus,
} from '@/lib/approval-engine';

/**
 * POST /api/expenses/[id]/submit
 * 지출결의서 제출 및 결재선 생성
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 지출결의서 조회
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        items: true,
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

    // 제출 가능한 상태인지 확인 (DRAFT 또는 WITHDRAWN)
    const submittableStatuses = ['DRAFT', 'WITHDRAWN'];
    if (!submittableStatuses.includes(expense.status)) {
      return NextResponse.json(
        {
          error: `이미 제출된 지출결의서입니다. (현재 상태: ${expense.status})`,
        },
        { status: 400 }
      );
    }

    // BudgetMaster에서 첫 번째 항목의 manager 조회
    // (세목별 담당자를 1차 결재자로 사용)
    const firstItem = expense.items[0];
    let budgetManager: string | null = null;

    if (firstItem) {
      const budgetMaster = await prisma.budgetMaster.findFirst({
        where: {
          category: expense.budgetCategory,
          subcategory: expense.budgetSubcategory,
          detail: firstItem.budgetDetail,
          isActive: true,
        },
        select: { manager: true },
      });
      budgetManager = budgetMaster?.manager || null;
    }

    // 결재선 자동 생성 (BudgetMaster.manager 전달)
    const approvalLineData = generateApprovalLine({
      committee: expense.committee,
      department: expense.department,
      budgetCategory: expense.budgetCategory,
      budgetSubcategory: expense.budgetSubcategory,
      requestAmount: expense.requestAmount,
      applicantName: expense.applicantName,
      budgetManager,
    });

    // 스냅샷 생성
    const snapshot = createApprovalSnapshot(approvalLineData);

    // 전결 단계 계산 (제출자 = 결재자인 단계들)
    const autoApprovedSteps = approvalLineData.steps.filter(
      (step) => step.isAutoApproved
    );
    const autoApprovedCount = autoApprovedSteps.length;

    // 첫 번째 실제 결재 대기 단계 계산
    const firstPendingStep = autoApprovedCount + 1;
    const isAllAutoApproved = firstPendingStep > approvalLineData.totalSteps;

    // 트랜잭션으로 결재선 생성 및 상태 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // 1. 결재선 생성 (기존에 있으면 삭제 후 재생성)
      if (expense.approvalLine) {
        await tx.approvalLine.delete({
          where: { id: expense.approvalLine.id },
        });
      }

      const now = new Date();

      const approvalLine = await tx.approvalLine.create({
        data: {
          expenseId: id,
          currentStep: isAllAutoApproved
            ? approvalLineData.totalSteps
            : firstPendingStep,
          totalSteps: approvalLineData.totalSteps,
          isUrgent: approvalLineData.isUrgent || false,
          snapshot,
          steps: {
            create: approvalLineData.steps.map((step) => ({
              stepNumber: step.stepNumber,
              stepName: step.stepName,
              approverName: step.approverName,
              approverEmail: step.approverEmail,
              approverTitle: step.approverTitle,
              isRequired: step.isRequired,
              isParallel: step.isParallel || false,
              // 전결 단계는 자동 승인 처리
              status: step.isAutoApproved ? 'APPROVED' : 'PENDING',
              approvedAt: step.isAutoApproved ? now : null,
              comment: step.autoApprovalReason || null,
            })),
          },
        },
        include: {
          steps: true,
        },
      });

      // 2. 지출결의서 상태 업데이트 (전결 단계 반영)
      let newStatus: string;
      if (isAllAutoApproved) {
        // 모든 단계가 전결이면 최종 승인
        newStatus = 'APPROVED_FINAL';
      } else {
        // 전결 단계 수에 따라 상태 결정
        newStatus = calculateApprovalStatus(
          'APPROVE',
          autoApprovedCount,
          approvalLineData.totalSteps
        );
        // 전결이 없으면 PENDING
        if (autoApprovedCount === 0) {
          newStatus = 'PENDING';
        }
      }

      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          status: newStatus as any,
          submittedAt: now,
          approvedAt: isAllAutoApproved ? now : null,
        },
        include: {
          items: true,
          approvalLine: {
            include: {
              steps: true,
            },
          },
        },
      });

      // 3. 감사 로그 생성 - 제출
      await tx.approvalLog.create({
        data: {
          expenseId: id,
          action: 'SUBMIT',
          actorName: expense.applicantName,
          actorRole: '작성자',
          previousStatus: expense.status,
          newStatus: 'PENDING',
          comment: expense.status === 'WITHDRAWN' ? '지출결의서 재제출' : '지출결의서 제출',
          metadata: {
            userAgent: request.headers.get('user-agent') || '',
            timestamp: now.toISOString(),
          },
          afterSnapshot: JSON.parse(snapshot),
        },
      });

      // 4. 전결 단계들에 대한 감사 로그 생성
      for (const step of autoApprovedSteps) {
        await tx.approvalLog.create({
          data: {
            expenseId: id,
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
              step.stepNumber === approvalLineData.totalSteps
                ? 'APPROVED_FINAL'
                : `APPROVED_STEP_${step.stepNumber}`,
            comment: step.autoApprovalReason || '전결 처리',
            metadata: {
              autoApproved: true,
              timestamp: now.toISOString(),
            },
          },
        });
      }

      return updatedExpense;
    });

    return NextResponse.json({
      success: true,
      message: '지출결의서가 제출되었습니다.',
      data: result,
    });
  } catch (error: any) {
    console.error('Submit error:', error);

    // 결재선 생성 에러 처리
    if (error.message?.includes('결재선을 생성할 수 없습니다')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '지출결의서 제출 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
