import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllUsedAmounts, makeBudgetDetailKey } from '@/lib/services/budget-service';
import { withAuth, withAdmin, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/budget-details/year?year=2026&includeInactive=true
 * 연도별 예산 세목 설정 조회 (담당자 + 예산금액)
 */
const handleGet: UserApiHandler = async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // 1차 승인 이상 지출결의서의 세목별 사용금액 집계
    const usedAmountMap = await getAllUsedAmounts(year);

    // 모든 예산 세목과 연도별 설정 조회
    const where: Record<string, unknown> = {};
    if (!includeInactive) {
      where.isActive = true;
      // 상위 목/항이 비활성인 경우에도 제외
      where.subcategory = {
        isActive: true,
        category: { isActive: true },
      };
    }

    const budgetDetails = await prisma.budgetDetail.findMany({
      where,
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
        isActive: detail.isActive,
        category: detail.subcategory.category.name,
        categoryId: detail.subcategory.category.id,
        categoryIsActive: detail.subcategory.category.isActive,
        subcategory: detail.subcategory.name,
        subcategoryId: detail.subcategory.id,
        subcategoryIsActive: detail.subcategory.isActive,
        departments,
        yearSetting: yearSetting
          ? {
              id: yearSetting.id,
              year: yearSetting.year,
              managerId: yearSetting.managerId,
              managerName: yearSetting.manager?.username,
              budgetAmount: yearSetting.budgetAmount,
              usedAmount:
                usedAmountMap.get(
                  makeBudgetDetailKey({
                    budgetCategory: detail.subcategory.category.name,
                    budgetSubcategory: detail.subcategory.name,
                    budgetDetail: detail.name,
                  })
                ) || 0,
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
};

/**
 * POST /api/budget-details/year
 * 연도별 세목 설정 생성/수정 (일괄)
 */
const handlePost: UserApiHandler = async (request) => {
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
};

export const GET = withAuth(handleGet);
export const POST = withAdmin(handlePost);
