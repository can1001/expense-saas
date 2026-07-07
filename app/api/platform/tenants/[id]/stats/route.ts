import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

// GET /api/platform/tenants/[id]/stats - 테넌트 사용량 통계
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: SuperAdmin 인증 확인

    const { id } = await params;

    // 테넌트 존재 확인
    const tenant = await prismaBase.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        plan: true,
        maxUsers: true,
        maxStorageMB: true,
        currentUsers: true,
        currentStorage: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 통계 데이터 수집
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisYear = new Date(now.getFullYear(), 0, 1);

    const [
      userStats,
      expenseStats,
      monthlyExpenseStats,
      yearlyExpenseStats,
      statusBreakdown,
      recentActivity,
    ] = await Promise.all([
      // 사용자 통계
      prismaBase.user.aggregate({
        where: { tenantId: id },
        _count: true,
      }),

      // 전체 지출 통계
      prismaBase.expense.aggregate({
        where: { tenantId: id },
        _count: true,
        _sum: { requestAmount: true },
      }),

      // 이번 달 지출 통계
      prismaBase.expense.aggregate({
        where: {
          tenantId: id,
          createdAt: { gte: thisMonth },
        },
        _count: true,
        _sum: { requestAmount: true },
      }),

      // 올해 지출 통계
      prismaBase.expense.aggregate({
        where: {
          tenantId: id,
          createdAt: { gte: thisYear },
        },
        _count: true,
        _sum: { requestAmount: true },
      }),

      // 상태별 지출 건수
      prismaBase.expense.groupBy({
        by: ['status'],
        where: { tenantId: id },
        _count: true,
      }),

      // 최근 활동 (최근 10건)
      prismaBase.expense.findMany({
        where: { tenantId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          applicantName: true,
          requestAmount: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // 월별 추이 (최근 6개월)
    const monthlyTrend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        return prismaBase.expense.aggregate({
          where: {
            tenantId: id,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          _count: true,
          _sum: { requestAmount: true },
        }).then((result) => ({
          month: startDate.toISOString().slice(0, 7), // YYYY-MM
          count: result._count,
          amount: result._sum.requestAmount ?? 0,
        }));
      })
    );

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        plan: tenant.plan,
        createdAt: tenant.createdAt,
      },
      usage: {
        users: {
          current: userStats._count,
          max: tenant.maxUsers,
          percentage: Math.round((userStats._count / tenant.maxUsers) * 100),
        },
        storage: {
          currentMB: tenant.currentStorage,
          maxMB: tenant.maxStorageMB,
          percentage: Math.round((tenant.currentStorage / tenant.maxStorageMB) * 100),
        },
      },
      expenses: {
        total: {
          count: expenseStats._count,
          amount: expenseStats._sum.requestAmount ?? 0,
        },
        thisMonth: {
          count: monthlyExpenseStats._count,
          amount: monthlyExpenseStats._sum.requestAmount ?? 0,
        },
        thisYear: {
          count: yearlyExpenseStats._count,
          amount: yearlyExpenseStats._sum.requestAmount ?? 0,
        },
        byStatus: statusBreakdown.reduce(
          (acc, item) => {
            acc[item.status] = item._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
      monthlyTrend: monthlyTrend.reverse(), // 오래된 순
      recentActivity,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
