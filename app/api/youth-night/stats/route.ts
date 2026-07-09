import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

// 전체 통계 조회 (GET)
const handleGet: UserApiHandler = async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const ageGroup = searchParams.get('ageGroup');
    const curriculumId = searchParams.get('curriculumId');
    const tenantId = context.user.tenantId;

    // 기본 조건 설정
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseWhere: any = {};

    if (ageGroup && ageGroup !== 'all') {
      baseWhere.curriculum = {
        ageGroup: ageGroup,
      };
    }

    if (curriculumId) {
      if (baseWhere.curriculum) {
        baseWhere.curriculum.id = curriculumId;
      } else {
        baseWhere.curriculum = {
          id: curriculumId,
        };
      }
    }

    // 전체 통계
    const totalStats = await Promise.all([
      // 총 사용자 수
      prisma.user.count(),

      // 활성 커리큘럼 수
      prisma.curriculum.count({
        where: {
          isActive: true,
          type: 'YOUTH_NIGHT',
          ...(ageGroup && ageGroup !== 'all' && {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ageGroup: ageGroup as any,
          }),
        },
      }),

      // 총 레슨 수
      prisma.lesson.count({
        where: {
          isActive: true,
          publishedAt: { not: null },
          ...baseWhere,
        },
      }),

      // 총 출석 기록
      prisma.attendance.count({
        where: {
          isPresent: true,
          lesson: baseWhere,
        },
      }),

      // 총 퀴즈 응답
      prisma.quizResponse.count({
        where: {
          question: {
            lesson: baseWhere,
          },
        },
      }),

      // 총 암송 제출
      prisma.recitationSubmission.count({
        where: {
          lesson: baseWhere,
        },
      }),

      // 총 포인트
      prisma.studentPoints.aggregate({
        where: {
          ...(baseWhere.curriculum && {
            lesson: {
              curriculum: baseWhere.curriculum,
            },
          }),
        },
        _sum: {
          points: true,
        },
      }),
    ]);

    // 일별 활동 통계 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 테넌트 필터링 적용된 Raw SQL
    const dailyActivity = await prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as activities
      FROM (
        SELECT created_at FROM "Attendance"
        WHERE is_present = true
          AND created_at >= ${thirtyDaysAgo}
          AND tenant_id = ${tenantId}
        UNION ALL
        SELECT submitted_at as created_at FROM "QuizResponse"
        WHERE submitted_at >= ${thirtyDaysAgo}
          AND tenant_id = ${tenantId}
        UNION ALL
        SELECT created_at FROM "RecitationSubmission"
        WHERE created_at >= ${thirtyDaysAgo}
          AND tenant_id = ${tenantId}
      ) as activities
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    // 포인트 타입별 분포
    const pointDistribution = await prisma.studentPoints.groupBy({
      by: ['pointType'],
      where: {
        ...(baseWhere.curriculum && {
          lesson: {
            curriculum: baseWhere.curriculum,
          },
        }),
      },
      _sum: {
        points: true,
      },
      _count: {
        id: true,
      },
    });

    // 상위 학습자 (간단한 버전)
    const topLearners = await prisma.studentPoints.groupBy({
      by: ['userId'],
      where: {
        ...(baseWhere.curriculum && {
          lesson: {
            curriculum: baseWhere.curriculum,
          },
        }),
      },
      _sum: {
        points: true,
      },
      orderBy: {
        _sum: {
          points: 'desc',
        },
      },
      take: 5,
    });

    // 사용자 정보 추가
    const topLearnersWithInfo = await Promise.all(
      topLearners.map(async (learner) => {
        const userInfo = await prisma.user.findUnique({
          where: { id: learner.userId },
          select: {
            id: true,
            username: true,
          },
        });
        return {
          user: userInfo,
          totalPoints: learner._sum.points || 0,
        };
      })
    );

    return NextResponse.json({
      overview: {
        totalUsers: totalStats[0],
        activeCurriculums: totalStats[1],
        totalLessons: totalStats[2],
        totalAttendance: totalStats[3],
        totalQuizResponses: totalStats[4],
        totalRecitations: totalStats[5],
        totalPoints: totalStats[6]._sum.points || 0,
      },
      dailyActivity,
      pointDistribution: pointDistribution.map(item => ({
        type: item.pointType,
        totalPoints: item._sum.points || 0,
        count: item._count.id,
      })),
      topLearners: topLearnersWithInfo,
    });

  } catch (error) {
    console.error('통계 조회 오류:', error);
    return NextResponse.json({ error: '통계 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
};

export const GET = withAuth(handleGet);
