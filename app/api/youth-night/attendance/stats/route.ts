import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// 출석 통계 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const curriculumId = searchParams.get('curriculumId');
    const ageGroup = searchParams.get('ageGroup');

    // 사용자별 출석 통계
    const userStats = await prisma.attendance.groupBy({
      by: ['userId'],
      where: {
        ...(curriculumId && {
          lesson: {
            curriculumId: curriculumId,
          },
        }),
        ...(ageGroup && {
          lesson: {
            curriculum: {
              ageGroup: ageGroup as any,
            },
          },
        }),
        isPresent: true,
      },
      _count: {
        id: true,
      },
    });

    // 레슨별 출석 통계
    const lessonStats = await prisma.attendance.groupBy({
      by: ['lessonId'],
      where: {
        ...(curriculumId && {
          lesson: {
            curriculumId: curriculumId,
          },
        }),
        ...(ageGroup && {
          lesson: {
            curriculum: {
              ageGroup: ageGroup as any,
            },
          },
        }),
        isPresent: true,
      },
      _count: {
        id: true,
      },
    });

    // 현재 사용자의 출석률 계산
    let currentUserStats = null;
    if (curriculumId || ageGroup) {
      const userAttendanceCount = await prisma.attendance.count({
        where: {
          userId: user.id,
          ...(curriculumId && {
            lesson: {
              curriculumId: curriculumId,
            },
          }),
          ...(ageGroup && {
            lesson: {
              curriculum: {
                ageGroup: ageGroup as any,
              },
            },
          }),
          isPresent: true,
        },
      });

      const totalLessonsCount = await prisma.lesson.count({
        where: {
          ...(curriculumId && {
            curriculumId: curriculumId,
          }),
          ...(ageGroup && {
            curriculum: {
              ageGroup: ageGroup as any,
            },
          }),
          isActive: true,
          publishedAt: { not: null },
        },
      });

      currentUserStats = {
        userId: user.id,
        attendedLessons: userAttendanceCount,
        totalLessons: totalLessonsCount,
        attendanceRate: totalLessonsCount > 0 ? Math.round((userAttendanceCount / totalLessonsCount) * 100) : 0,
      };
    }

    return NextResponse.json({
      userStats,
      lessonStats,
      currentUserStats,
    });

  } catch (error) {
    console.error('출석 통계 조회 오류:', error);
    return NextResponse.json({ error: '출석 통계 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}