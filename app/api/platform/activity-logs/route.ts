import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';

// GET /api/platform/activity-logs - 활동 로그 목록 조회
export const GET = withSuperAdmin(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const tenantId = url.searchParams.get('tenantId');
    const action = url.searchParams.get('action');
    const entityType = url.searchParams.get('entityType');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const search = url.searchParams.get('search');

    // 필터 조건 구성
    const where: Record<string, unknown> = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (action) {
      where.action = action;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, Date>).lte = end;
      }
    }

    if (search) {
      where.OR = [
        { superAdminEmail: { contains: search, mode: 'insensitive' } },
        { tenantName: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 병렬로 데이터 조회
    const [logs, total] = await Promise.all([
      prismaBase.platformActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prismaBase.platformActivityLog.count({ where }),
    ]);

    // 액션별 통계
    const actionStats = await prismaBase.platformActivityLog.groupBy({
      by: ['action'],
      _count: true,
      where: startDate || endDate ? where : undefined,
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        byAction: actionStats.reduce(
          (acc, item) => {
            acc[item.action] = item._count;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});
