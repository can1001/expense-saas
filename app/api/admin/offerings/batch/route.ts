import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// 헌금 관리 권한이 있는 역할
const OFFERING_ALLOWED_ROLES = ['admin', 'admin_assistant', 'accountant', 'finance_head'];

/**
 * GET /api/admin/offerings/batch
 * 날짜별 그룹화된 헌금 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !OFFERING_ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month') || ''; // YYYY-MM

    // 월 필터 조건
    let dateFilter = {};
    if (month && month !== '전체') {
      const [year, mon] = month.split('-').map(Number);
      const startDate = new Date(year, mon - 1, 1);
      const endDate = new Date(year, mon, 1);
      dateFilter = {
        date: {
          gte: startDate,
          lt: endDate,
        },
      };
    }

    // 날짜별 그룹화
    const groups = await prisma.offering.groupBy({
      by: ['date'],
      where: dateFilter,
      _sum: { amount: true },
      _count: true,
      orderBy: { date: 'desc' },
    });

    // 각 날짜별 상세 데이터 및 타입별 통계
    const batchData = await Promise.all(
      groups.map(async (group) => {
        const offerings = await prisma.offering.findMany({
          where: { date: group.date },
          orderBy: { createdAt: 'desc' },
        });

        // 타입별 통계
        const byType: Record<string, { count: number; amount: number }> = {};
        offerings.forEach((o) => {
          if (!byType[o.type]) {
            byType[o.type] = { count: 0, amount: 0 };
          }
          byType[o.type].count++;
          byType[o.type].amount += o.amount;
        });

        return {
          date: group.date.toISOString().slice(0, 10),
          count: group._count,
          totalAmount: group._sum.amount || 0,
          byType,
          offerings: offerings.map((o) => ({
            ...o,
            date: o.date.toISOString().slice(0, 10),
          })),
        };
      })
    );

    // 전체 통계
    const totalStats = {
      totalBatches: groups.length,
      totalOfferings: groups.reduce((sum, g) => sum + g._count, 0),
      totalAmount: groups.reduce((sum, g) => sum + (g._sum.amount || 0), 0),
      avgPerBatch: groups.length > 0
        ? Math.round(groups.reduce((sum, g) => sum + (g._sum.amount || 0), 0) / groups.length)
        : 0,
    };

    return NextResponse.json({
      batches: batchData,
      summary: totalStats,
    });
  } catch (error: unknown) {
    console.error('Get batch offerings error:', error);
    return NextResponse.json(
      { error: '배치 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/offerings/batch
 * 특정 날짜의 모든 헌금 일괄 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !OFFERING_ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { date } = body; // YYYY-MM-DD

    if (!date) {
      return NextResponse.json(
        { error: '삭제할 날짜를 지정해주세요.' },
        { status: 400 }
      );
    }

    // 해당 날짜의 헌금 개수 확인
    const targetDate = new Date(date);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.offering.count({
      where: {
        date: {
          gte: targetDate,
          lt: nextDate,
        },
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: '해당 날짜에 삭제할 헌금이 없습니다.' },
        { status: 404 }
      );
    }

    // 일괄 삭제
    const result = await prisma.offering.deleteMany({
      where: {
        date: {
          gte: targetDate,
          lt: nextDate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `${date} 헌금 ${result.count}건이 삭제되었습니다.`,
    });
  } catch (error: unknown) {
    console.error('Batch delete offerings error:', error);
    return NextResponse.json(
      { error: '일괄 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
