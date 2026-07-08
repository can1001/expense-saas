import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

// 랭킹 조회 (GET)
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const ageGroup = searchParams.get('ageGroup');
    const curriculumId = searchParams.get('curriculumId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // 기본 조건 설정
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseWhere: any = {};

    if (ageGroup && ageGroup !== 'all') {
      baseWhere.lesson = {
        curriculum: {
          ageGroup: ageGroup,
        },
      };
    }

    if (curriculumId) {
      if (baseWhere.lesson) {
        baseWhere.lesson.curriculumId = curriculumId;
      } else {
        baseWhere.lesson = {
          curriculumId: curriculumId,
        };
      }
    }

    // 사용자별 총 포인트 및 활동 통계 조회
    const userRankings = await prisma.studentPoints.groupBy({
      by: ['userId'],
      where: baseWhere,
      _sum: {
        points: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          points: 'desc',
        },
      },
      take: limit,
    });

    // 사용자 정보와 상세 통계 추가
    const rankings = await Promise.all(
      userRankings.map(async (ranking, index) => {
        const userInfo = await prisma.user.findUnique({
          where: { id: ranking.userId },
          select: {
            id: true,
            username: true,
            userid: true,
          },
        });

        // 활동별 포인트 분석
        const pointBreakdown = await prisma.studentPoints.groupBy({
          by: ['pointType'],
          where: {
            userId: ranking.userId,
            ...baseWhere,
          },
          _sum: {
            points: true,
          },
          _count: {
            id: true,
          },
        });

        // 출석 통계
        const attendanceStats = await prisma.attendance.count({
          where: {
            userId: ranking.userId,
            isPresent: true,
            ...(baseWhere.lesson && {
              lesson: baseWhere.lesson,
            }),
          },
        });

        // 퀴즈 통계
        const quizStats = await prisma.quizResponse.groupBy({
          by: ['isCorrect'],
          where: {
            userId: ranking.userId,
            ...(baseWhere.lesson && {
              question: {
                lesson: baseWhere.lesson,
              },
            }),
          },
          _count: {
            id: true,
          },
        });

        const totalQuizResponses = quizStats.reduce((sum, stat) => sum + stat._count.id, 0);
        const correctAnswers = quizStats.find(stat => stat.isCorrect)?._count.id || 0;
        const quizAccuracy = totalQuizResponses > 0 ? Math.round((correctAnswers / totalQuizResponses) * 100) : 0;

        // 암송 통계
        const recitationStats = await prisma.recitationSubmission.groupBy({
          by: ['status'],
          where: {
            userId: ranking.userId,
            ...(baseWhere.lesson && {
              lesson: baseWhere.lesson,
            }),
          },
          _count: {
            id: true,
          },
        });

        const approvedRecitations = recitationStats.find(stat => stat.status === 'APPROVED')?._count.id || 0;
        const totalRecitations = recitationStats.reduce((sum, stat) => sum + stat._count.id, 0);

        return {
          rank: index + 1,
          user: userInfo,
          totalPoints: ranking._sum.points || 0,
          totalActivities: ranking._count.id,
          pointBreakdown: pointBreakdown.reduce((acc, item) => {
            acc[item.pointType] = {
              points: item._sum.points || 0,
              count: item._count.id,
            };
            return acc;
          }, {} as Record<string, { points: number; count: number }>),
          stats: {
            attendance: attendanceStats,
            quiz: {
              totalResponses: totalQuizResponses,
              correctAnswers,
              accuracy: quizAccuracy,
            },
            recitation: {
              approved: approvedRecitations,
              total: totalRecitations,
            },
          },
        };
      })
    );

    // 현재 사용자의 랭킹 정보 (limit 밖에 있을 수 있음)
    let currentUserRank = null;
    const currentUserRanking = rankings.find(r => r.user?.id === user.id);

    if (!currentUserRanking) {
      // 현재 사용자가 top N 안에 없는 경우 별도로 조회
      const allUserRankings = await prisma.studentPoints.groupBy({
        by: ['userId'],
        where: baseWhere,
        _sum: {
          points: true,
        },
        orderBy: {
          _sum: {
            points: 'desc',
          },
        },
      });

      const userRankIndex = allUserRankings.findIndex(r => r.userId === user.id);
      if (userRankIndex !== -1) {
        const userRanking = allUserRankings[userRankIndex];

        // 현재 사용자 상세 정보 조회
        const pointBreakdown = await prisma.studentPoints.groupBy({
          by: ['pointType'],
          where: {
            userId: user.id,
            ...baseWhere,
          },
          _sum: {
            points: true,
          },
          _count: {
            id: true,
          },
        });

        currentUserRank = {
          rank: userRankIndex + 1,
          user: {
            id: user.id,
            username: user.username,
            userid: user.userid,
          },
          totalPoints: userRanking._sum.points || 0,
          pointBreakdown: pointBreakdown.reduce((acc, item) => {
            acc[item.pointType] = {
              points: item._sum.points || 0,
              count: item._count.id,
            };
            return acc;
          }, {} as Record<string, { points: number; count: number }>),
        };
      }
    }

    return NextResponse.json({
      rankings,
      currentUserRank: currentUserRank || currentUserRanking,
      totalUsers: await prisma.user.count(),
    });

  } catch (error) {
    console.error('랭킹 조회 오류:', error);
    return NextResponse.json({ error: '랭킹 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
};

export const GET = withAuth(handleGet);
