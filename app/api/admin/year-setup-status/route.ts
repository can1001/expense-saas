import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withAdmin, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/admin/year-setup-status
 * 연도별 설정 완료율 조회
 */
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // 1. 역할 설정 완료율
    // 전체 활성 사용자 수
    const totalActiveUsers = await prisma.user.count({
      where: { isActive: true },
    });

    // 해당 연도에 역할이 설정된 사용자 수
    const usersWithRole = await prisma.userYearRole.count({
      where: {
        year,
        user: { isActive: true },
      },
    });

    // 역할별 사용자 현황
    const roleBreakdown = await prisma.userYearRole.groupBy({
      by: ['role'],
      where: {
        year,
        user: { isActive: true },
      },
      _count: { role: true },
    });

    // 2. 담당자 지정 완료율
    // 전체 활성 세목 수 (부서에 연결된 세목)
    const totalBudgetDetails = await prisma.departmentBudgetDetail.count({
      where: {
        isActive: true,
        budgetDetail: { isActive: true },
      },
    });

    // 해당 연도에 담당자가 지정된 세목 수
    const detailsWithManager = await prisma.budgetDetailYear.count({
      where: {
        year,
        managerId: { not: null },
        budgetDetail: { isActive: true },
      },
    });

    // 3. 예산 입력 완료율
    // 해당 연도에 예산이 입력된 세목 수
    const detailsWithBudget = await prisma.budgetDetailYear.count({
      where: {
        year,
        budgetAmount: { gt: 0 },
        budgetDetail: { isActive: true },
      },
    });

    // 해당 연도 총 예산액
    const budgetSum = await prisma.budgetDetailYear.aggregate({
      where: {
        year,
        budgetDetail: { isActive: true },
      },
      _sum: { budgetAmount: true },
    });

    // 4. 담당자 미지정 세목 목록 (상위 10개)
    const missingManagers = await prisma.departmentBudgetDetail.findMany({
      where: {
        isActive: true,
        budgetDetail: {
          isActive: true,
          yearSettings: {
            none: {
              year,
              managerId: { not: null },
            },
          },
        },
      },
      include: {
        department: {
          include: { committee: true },
        },
        budgetDetail: {
          include: {
            subcategory: {
              include: { category: true },
            },
          },
        },
      },
      take: 10,
    });

    // 5. 예산 미입력 세목 목록 (상위 10개)
    const missingBudgets = await prisma.departmentBudgetDetail.findMany({
      where: {
        isActive: true,
        budgetDetail: {
          isActive: true,
          yearSettings: {
            none: {
              year,
              budgetAmount: { gt: 0 },
            },
          },
        },
      },
      include: {
        department: {
          include: { committee: true },
        },
        budgetDetail: {
          include: {
            subcategory: {
              include: { category: true },
            },
          },
        },
      },
      take: 10,
    });

    // 6. 역할 미지정 사용자 목록 (상위 10개)
    const missingRoles = await prisma.user.findMany({
      where: {
        isActive: true,
        yearRoles: {
          none: { year },
        },
      },
      select: {
        id: true,
        username: true,
        userid: true,
      },
      take: 10,
    });

    return NextResponse.json({
      year,
      summary: {
        roleSetup: {
          total: totalActiveUsers,
          completed: usersWithRole,
          rate: totalActiveUsers > 0 ? Math.round((usersWithRole / totalActiveUsers) * 100) : 0,
          breakdown: roleBreakdown.map((r) => ({
            role: r.role,
            count: r._count.role,
          })),
        },
        managerAssignment: {
          total: totalBudgetDetails,
          completed: detailsWithManager,
          rate: totalBudgetDetails > 0 ? Math.round((detailsWithManager / totalBudgetDetails) * 100) : 0,
        },
        budgetInput: {
          total: totalBudgetDetails,
          completed: detailsWithBudget,
          rate: totalBudgetDetails > 0 ? Math.round((detailsWithBudget / totalBudgetDetails) * 100) : 0,
          totalAmount: budgetSum._sum.budgetAmount || 0,
        },
      },
      missing: {
        roles: missingRoles,
        managers: missingManagers.map((item) => ({
          id: item.budgetDetail.id,
          name: item.budgetDetail.name,
          committee: item.department.committee.name,
          department: item.department.name,
          category: item.budgetDetail.subcategory.category.name,
          subcategory: item.budgetDetail.subcategory.name,
        })),
        budgets: missingBudgets.map((item) => ({
          id: item.budgetDetail.id,
          name: item.budgetDetail.name,
          committee: item.department.committee.name,
          department: item.department.name,
          category: item.budgetDetail.subcategory.category.name,
          subcategory: item.budgetDetail.subcategory.name,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAdmin(handleGet);
