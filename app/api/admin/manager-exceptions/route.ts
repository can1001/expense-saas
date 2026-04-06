import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 담당자 예외 현황 API
 *
 * GET /api/admin/manager-exceptions?year=2026
 *
 * 세목별 담당자가 해당 사역팀장과 다른 케이스 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // 1. 연도별 팀장 목록 조회 (departmentId별로 매핑)
    const teamLeaders = await prisma.userYearRole.findMany({
      where: {
        year,
        role: 'team_leader',
        departmentId: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // departmentId -> teamLeader 매핑
    const deptLeaderMap = new Map<string, { id: string; name: string }>();
    for (const tl of teamLeaders) {
      if (tl.departmentId) {
        deptLeaderMap.set(tl.departmentId, {
          id: tl.userId,
          name: tl.user.username,
        });
      }
    }

    // 2. 연도별 세목 담당자 조회
    const budgetDetails = await prisma.budgetDetailYear.findMany({
      where: {
        year,
        isActive: true,
        managerId: {
          not: null,
        },
      },
      include: {
        manager: {
          select: {
            id: true,
            username: true,
          },
        },
        budgetDetail: {
          include: {
            subcategory: {
              include: {
                category: true,
              },
            },
            departmentDetails: {
              include: {
                department: {
                  include: {
                    committee: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 3. 예외 케이스 필터링
    const exceptions: Array<{
      budgetDetailId: string;
      budgetDetailYearId: string;
      committee: string;
      department: string;
      category: string;
      subcategory: string;
      detail: string;
      teamLeader: { id: string; name: string } | null;
      manager: { id: string; name: string };
    }> = [];

    let totalDetails = 0;

    for (const bd of budgetDetails) {
      // 각 세목이 연결된 부서 확인
      for (const dd of bd.budgetDetail.departmentDetails) {
        totalDetails++;
        const teamLeader = deptLeaderMap.get(dd.departmentId) || null;

        // 담당자와 팀장이 다른 경우만 예외로 추가
        if (bd.manager && (!teamLeader || teamLeader.id !== bd.managerId)) {
          exceptions.push({
            budgetDetailId: bd.budgetDetailId,
            budgetDetailYearId: bd.id,
            committee: dd.department.committee.name,
            department: dd.department.name,
            category: bd.budgetDetail.subcategory.category.name,
            subcategory: bd.budgetDetail.subcategory.name,
            detail: bd.budgetDetail.name,
            teamLeader,
            manager: {
              id: bd.manager.id,
              name: bd.manager.username,
            },
          });
        }
      }
    }

    // 4. 위원회, 부서, 세목 순으로 정렬
    exceptions.sort((a, b) => {
      if (a.committee !== b.committee) return a.committee.localeCompare(b.committee);
      if (a.department !== b.department) return a.department.localeCompare(b.department);
      return a.detail.localeCompare(b.detail);
    });

    // 5. 요약 통계
    const exceptionCount = exceptions.length;
    const exceptionRate = totalDetails > 0 ? Math.round((exceptionCount / totalDetails) * 1000) / 10 : 0;

    return NextResponse.json({
      year,
      summary: {
        totalDetails,
        exceptionCount,
        exceptionRate,
      },
      exceptions,
    });
  } catch (error) {
    console.error('Manager exceptions API error:', error);
    return NextResponse.json(
      { error: '담당자 예외 현황을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
