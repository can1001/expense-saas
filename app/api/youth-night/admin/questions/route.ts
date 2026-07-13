import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';

// GET - 레슨별 퀴즈 문제 목록 조회
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE)) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId가 필요합니다.' }, { status: 400 });
    }

    const questions = await prisma.question.findMany({
      where: { lessonId },
      orderBy: { questionNumber: 'asc' },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('퀴즈 조회 오류:', error);
    return NextResponse.json({ error: '퀴즈를 불러오는데 실패했습니다.' }, { status: 500 });
  }
};

// POST - 새 퀴즈 문제 추가
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE)) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      lessonId,
      questionText,
      questionType = 'MULTIPLE_CHOICE',
      option1,
      option2,
      option3,
      option4,
      correctAnswer,
      explanation,
    } = body;

    if (!lessonId || !questionText || !correctAnswer) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 현재 최대 questionNumber 조회
    const maxQuestion = await prisma.question.findFirst({
      where: { lessonId },
      orderBy: { questionNumber: 'desc' },
      select: { questionNumber: true },
    });

    const questionNumber = (maxQuestion?.questionNumber || 0) + 1;

    const question = await prisma.question.create({
      data: {
        lessonId,
        questionText,
        questionType,
        option1,
        option2,
        option3,
        option4,
        correctAnswer,
        explanation,
        questionNumber,
      },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    console.error('퀴즈 생성 오류:', error);
    return NextResponse.json({ error: '퀴즈 생성에 실패했습니다.' }, { status: 500 });
  }
};

// PUT - 퀴즈 문제 수정
const handlePut: UserApiHandler = async (request, { user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE)) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      questionText,
      questionType,
      option1,
      option2,
      option3,
      option4,
      correctAnswer,
      explanation,
    } = body;

    if (!id) {
      return NextResponse.json({ error: '문제 ID가 필요합니다.' }, { status: 400 });
    }

    const question = await prisma.question.update({
      where: { id },
      data: {
        questionText,
        questionType,
        option1,
        option2,
        option3,
        option4,
        correctAnswer,
        explanation,
      },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error('퀴즈 수정 오류:', error);
    return NextResponse.json({ error: '퀴즈 수정에 실패했습니다.' }, { status: 500 });
  }
};

// DELETE - 퀴즈 문제 삭제
const handleDelete: UserApiHandler = async (request, { user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE)) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '문제 ID가 필요합니다.' }, { status: 400 });
    }

    await prisma.question.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('퀴즈 삭제 오류:', error);
    return NextResponse.json({ error: '퀴즈 삭제에 실패했습니다.' }, { status: 500 });
  }
};

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
