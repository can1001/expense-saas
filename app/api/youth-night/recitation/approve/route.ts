import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

// 교사 권한 확인 (admin, finance_head, accountant, team_leader 권한 있는 사용자만 승인 가능)
const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'team_leader'];

// 암송 승인/반려 (POST)
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '암송 승인 권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const { submissionId, action, score, rejectionReason } = body;

    if (!submissionId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '잘못된 요청 데이터입니다' }, { status: 400 });
    }

    if (action === 'approve' && (score === undefined || score < 0 || score > 100)) {
      return NextResponse.json({ error: '승인 시 0-100 사이의 점수가 필요합니다' }, { status: 400 });
    }

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json({ error: '반려 시 반려 사유가 필요합니다' }, { status: 400 });
    }

    // 제출 내용 조회
    const submission = await prisma.recitationSubmission.findUnique({
      where: { id: submissionId },
      include: {
        lesson: {
          select: {
            title: true,
            lessonNumber: true,
          },
        },
        user: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: '제출 내용을 찾을 수 없습니다' }, { status: 404 });
    }

    if (submission.status !== 'PENDING') {
      return NextResponse.json({ error: '이미 처리된 제출입니다' }, { status: 400 });
    }

    // 트랜잭션으로 승인 처리 및 포인트 부여
    const result = await prisma.$transaction(async (tx) => {
      // 제출 상태 업데이트
      const updatedSubmission = await tx.recitationSubmission.update({
        where: { id: submissionId },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          approvedBy: user.id,
          approvedAt: new Date(),
          score: action === 'approve' ? score : 0,
          rejectionReason: action === 'reject' ? rejectionReason : null,
        },
        include: {
          lesson: {
            select: {
              title: true,
              lessonNumber: true,
            },
          },
          user: {
            select: {
              username: true,
            },
          },
        },
      });

      let recitationPoints = null;

      // 승인 시 포인트 부여
      if (action === 'approve') {
        // 점수에 따른 포인트 계산
        let pointsToAward = 0;
        if (score >= 95) {
          pointsToAward = 25; // 최우수
        } else if (score >= 85) {
          pointsToAward = 20; // 우수
        } else if (score >= 75) {
          pointsToAward = 15; // 보통
        } else {
          pointsToAward = 10; // 노력상
        }

        recitationPoints = await tx.studentPoints.create({
          data: {
            userId: submission.userId,
            pointType: 'RECITATION',
            points: pointsToAward,
            description: `${submission.lesson.title} 암송 인증 (${score}점)`,
            lessonId: submission.lessonId,
          },
        });
      } else {
        // 반려 시 기존 암송 포인트 삭제 (있다면)
        await tx.studentPoints.deleteMany({
          where: {
            userId: submission.userId,
            pointType: 'RECITATION',
            lessonId: submission.lessonId,
          },
        });
      }

      return { updatedSubmission, recitationPoints };
    });

    return NextResponse.json({
      message: action === 'approve' ? '암송이 승인되었습니다' : '암송이 반려되었습니다',
      submission: result.updatedSubmission,
      pointsAwarded: result.recitationPoints?.points || 0,
    });

  } catch (error) {
    console.error('암송 승인 처리 오류:', error);
    return NextResponse.json({ error: '암송 승인 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
};

// 승인 대기 중인 암송 목록 조회 (GET)
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '암송 승인 권한이 없습니다' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const ageGroup = searchParams.get('ageGroup');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { status };

    if (ageGroup) {
      where.lesson = {
        curriculum: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ageGroup: ageGroup as any,
        },
      };
    }

    const submissions = await prisma.recitationSubmission.findMany({
      where,
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
        approver: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'asc', // 먼저 제출한 순서대로
      },
    });

    return NextResponse.json({ submissions });

  } catch (error) {
    console.error('암송 승인 목록 조회 오류:', error);
    return NextResponse.json({ error: '암송 승인 목록 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
};

export const POST = withAuth(handlePost);
export const GET = withAuth(handleGet);
