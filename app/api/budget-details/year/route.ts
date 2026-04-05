import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/budget-details/year?year=2026
 * 연도별 예산 세목 설정 조회 (담당자 + 예산금액)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // 지급완료된 지출결의서의 세목별 사용금액 집계
    const usedAmounts = await prisma.expenseItem.groupBy({
      by: ['budgetDetail'],
      where: {
        expense: {
          paymentStatus: 'COMPLETED',
          expenseDate: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        },
      },
      _sum: { amount: true },
    });

    // Map으로 변환하여 빠른 조회
    const usedAmountMap = new Map(
      usedAmounts.map((item) => [item.budgetDetail, item._sum.amount || 0])
    );

    // 모든 예산 세목과 연도별 설정 조회
    const budgetDetails = await prisma.budgetDetail.findMany({
      where: { isActive: true },
      include: {
        subcategory: {
          include: {
            category: true,
          },
        },
        yearSettings: {
          where: { year },
          include: {
            manager: {
              select: {
                id: true,
                userid: true,
                username: true,
              },
            },
          },
        },
        departmentDetails: {
          where: { isActive: true },
          include: {
            department: {
              include: {
                committee: true,
              },
            },
          },
        },
      },
      orderBy: [
        { subcategory: { category: { sortOrder: 'asc' } } },
        { subcategory: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
      ],
    });

    // 응답 데이터 변환
    const result = budgetDetails.map((detail) => {
      const yearSetting = detail.yearSettings[0];
      const departments = detail.departmentDetails.map((dd) => ({
        id: dd.department.id,
        name: dd.department.name,
        committee: dd.department.committee.name,
      }));

      return {
        id: detail.id,
        name: detail.name,
        accountCode: detail.accountCode,
        description: detail.description,
        category: detail.subcategory.category.name,
        categoryId: detail.subcategory.category.id,
        subcategory: detail.subcategory.name,
        subcategoryId: detail.subcategory.id,
        departments,
        yearSetting: yearSetting
          ? {
              id: yearSetting.id,
              year: yearSetting.year,
              managerId: yearSetting.managerId,
              managerName: yearSetting.manager?.username,
              budgetAmount: yearSetting.budgetAmount,
              usedAmount: usedAmountMap.get(detail.name) || 0,
            }
          : null,
      };
    });

    return NextResponse.json({
      year,
      details: result,
      total: result.length,
    });
  } catch (error) {
    console.error('예산 세목 조회 오류:', error);
    return NextResponse.json({ error: '예산 세목 조회 실패' }, { status: 500 });
  }
}

/**
 * POST /api/budget-details/year
 * 연도별 세목 설정 생성/수정 (일괄)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, settings } = body as {
      year: number;
      settings: Array<{
        budgetDetailId: string;
        managerId?: string | null;
        budgetAmount?: number;
      }>;
    };

    if (!year || !settings || !Array.isArray(settings)) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const results = [];

    for (const setting of settings) {
      const { budgetDetailId, managerId, budgetAmount } = setting;

      // upsert - 있으면 수정, 없으면 생성
      const result = await prisma.budgetDetailYear.upsert({
        where: {
          budgetDetailId_year: {
            budgetDetailId,
            year,
          },
        },
        update: {
          managerId: managerId || null,
          budgetAmount: budgetAmount ?? 0,
        },
        create: {
          budgetDetailId,
          year,
          managerId: managerId || null,
          budgetAmount: budgetAmount ?? 0,
          usedAmount: 0,
          isActive: true,
        },
        include: {
          manager: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      results.push(result);
    }

    return NextResponse.json({
      message: `${results.length}건 저장 완료`,
      results,
    });
  } catch (error) {
    console.error('예산 세목 설정 저장 오류:', error);
    return NextResponse.json({ error: '예산 세목 설정 저장 실패' }, { status: 500 });
  }
}
