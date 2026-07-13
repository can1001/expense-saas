import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserApiHandler, withPermissions } from '@/lib/auth/user';
import { PERMISSIONS } from '@/lib/auth/permissions';

/**
 * GET /api/approvals
 * 결재 대기 목록 조회
 *
 * Query params:
 * - status: 필터 (pending, completed, all) - 기본값: pending
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지 크기 (기본값: 10)
 */
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const approverName = user.username; // 인증된 사용자의 이름 사용
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // 결재자가 포함된 결재선 찾기
    const whereCondition: any = {
      steps: {
        some: {
          approverName: approverName,
        },
      },
    };

    // 상태 필터링
    if (status === 'pending') {
      // 내가 현재 결재해야 할 건들만
      whereCondition.steps = {
        some: {
          approverName: approverName,
          status: 'PENDING',
        },
      };
      whereCondition.expense = {
        is: {
          status: {
            in: ['PENDING', 'APPROVED_STEP_1', 'APPROVED_STEP_2'],
          },
        },
      };
    } else if (status === 'completed') {
      // 내가 이미 처리한 건들
      whereCondition.steps = {
        some: {
          approverName: approverName,
          status: {
            in: ['APPROVED', 'REJECTED'],
          },
        },
      };
    }
    // status === 'all'이면 모든 건 조회

    // 결재선과 함께 지출결의서 조회
    // Note: pending 상태일 때는 isMyTurn 필터링이 필요하므로 먼저 전체 조회 후 필터링
    const approvalLines = await prisma.approvalLine.findMany({
      where: whereCondition,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        expense: {
          include: {
            items: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        steps: {
          orderBy: {
            stepNumber: 'asc',
          },
        },
      },
    });

    // 현재 결재자 차례인 건만 필터 (pending 상태일 때)
    const filteredResults = approvalLines.filter((line) => {
      if (status !== 'pending') return true;

      const currentStep = line.steps.find(
        (step) => step.stepNumber === line.currentStep
      );
      return currentStep?.approverName === approverName;
    });

    // 필터링 후 페이지네이션 적용
    const totalFiltered = filteredResults.length;
    const paginatedResults = filteredResults.slice(skip, skip + limit);

    // 응답 데이터 구성
    const approvals = paginatedResults.map((line) => {
      const currentStep = line.steps.find(
        (step) => step.stepNumber === line.currentStep
      );
      const myStep = line.steps.find(
        (step) => step.approverName === approverName
      );

      // 첫 번째 항목에서 예산 정보 가져오기
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

    return NextResponse.json({
      approvals,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit),
      },
    });
  } catch (error: any) {
    console.error('Get approvals error:', error);
    return NextResponse.json(
      { error: '결재 목록 조회 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
};

export const GET = withPermissions(PERMISSIONS.EXPENSE_APPROVE, handleGet);
