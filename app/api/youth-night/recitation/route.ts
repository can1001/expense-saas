import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

// 암송 제출 (POST)
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const body = await request.json();
    const { lessonId, bibleVerse, audioUrl, videoUrl, textContent } = body;

    if (!lessonId || !bibleVerse) {
      return NextResponse.json({ error: 'lessonId와 bibleVerse가 필요합니다' }, { status: 400 });
    }

    if (!audioUrl && !videoUrl && !textContent) {
      return NextResponse.json({ error: '음성, 영상, 또는 텍스트 중 하나는 반드시 제출해야 합니다' }, { status: 400 });
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

    // 기존 제출 확인
    const existingSubmission = await prisma.recitationSubmission.findUnique({
      where: {
        userId_lessonId: {
          userId: user.id,
          lessonId: lessonId,
        },
      },
    });

    if (existingSubmission) {
      // 기존 제출이 있으면 업데이트 (재제출)
      const updatedSubmission = await prisma.recitationSubmission.update({
        where: {
          userId_lessonId: {
            userId: user.id,
            lessonId: lessonId,
          },
        },
        data: {
          bibleVerse,
          audioUrl,
          videoUrl,
          textContent,
          status: 'PENDING', // 다시 대기 상태로
          rejectionReason: null,
          submittedAt: new Date(),
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
        message: '암송이 재제출되었습니다',
        submission: updatedSubmission,
      });
    }

    // 새로운 제출
    const submission = await prisma.recitationSubmission.create({
      data: {
        userId: user.id,
        lessonId,
        bibleVerse,
        audioUrl,
        videoUrl,
        textContent,
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
      message: '암송이 제출되었습니다',
      submission,
    });

  } catch (error) {
    console.error('암송 제출 오류:', error);
    return NextResponse.json({ error: '암송 제출 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
};

// 암송 제출 목록 조회 (GET)
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    const status = searchParams.get('status');

    // 특정 레슨의 제출 조회
    if (lessonId) {
      const submission = await prisma.recitationSubmission.findUnique({
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
            },
          },
          approver: {
            select: {
              username: true,
            },
          },
        },
      });

      return NextResponse.json({ submission });
    }

    // 사용자의 모든 제출 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: user.id };
    if (status) {
      where.status = status;
    }

    const submissions = await prisma.recitationSubmission.findMany({
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
        approver: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    return NextResponse.json({ submissions });

  } catch (error) {
    console.error('암송 제출 조회 오류:', error);
    return NextResponse.json({ error: '암송 제출 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
};

export const POST = withAuth(handlePost);
export const GET = withAuth(handleGet);
