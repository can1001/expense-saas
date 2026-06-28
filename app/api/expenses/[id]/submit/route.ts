import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  calculateApprovalLineForExpense,
  ApprovalLineInfo,
} from '@/lib/services/approval-line-service';
import { notificationService } from '@/lib/services/notification';
import { getCurrentUser } from '@/lib/auth';

/**
 * POST /api/expenses/[id]/submit
 * 지출결의서 제출 및 결재선 자동 생성
 *
 * 결재선 산출 규칙:
 * - 담당자 ≠ 재정팀장: 담당자 → 회계 → 재정팀장 (3단계)
 * - 담당자 = 재정팀장: 재정팀장(전결) → 회계 → 재정팀장 (3단계, 1차 자동승인)
 *
 * 담당자는 정규화된 BudgetDetailYear 테이블에서 조회
 * 회계/재정팀장은 UserYearRole 테이블에서 조회
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 현재 로그인 사용자 (제출 행위자 기록용)
    const currentUser = await getCurrentUser();

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

    // 항목이 있는지 확인
    const firstItem = expense.items[0];
    if (!firstItem) {
      return NextResponse.json(
        { error: '지출결의서 항목이 없습니다.' },
        { status: 400 }
      );
    }

    // 연도 추출 (청구일자 기준)
    const year = expense.requestDate.getFullYear();

    // 정규화된 테이블 기반 결재선 자동 산출 (첫 번째 항목에서 예산 정보 가져옴)
    console.log(`[Submit] 지출결의서 제출 시작`, {
      expenseId: id,
      applicantName: expense.applicantName,
      userId: expense.userId,
      year,
      budgetDetail: firstItem.budgetDetail,
    });

    let approvalLineInfo: ApprovalLineInfo;
    try {
      approvalLineInfo = await calculateApprovalLineForExpense(
        firstItem.budgetCategory,
        firstItem.budgetSubcategory,
        firstItem.budgetDetail,
        year,
        expense.userId  // 신청자 ID - 세목담당자 전결 판단용
      );

      console.log(`[Submit] 결재선 산출 결과`, {
        managerId: approvalLineInfo.managerId,
        managerName: approvalLineInfo.managerName,
        isDirectApproval: approvalLineInfo.isDirectApproval,
        isSubmitterManager: approvalLineInfo.isSubmitterManager,
        steps: approvalLineInfo.steps.map(s => ({
          step: s.stepNumber,
          name: s.stepName,
          approver: s.approverName,
          autoApproved: s.isAutoApproved,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '결재선 산출 실패';
      console.error(`[Submit] 결재선 산출 실패`, { expenseId: id, error: message });
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // 요청 본문에서 서명 데이터 추출
    let body: { signature?: any } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // 빈 body 또는 잘못된 JSON - 무시
    }
    const { signature } = body;

    // 서명 데이터 처리 (저장된 서명 또는 실시간 서명)
    let signatureType: string | null = null;
    let signatureData: string | null = null;

    if (signature) {
      if (signature.signatureId) {
        // 저장된 서명/도장 사용
        const savedSignature = await prisma.userSignature.findUnique({
          where: { id: signature.signatureId },
        });
        if (savedSignature) {
          signatureType = savedSignature.type;
          signatureData = savedSignature.imageData;
        }
      } else if (signature.data && signature.type) {
        // 실시간 서명
        signatureType = signature.type;
        signatureData = signature.data;
      }
    }

    // 서명 필수 검증
    if (!signatureData) {
      return NextResponse.json(
        {
          error: '청구인 서명을 선택해주세요.',
          code: 'SIGNATURE_REQUIRED',
        },
        { status: 400 }
      );
    }

    // 스냅샷 생성
    const snapshot = JSON.stringify({
      ...approvalLineInfo,
      snapshotTimestamp: new Date().toISOString(),
    });

    // 연속된 전결 단계 계산 (1차부터 연속으로 전결인 단계만)
    const consecutiveAutoApprovedSteps: typeof approvalLineInfo.steps = [];
    for (const step of approvalLineInfo.steps) {
      if (step.isAutoApproved) {
        consecutiveAutoApprovedSteps.push(step);
      } else {
        break; // 전결이 아닌 단계를 만나면 중단
      }
    }
    const autoApprovedCount = consecutiveAutoApprovedSteps.length;

    // 첫 번째 실제 결재 대기 단계 계산
    const firstPendingStep = autoApprovedCount + 1;
    const isAllAutoApproved = firstPendingStep > approvalLineInfo.totalSteps;

    // 트랜잭션으로 결재선 생성 및 상태 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // 1. 결재선 생성 (기존에 있으면 삭제 후 재생성)
      if (expense.approvalLine) {
        await tx.approvalLine.delete({
          where: { id: expense.approvalLine.id },
        });
      }

      const now = new Date();

      // 연속된 전결 단계 번호 목록
      const consecutiveStepNumbers = new Set(
        consecutiveAutoApprovedSteps.map((s) => s.stepNumber)
      );

      await tx.approvalLine.create({
        data: {
          expenseId: id,
          currentStep: isAllAutoApproved
            ? approvalLineInfo.totalSteps
            : firstPendingStep,
          totalSteps: approvalLineInfo.totalSteps,
          isUrgent: false,
          snapshot,
          steps: {
            create: approvalLineInfo.steps.map((step) => {
              // 연속된 전결 단계만 자동 승인
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
        include: {
          steps: true,
        },
      });

      // 2. 지출결의서 상태 업데이트 (전결 단계 반영)
      let newStatus: string;
      if (isAllAutoApproved) {
        // 모든 단계가 전결이면 최종 승인
        newStatus = 'APPROVED_FINAL';
      } else if (autoApprovedCount >= approvalLineInfo.totalSteps) {
        newStatus = 'APPROVED_FINAL';
      } else if (autoApprovedCount === 2) {
        newStatus = 'APPROVED_STEP_2';
      } else if (autoApprovedCount === 1) {
        newStatus = 'APPROVED_STEP_1';
      } else {
        newStatus = 'PENDING';
      }

      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          status: newStatus as any,
          submittedAt: now,
          approvedAt: isAllAutoApproved ? now : null,
          // 클라이언트에서 전달받은 청구인 서명 적용
          applicantSignatureType: signatureType,
          applicantSignatureData: signatureData,
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
      const submitterName = currentUser?.username || expense.applicantName;
      const isProxySubmit =
        currentUser !== null && currentUser.id !== expense.userId;
      await tx.approvalLog.create({
        data: {
          expenseId: id,
          action: 'SUBMIT',
          actorName: submitterName,
          actorRole: isProxySubmit ? '대리 제출' : '작성자',
          previousStatus: expense.status,
          newStatus: 'PENDING',
          comment: expense.status === 'WITHDRAWN' ? '지출결의서 재제출' : '지출결의서 제출',
          metadata: {
            userAgent: request.headers.get('user-agent') || '',
            timestamp: now.toISOString(),
            ...(isProxySubmit && {
              proxySubmit: true,
              applicantName: expense.applicantName,
            }),
          },
          afterSnapshot: JSON.parse(snapshot),
        },
      });

      // 4. 연속된 전결 단계들에 대한 감사 로그 생성
      for (const step of consecutiveAutoApprovedSteps) {
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

      return updatedExpense;
    });

    // 알림 발송 (비동기, 실패해도 제출은 성공)
    try {
      // 첫 번째 대기 결재자에게 알림
      const firstPendingStepInfo = approvalLineInfo.steps.find(
        (s) => !s.isAutoApproved
      );

      if (firstPendingStepInfo) {
        // 결재자 정보 조회
        const approverUser = await prisma.user.findFirst({
          where: { username: firstPendingStepInfo.approverName },
          select: { id: true, phoneNumber: true },
        });

        if (approverUser) {
          notificationService
            .notifyOnSubmit(id, approverUser.phoneNumber || '', approverUser.id, firstPendingStepInfo.approverName, {
              applicantName: expense.applicantName,
              requestAmount: expense.requestAmount,
              department: expense.department,
              budgetDetail: firstItem.budgetDetail,
            })
            .catch((err) => console.error('[Submit] 알림 발송 실패:', err));
        } else {
          await notificationService.logUnmatchedRecipient({
            expenseId: id,
            eventType: 'SUBMIT',
            attemptedName: firstPendingStepInfo.approverName,
            role: 'approver',
          });
        }
      }
    } catch (notifyError) {
      console.error('[Submit] 알림 처리 중 오류:', notifyError);
    }

    return NextResponse.json({
      success: true,
      message: approvalLineInfo.isDirectApproval
        ? '지출결의서가 제출되었습니다. (1차 전결 자동 승인)'
        : '지출결의서가 제출되었습니다.',
      data: result,
      approvalLineInfo: {
        managerId: approvalLineInfo.managerId,
        managerName: approvalLineInfo.managerName,
        isDirectApproval: approvalLineInfo.isDirectApproval,
        totalSteps: approvalLineInfo.totalSteps,
        autoApprovedSteps: autoApprovedCount,
      },
    });
  } catch (error: any) {
    console.error('Submit error:', error);

    // 결재선 생성 에러 처리
    if (error.message?.includes('설정되지 않았습니다')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '지출결의서 제출 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
