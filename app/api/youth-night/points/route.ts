import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// 포인트 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const pointType = searchParams.get('pointType');

    // 포인트 기록 조회
    const pointsWhere: any = { userId: user.id };
    if (pointType) {
      pointsWhere.pointType = pointType;
    }

    const points = await prisma.studentPoints.findMany({
      where: pointsWhere,
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
      orderBy: {
        earnedAt: 'desc',
      },
      take: limit,
    });

    // 총 포인트 계산
    const totalPoints = await prisma.studentPoints.aggregate({
      where: { userId: user.id },
      _sum: {
        points: true,
      },
    });

    // 포인트 타입별 통계
    const pointsByType = await prisma.studentPoints.groupBy({
      by: ['pointType'],
      where: { userId: user.id },
      _sum: {
        points: true,
      },
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      totalPoints: totalPoints._sum.points || 0,
      pointsByType,
      recentPoints: points,
    });

  } catch (error) {
    console.error('포인트 조회 오류:', error);
    return NextResponse.json({ error: '포인트 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}

// 포인트 부여 (POST) - 내부 시스템용
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { pointType, points, description, lessonId } = body;

    if (!pointType || !points) {
      return NextResponse.json({ error: '잘못된 요청 데이터입니다' }, { status: 400 });
    }

    // 포인트 타입별 규칙 검증 (RECITATION은 동적 점수이므로 별도 처리)
    const pointRules: Record<string, { points: number; description: string; dynamic?: boolean }> = {
      ATTENDANCE: { points: 5, description: '출석 포인트' },
      QUIZ_PERFECT: { points: 15, description: '퀴즈 만점 포인트' },
      QUIZ_GOOD: { points: 10, description: '퀴즈 우수 포인트' },
      LESSON_COMPLETE: { points: 3, description: '레슨 완료 포인트' },
      RECITATION: { points: 0, description: '암송 포인트', dynamic: true }, // 동적 점수
    };

    const rule = pointRules[pointType];
    if (!rule) {
      return NextResponse.json({ error: '유효하지 않은 포인트 타입입니다' }, { status: 400 });
    }

    // 실제 부여할 점수 결정
    const actualPoints = rule.dynamic ? points : rule.points;

    // 중복 포인트 체크 (출석, 레슨 완료, 암송의 경우)
    if (['ATTENDANCE', 'LESSON_COMPLETE', 'RECITATION'].includes(pointType) && lessonId) {
      const existingPoint = await prisma.studentPoints.findFirst({
        where: {
          userId: user.id,
          pointType,
          lessonId,
        },
      });

      if (existingPoint) {
        return NextResponse.json({
          message: '이미 해당 활동에 대한 포인트를 받았습니다',
          points: existingPoint,
        });
      }
    }

    // 새로운 포인트 기록 생성
    const newPoints = await prisma.studentPoints.create({
      data: {
        userId: user.id,
        pointType,
        points: actualPoints,
        description: description || rule.description,
        lessonId,
      },
      include: {
        lesson: {
          select: {
            title: true,
            lessonNumber: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: '포인트가 부여되었습니다',
      points: newPoints,
    });

  } catch (error) {
    console.error('포인트 부여 오류:', error);
    return NextResponse.json({ error: '포인트 부여 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
}