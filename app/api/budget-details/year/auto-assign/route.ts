import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/budget-details/year/auto-assign
 * 부서별 팀장을 해당 세목의 담당자로 자동 설정
 *
 * Body:
 * - year: 연도
 * - overwrite: 기존 담당자 덮어쓰기 여부 (기본: false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, overwrite = false } = body as {
      year: number;
      overwrite?: boolean;
    };

    if (!year) {
      return NextResponse.json({ error: '연도를 지정해주세요' }, { status: 400 });
    }

    // 1. 해당 연도의 팀장 역할 조회 (departmentId 기반)
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

    // 부서별 팀장 매핑 생성 (departmentId → userId)
    const departmentToLeader = new Map<string, string>();
    teamLeaders.forEach((tl) => {
      if (tl.departmentId) {
        departmentToLeader.set(tl.departmentId, tl.userId);
      }
    });

    // 2. 모든 부서-세목 연결 조회
    const departmentDetails = await prisma.departmentBudgetDetail.findMany({
      where: { isActive: true },
      include: {
        department: {
          include: {
            committee: true,
          },
        },
        budgetDetail: true,
      },
    });

    // 3. 각 세목에 대해 담당자 설정
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const results: Array<{
      budgetDetailId: string;
      budgetDetailName: string;
      department: string;
      managerId: string | null;
      managerName: string | null;
      action: 'created' | 'updated' | 'skipped';
    }> = [];

    for (const dd of departmentDetails) {
      const committeeDept = `${dd.department.committee.name}/${dd.department.name}`;

      // 팀장 찾기 (departmentId로 직접 조회)
      const leaderId = departmentToLeader.get(dd.departmentId);

      // 팀장이 없으면 스킵
      if (!leaderId) {
        skippedCount++;
        results.push({
          budgetDetailId: dd.budgetDetailId,
          budgetDetailName: dd.budgetDetail.name,
          department: committeeDept,
          managerId: null,
          managerName: null,
          action: 'skipped',
        });
        continue;
      }

      // 기존 설정 확인
      const existing = await prisma.budgetDetailYear.findUnique({
        where: {
          budgetDetailId_year: {
            budgetDetailId: dd.budgetDetailId,
            year,
          },
        },
      });

      // 기존 담당자가 있고 덮어쓰기 false면 스킵
      if (existing?.managerId && !overwrite) {
        skippedCount++;
        results.push({
          budgetDetailId: dd.budgetDetailId,
          budgetDetailName: dd.budgetDetail.name,
          department: committeeDept,
          managerId: existing.managerId,
          managerName: null,
          action: 'skipped',
        });
        continue;
      }

      // 팀장 정보 조회
      const leader = teamLeaders.find((tl) => tl.userId === leaderId);

      // upsert
      await prisma.budgetDetailYear.upsert({
        where: {
          budgetDetailId_year: {
            budgetDetailId: dd.budgetDetailId,
            year,
          },
        },
        update: {
          managerId: leaderId,
        },
        create: {
          budgetDetailId: dd.budgetDetailId,
          year,
          managerId: leaderId,
          budgetAmount: 0,
          usedAmount: 0,
          isActive: true,
        },
      });

      if (existing) {
        updatedCount++;
        results.push({
          budgetDetailId: dd.budgetDetailId,
          budgetDetailName: dd.budgetDetail.name,
          department: committeeDept,
          managerId: leaderId,
          managerName: leader?.user.username || null,
          action: 'updated',
        });
      } else {
        createdCount++;
        results.push({
          budgetDetailId: dd.budgetDetailId,
          budgetDetailName: dd.budgetDetail.name,
          department: committeeDept,
          managerId: leaderId,
          managerName: leader?.user.username || null,
          action: 'created',
        });
      }
    }

    return NextResponse.json({
      message: `담당자 자동 설정 완료`,
      year,
      summary: {
        total: departmentDetails.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        teamLeadersFound: teamLeaders.length,
      },
      results: results.slice(0, 20), // 처음 20개만 반환
    });
  } catch (error) {
    console.error('담당자 자동 설정 오류:', error);
    return NextResponse.json({ error: '담당자 자동 설정 실패' }, { status: 500 });
  }
}
