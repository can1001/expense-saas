import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/budget/hierarchy - 조직별 예산 계층 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const search = searchParams.get('search') || '';
    const committeeId = searchParams.get('committeeId') || '';

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

    // 위원회 필터 조건
    const committeeWhere: Record<string, unknown> = { isActive: true };
    if (committeeId) {
      committeeWhere.id = committeeId;
    }

    // 위원회 > 사역팀 > 세목 계층 조회
    const committees = await prisma.committee.findMany({
      where: committeeWhere,
      orderBy: { sortOrder: 'asc' },
      include: {
        departments: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            budgetDetails: {
              where: { isActive: true },
              include: {
                budgetDetail: {
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
                            username: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 검색 필터 적용 및 데이터 변환
    let totalDetails = 0;
    let totalBudgetAmount = 0;
    let unassignedCount = 0;

    const formattedCommittees = committees
      .map((committee) => {
        const departments = committee.departments
          .map((dept) => {
            const details = dept.budgetDetails
              .map((dbd) => {
                const detail = dbd.budgetDetail;
                const yearSetting = detail.yearSettings[0];
                const category = detail.subcategory?.category?.name || '';
                const subcategory = detail.subcategory?.name || '';

                return {
                  id: dbd.id,
                  detailId: detail.id,
                  detailName: detail.name,
                  category,
                  subcategory,
                  fullPath: `${category} > ${subcategory} > ${detail.name}`,
                  managerId: yearSetting?.managerId || null,
                  managerName: yearSetting?.manager?.username || null,
                  budgetAmount: yearSetting?.budgetAmount || 0,
                  usedAmount: usedAmountMap.get(detail.name) || 0,
                };
              })
              .filter((d) => {
                // 검색 필터
                if (!search) return true;
                const term = search.toLowerCase();
                return (
                  d.detailName.toLowerCase().includes(term) ||
                  d.category.toLowerCase().includes(term) ||
                  d.subcategory.toLowerCase().includes(term) ||
                  (d.managerName && d.managerName.toLowerCase().includes(term)) ||
                  committee.name.toLowerCase().includes(term) ||
                  dept.name.toLowerCase().includes(term)
                );
              })
              .sort((a, b) => {
                // 카테고리 > 서브카테고리 > 세목명 순 정렬
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                if (a.subcategory !== b.subcategory) return a.subcategory.localeCompare(b.subcategory);
                return a.detailName.localeCompare(b.detailName);
              });

            // 통계 집계
            details.forEach((d) => {
              totalDetails++;
              totalBudgetAmount += d.budgetAmount;
              if (!d.managerId) unassignedCount++;
            });

            return {
              id: dept.id,
              name: dept.name,
              detailCount: details.length,
              details,
            };
          })
          .filter((dept) => dept.details.length > 0); // 세목이 있는 사역팀만

        return {
          id: committee.id,
          name: committee.name,
          departmentCount: departments.length,
          detailCount: departments.reduce((sum, d) => sum + d.detailCount, 0),
          departments,
        };
      })
      .filter((c) => c.departments.length > 0); // 사역팀이 있는 위원회만

    // 위원회 목록 (필터용)
    const allCommittees = await prisma.committee.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      summary: {
        totalCommittees: formattedCommittees.length,
        totalDepartments: formattedCommittees.reduce((sum, c) => sum + c.departmentCount, 0),
        totalDetails,
        totalBudgetAmount,
        unassignedCount,
      },
      committees: formattedCommittees,
      allCommittees,
    });
  } catch (error) {
    console.error('Error fetching budget hierarchy:', error);
    return NextResponse.json(
      { error: '예산 계층 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
