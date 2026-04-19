import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 레슨 상세 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // 관리자/교사 권한 확인
    const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'team_leader'];
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId가 필요합니다' }, { status: 400 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        curriculum: {
          select: {
            id: true,
            title: true,
            ageGroup: true,
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: '레슨을 찾을 수 없습니다' }, { status: 404 });
    }

    return NextResponse.json(lesson);
  } catch (error) {
    console.error('레슨 조회 실패:', error);
    return NextResponse.json(
      { error: '레슨 조회에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 레슨 수정 (공개/비공개 토글 및 내용 수정)
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // 관리자/교사 권한 확인
    const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'team_leader'];
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const {
      lessonId,
      publishedAt,
      title,
      description,
      bibleVerse,
      keyPoint,
      content,
      videoUrl,
      materialUrl,
    } = body;

    // 업데이트할 데이터 객체 구성
    const updateData: Record<string, unknown> = {};

    // publishedAt은 명시적으로 전달된 경우에만 처리
    if (publishedAt !== undefined) {
      updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
    }

    // 다른 필드들은 전달된 경우에만 업데이트
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (bibleVerse !== undefined) updateData.bibleVerse = bibleVerse;
    if (keyPoint !== undefined) updateData.keyPoint = keyPoint;
    if (content !== undefined) updateData.content = content;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (materialUrl !== undefined) updateData.materialUrl = materialUrl;

    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: updateData,
    });

    return NextResponse.json(updatedLesson);
  } catch (error) {
    console.error('레슨 수정 실패:', error);
    return NextResponse.json(
      { error: '레슨 수정에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 레슨 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // 관리자/교사 권한 확인
    const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'team_leader'];
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const { lessonId } = body;

    // 관련된 데이터들 함께 삭제 (CASCADE 설정으로 자동 처리됨)
    await prisma.lesson.delete({
      where: { id: lessonId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('레슨 삭제 실패:', error);
    return NextResponse.json(
      { error: '레슨 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}