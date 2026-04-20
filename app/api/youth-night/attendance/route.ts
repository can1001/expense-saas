import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// 출석 체크 (POST)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { lessonId } = body;

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId가 필요합니다' }, { status: 400 });
    }

    // 레슨 존재 여부 확인
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        isActive: true,
        publishedAt: { not: null },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: '유효하지 않은 레슨입니다' }, { status: 404 });
    }

    // 이미 출석 체크했는지 확인
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        userId_lessonId: {
          userId: user.id,
          lessonId: lessonId,
        },
      },
    });

    if (existingAttendance) {
      return NextResponse.json({
        message: '이미 출석 체크되었습니다',
        attendance: existingAttendance
      });
    }

    // 트랜잭션으로 출석 기록과 포인트 동시 생성
    const result = await prisma.$transaction(async (tx) => {
      // 새로운 출석 기록 생성
      const attendance = await tx.attendance.create({
        data: {
          userId: user.id,
          lessonId: lessonId,
          isPresent: true,
        },
        include: {
          user: {
            select: {
              username: true,
            },
          },
          lesson: {
            select: {
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
      });

      // 출석 포인트 부여 (중복 체크)
      const existingPoint = await tx.studentPoints.findFirst({
        where: {
          userId: user.id,
          pointType: 'ATTENDANCE',
          lessonId: lessonId,
        },
      });

      let attendancePoints = null;
      if (!existingPoint) {
        attendancePoints = await tx.studentPoints.create({
          data: {
            userId: user.id,
            pointType: 'ATTENDANCE',
            points: 5,
            description: `${attendance.lesson.title} 출석 포인트`,
            lessonId: lessonId,
          },
        });
      }

      return { attendance, attendancePoints };
    });

    return NextResponse.json({
      message: '출석 체크가 완료되었습니다',
      attendance: result.attendance,
      pointsEarned: result.attendancePoints ? 5 : 0,
    });

  } catch (error) {
    console.error('출석 체크 오류:', error);
    return NextResponse.json({ error: '출석 체크 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
}

// 출석 기록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    const curriculumId = searchParams.get('curriculumId');

    if (lessonId) {
      // 특정 레슨의 출석 기록 조회
      const attendance = await prisma.attendance.findUnique({
        where: {
          userId_lessonId: {
            userId: user.id,
            lessonId: lessonId,
          },
        },
        include: {
          lesson: {
            select: {
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
      });

      return NextResponse.json({ attendance });
    }

    // 사용자의 전체 출석 기록 조회
    const where: any = {
      userId: user.id,
    };

    if (curriculumId) {
      where.lesson = {
        curriculumId: curriculumId,
      };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        lesson: {
          select: {
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
      orderBy: [
        { lesson: { lessonNumber: 'asc' } },
        { attendedAt: 'desc' },
      ],
    });

    return NextResponse.json({ attendances });

  } catch (error) {
    console.error('출석 기록 조회 오류:', error);
    return NextResponse.json({ error: '출석 기록 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}