import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

// 관리자 권한 확인
const ADMIN_ROLES = ['admin', 'finance_head', 'accountant', 'team_leader'];

// POST - 퀴즈 문제 순서 변경
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { questionIds } = body;

    if (!questionIds || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { error: 'questionIds 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    // 트랜잭션으로 순서 업데이트
    await prisma.$transaction(
      questionIds.map((id: string, index: number) =>
        prisma.question.update({
          where: { id },
          data: { questionNumber: index + 1 },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('퀴즈 순서 변경 오류:', error);
    return NextResponse.json({ error: '순서 변경에 실패했습니다.' }, { status: 500 });
  }
};

export const POST = withAuth(handlePost);
