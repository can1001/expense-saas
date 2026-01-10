import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * GET /api/admin/change-history
 * 변경 이력 조회
 *
 * Query params:
 * - type: 'roles' | 'budgets' | 'all' (default: 'all')
 * - year: number (선택)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all';
    const yearStr = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const year = yearStr ? parseInt(yearStr) : undefined;

    const result: {
      roleHistory?: unknown[];
      budgetHistory?: unknown[];
      total: {
        roles?: number;
        budgets?: number;
      };
    } = { total: {} };

    // 역할 변경 이력
    if (type === 'all' || type === 'roles') {
      const whereClause = year ? { year } : {};

      const [roleHistory, roleCount] = await Promise.all([
        prisma.userYearRoleHistory.findMany({
          where: whereClause,
          orderBy: { changedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.userYearRoleHistory.count({ where: whereClause }),
      ]);

      // 사용자 정보 조회
      const userIds = [...new Set(roleHistory.map((h) => h.userId))];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, userid: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      result.roleHistory = roleHistory.map((h) => ({
        ...h,
        userName: userMap.get(h.userId)?.username || h.userId,
        userLoginId: userMap.get(h.userId)?.userid,
      }));
      result.total.roles = roleCount;
    }

    // 예산 변경 이력
    if (type === 'all' || type === 'budgets') {
      const whereClause = year ? { year } : {};

      const [budgetHistory, budgetCount] = await Promise.all([
        prisma.budgetDetailYearHistory.findMany({
          where: whereClause,
          orderBy: { changedAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.budgetDetailYearHistory.count({ where: whereClause }),
      ]);

      result.budgetHistory = budgetHistory;
      result.total.budgets = budgetCount;
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
