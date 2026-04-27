import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const ALLOWED_ROLES = ['admin', 'admin_assistant', 'accountant', 'finance_head', 'finance_member'];

/**
 * GET /api/admin/income/status
 * 수입 현황 조회 (연도별/월별 헌금 집계)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

    // 기간 설정
    let startDate: Date;
    let endDate: Date;

    if (month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    // 1. 총 수입
    const totalData = await prisma.offering.aggregate({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });
    const totalIncome = totalData._sum.amount || 0;

    // 2. 헌금 종류별 현황
    const byTypeData = await prisma.offering.groupBy({
      by: ['type'],
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    const byType = byTypeData.map((item) => ({
      type: item.type,
      typeName: getOfferingTypeName(item.type),
      amount: item._sum.amount || 0,
      count: item._count,
    }));

    // 3. 월별 추이 (연도 전체 조회 시만)
    let monthlyTrend: Array<{ month: number; amount: number }> = [];

    if (!month) {
      const monthlyData = await prisma.$queryRaw<Array<{ month: number; amount: bigint }>>`
        SELECT
          EXTRACT(MONTH FROM date)::int as month,
          COALESCE(SUM(amount), 0) as amount
        FROM "Offering"
        WHERE date >= ${startDate} AND date <= ${endDate}
        GROUP BY EXTRACT(MONTH FROM date)
        ORDER BY month
      `;

      // 12개월 데이터 초기화
      const monthMap = new Map<number, number>();
      for (let m = 1; m <= 12; m++) {
        monthMap.set(m, 0);
      }

      // 실제 데이터 채우기
      monthlyData.forEach((item) => {
        monthMap.set(item.month, Number(item.amount));
      });

      monthlyTrend = Array.from(monthMap.entries()).map(([m, amount]) => ({
        month: m,
        amount,
      }));
    }

    return NextResponse.json({
      year,
      month,
      totalIncome,
      byType,
      monthlyTrend,
    });
  } catch (error) {
    console.error('Income status API error:', error);
    return NextResponse.json(
      { error: '수입 현황을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

function getOfferingTypeName(type: string): string {
  const names: Record<string, string> = {
    TITHE: '십일조',
    THANKSGIVING: '감사헌금',
    SPECIAL: '특별헌금',
    MISSION: '선교헌금',
    BUILDING: '건축헌금',
    RELIEF: '구제헌금',
    OTHER: '기타',
  };
  return names[type] || type;
}
