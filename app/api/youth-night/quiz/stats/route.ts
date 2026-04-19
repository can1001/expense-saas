import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// 퀴즈 통계 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const curriculumId = searchParams.get('curriculumId');
    const ageGroup = searchParams.get('ageGroup');
    const lessonId = searchParams.get('lessonId');

    // 기본 where 조건
    const baseWhere: any = {
      userId: user.id,
    };

    if (lessonId) {
      baseWhere.question = { lessonId };
    } else if (curriculumId) {
      baseWhere.question = {
        lesson: { curriculumId },
      };
    } else if (ageGroup) {
      baseWhere.question = {
        lesson: {
          curriculum: { ageGroup: ageGroup as any },
        },
      };
    }

    // 사용자의 퀴즈 응답 통계
    const responses = await prisma.quizResponse.findMany({
      where: baseWhere,
      include: {
        question: {
          include: {
            lesson: {
              select: {
                id: true,
                title: true,
                lessonNumber: true,
                curriculum: {
                  select: {
                    title: true,
                    ageGroup: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 레슨별 그룹화
    const lessonStats = responses.reduce((acc, response) => {
      const lessonId = response.question.lesson.id;
      if (!acc[lessonId]) {
        acc[lessonId] = {
          lesson: response.question.lesson,
          totalQuestions: 0,
          correctAnswers: 0,
          totalScore: 0,
          maxScore: 0,
        };
      }

      acc[lessonId].totalQuestions += 1;
      acc[lessonId].totalScore += response.score;
      acc[lessonId].maxScore += 10;

      if (response.isCorrect) {
        acc[lessonId].correctAnswers += 1;
      }

      return acc;
    }, {} as any);

    // 각 레슨의 백분율 계산
    Object.keys(lessonStats).forEach(lessonId => {
      const stat = lessonStats[lessonId];
      stat.percentage = stat.maxScore > 0 ? Math.round((stat.totalScore / stat.maxScore) * 100) : 0;
    });

    // 전체 통계
    const totalStats = {
      totalLessons: Object.keys(lessonStats).length,
      totalQuestions: responses.length,
      correctAnswers: responses.filter(r => r.isCorrect).length,
      totalScore: responses.reduce((sum, r) => sum + r.score, 0),
      maxScore: responses.length * 10,
      averagePercentage: 0,
    };

    if (totalStats.maxScore > 0) {
      totalStats.averagePercentage = Math.round((totalStats.totalScore / totalStats.maxScore) * 100);
    }

    // 최근 응답 기록 (최대 10개)
    const recentResponses = await prisma.quizResponse.findMany({
      where: baseWhere,
      include: {
        question: {
          select: {
            questionNumber: true,
            questionText: true,
            lesson: {
              select: {
                title: true,
                lessonNumber: true,
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
      take: 10,
    });

    return NextResponse.json({
      totalStats,
      lessonStats: Object.values(lessonStats),
      recentResponses,
    });

  } catch (error) {
    console.error('퀴즈 통계 조회 오류:', error);
    return NextResponse.json({ error: '퀴즈 통계 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}