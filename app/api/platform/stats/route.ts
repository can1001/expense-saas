import { NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';

// GET /api/platform/stats - 플랫폼 전체 통계
export const GET = withSuperAdmin(async () => {
  try {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisYear = new Date(now.getFullYear(), 0, 1);

    // 병렬로 통계 데이터 수집
    const [
      tenantStats,
      activeTenantCount,
      userStats,
      expenseStats,
      thisMonthExpenseStats,
      lastMonthExpenseStats,
      thisYearExpenseStats,
      planDistribution,
      orgTypeDistribution,
      recentTenants,
      tenantsNearLimit,
    ] = await Promise.all([
      // 전체 테넌트 통계
      prismaBase.tenant.aggregate({
        _count: true,
        _sum: {
          currentUsers: true,
          currentStorage: true,
        },
      }),

      // 활성 테넌트 수
      prismaBase.tenant.count({
        where: { isActive: true },
      }),

      // 전체 사용자 통계
      prismaBase.user.aggregate({
        _count: true,
        where: { isActive: true },
      }),

      // 전체 지출 통계
      prismaBase.expense.aggregate({
        _count: true,
        _sum: { requestAmount: true },
      }),

      // 이번 달 지출
      prismaBase.expense.aggregate({
        where: { createdAt: { gte: thisMonth } },
        _count: true,
        _sum: { requestAmount: true },
      }),

      // 지난 달 지출
      prismaBase.expense.aggregate({
        where: {
          createdAt: {
            gte: lastMonth,
            lt: thisMonth,
          },
        },
        _count: true,
        _sum: { requestAmount: true },
      }),

      // 올해 지출
      prismaBase.expense.aggregate({
        where: { createdAt: { gte: thisYear } },
        _count: true,
        _sum: { requestAmount: true },
      }),

      // 요금제별 분포
      prismaBase.tenant.groupBy({
        by: ['plan'],
        _count: true,
      }),

      // 조직 유형별 분포
      prismaBase.tenant.groupBy({
        by: ['orgType'],
        _count: true,
      }),

      // 최근 생성된 테넌트 (5개)
      prismaBase.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          subdomain: true,
          plan: true,
          orgType: true,
          isActive: true,
          currentUsers: true,
          createdAt: true,
        },
      }),

      // 제한에 근접한 테넌트 (사용자 수 80% 이상)
      prismaBase.$queryRaw<
        Array<{
          id: string;
          name: string;
          subdomain: string;
          currentUsers: number;
          maxUsers: number;
          usagePercent: number;
        }>
      >`
        SELECT
          id,
          name,
          subdomain,
          "currentUsers",
          "maxUsers",
          ROUND(CAST("currentUsers" AS DECIMAL) / CAST("maxUsers" AS DECIMAL) * 100) as "usagePercent"
        FROM "Tenant"
        WHERE "isActive" = true
          AND "maxUsers" > 0
          AND CAST("currentUsers" AS DECIMAL) / CAST("maxUsers" AS DECIMAL) >= 0.8
        ORDER BY "usagePercent" DESC
        LIMIT 5
      `,
    ]);

    // 월별 추이 (최근 6개월)
    const monthlyTrend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        return Promise.all([
          // 지출
          prismaBase.expense.aggregate({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            _count: true,
            _sum: { requestAmount: true },
          }),
          // 신규 테넌트
          prismaBase.tenant.count({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          }),
          // 신규 사용자
          prismaBase.user.count({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          }),
        ]).then(([expenses, newTenants, newUsers]) => ({
          month: startDate.toISOString().slice(0, 7),
          expenses: {
            count: expenses._count,
            amount: expenses._sum.requestAmount ?? 0,
          },
          newTenants,
          newUsers,
        }));
      })
    );

    // 전월 대비 변화율 계산
    const thisMonthAmount = thisMonthExpenseStats._sum.requestAmount ?? 0;
    const lastMonthAmount = lastMonthExpenseStats._sum.requestAmount ?? 0;
    const expenseGrowth = lastMonthAmount > 0
      ? Math.round(((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100)
      : 0;

    return NextResponse.json({
      overview: {
        tenants: {
          total: tenantStats._count,
          active: activeTenantCount,
          inactive: tenantStats._count - activeTenantCount,
        },
        users: {
          total: tenantStats._sum.currentUsers ?? 0,
          active: userStats._count,
        },
        storage: {
          totalMB: tenantStats._sum.currentStorage ?? 0,
          totalGB: Math.round((tenantStats._sum.currentStorage ?? 0) / 1024 * 10) / 10,
        },
        expenses: {
          total: {
            count: expenseStats._count,
            amount: expenseStats._sum.requestAmount ?? 0,
          },
          thisMonth: {
            count: thisMonthExpenseStats._count,
            amount: thisMonthAmount,
          },
          thisYear: {
            count: thisYearExpenseStats._count,
            amount: thisYearExpenseStats._sum.requestAmount ?? 0,
          },
          growth: expenseGrowth,
        },
      },
      distribution: {
        byPlan: planDistribution.reduce(
          (acc, item) => {
            acc[item.plan] = item._count;
            return acc;
          },
          {} as Record<string, number>
        ),
        byOrgType: orgTypeDistribution.reduce(
          (acc, item) => {
            acc[item.orgType] = item._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
      monthlyTrend: monthlyTrend.reverse(),
      recentTenants,
      alerts: {
        tenantsNearUserLimit: tenantsNearLimit,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});
