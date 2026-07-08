import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withAdmin, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/admin/budget-execution
 * 사역비 예산 집행 현황 조회 (위원회별/부서별)
 */
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // 연간 날짜 범위
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    // 1. 위원회 및 부서 목록 조회 (행정위, 인사위 제외 - 인사 및 행정비는 별도 페이지에서 처리)
    const [committees, hrAdminCommittees] = await Promise.all([
      prisma.committee.findMany({
        where: {
          isActive: true,
          AND: [
            { NOT: { name: { contains: '행정위' } } },
            { NOT: { name: { contains: '인사위' } } },
          ],
        },
        include: {
          departments: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      // 인사/행정 위원회 조회 (전체 예산 합계용)
      prisma.committee.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: '행정위' } },
            { name: { contains: '인사위' } },
          ],
        },
        include: {
          departments: {
            where: { isActive: true },
          },
        },
      }),
    ]);

    // 2. 부서별 예산 조회 (DepartmentBudgetDetail + BudgetDetailYear)
    const departmentBudgets = await prisma.departmentBudgetDetail.findMany({
      where: {
        isActive: true,
        department: { isActive: true },
        budgetDetail: {
          isActive: true,
          yearSettings: {
            some: { year, isActive: true },
          },
        },
      },
      include: {
        department: {
          select: { id: true, name: true, committeeId: true },
        },
        budgetDetail: {
          include: {
            yearSettings: {
              where: { year, isActive: true },
              select: { budgetAmount: true },
            },
          },
        },
      },
    });

    // 부서별 예산 합계 계산
    const departmentBudgetMap = new Map<string, number>();
    departmentBudgets.forEach((db) => {
      const deptId = db.departmentId;
      const budgetAmount = db.budgetDetail.yearSettings[0]?.budgetAmount || 0;
      departmentBudgetMap.set(deptId, (departmentBudgetMap.get(deptId) || 0) + budgetAmount);
    });

    // 3. 부서별 지출 조회 (APPROVED_FINAL 상태)
    const expensesByDept = await prisma.expense.groupBy({
      by: ['department'],
      where: {
        status: 'APPROVED_FINAL',
        requestDate: { gte: startDate, lte: endDate },
      },
      _sum: { requestAmount: true },
    });

    // 부서명 → 지출 금액 매핑
    const departmentSpentMap = new Map<string, number>();
    expensesByDept.forEach((exp) => {
      departmentSpentMap.set(exp.department, exp._sum.requestAmount || 0);
    });

    // 4. 부서 ID → 부서명 매핑 생성
    committees.forEach((comm) => {
      comm.departments.forEach((dept) => {
        // Maps not needed for this logic but keeping for consistency
      });
    });

    // 5. 위원회별 데이터 구성 (모든 부서 표시, 예산 0인 부서도 포함)
    let totalBudget = 0;
    let totalSpent = 0;

    const committeeData = committees.map((comm) => {
      let commBudget = 0;
      let commSpent = 0;

      const departments = comm.departments.map((dept) => {
        const budget = departmentBudgetMap.get(dept.id) || 0;
        const spent = departmentSpentMap.get(dept.name) || 0;
        const executionRate = budget > 0 ? Math.round((spent / budget) * 100) : 0;

        commBudget += budget;
        commSpent += spent;

        return {
          id: dept.id,
          name: dept.name,
          budget,
          spent,
          executionRate,
        };
      });

      totalBudget += commBudget;
      totalSpent += commSpent;

      const commExecutionRate = commBudget > 0 ? Math.round((commSpent / commBudget) * 100) : 0;

      return {
        id: comm.id,
        name: comm.name,
        budget: commBudget,
        spent: commSpent,
        executionRate: commExecutionRate,
        departments,
      };
    });

    const totalExecutionRate = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    // 인사/행정비 예산 합계 계산
    let hrAdminBudget = 0;
    let hrAdminSpent = 0;

    hrAdminCommittees.forEach((comm) => {
      comm.departments.forEach((dept) => {
        hrAdminBudget += departmentBudgetMap.get(dept.id) || 0;
        hrAdminSpent += departmentSpentMap.get(dept.name) || 0;
      });
    });

    // 전체 예산 (사역비 + 인사/행정비)
    const grandTotalBudget = totalBudget + hrAdminBudget;
    const grandTotalSpent = totalSpent + hrAdminSpent;
    const grandTotalExecutionRate = grandTotalBudget > 0 ? Math.round((grandTotalSpent / grandTotalBudget) * 100) : 0;

    // 전체 예산 대비 사역비 비율
    const ministryBudgetRatio = grandTotalBudget > 0 ? Math.round((totalBudget / grandTotalBudget) * 100) : 0;

    return NextResponse.json({
      year,
      summary: {
        // 사역비
        totalBudget,
        totalSpent,
        executionRate: totalExecutionRate,
        // 전체 (인사/행정비 포함)
        grandTotalBudget,
        grandTotalSpent,
        grandTotalExecutionRate,
        // 전체 대비 사역비 비율
        ministryBudgetRatio,
      },
      committees: committeeData,
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAdmin(handleGet);
