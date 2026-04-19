import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 레슨 수정 (공개/비공개 토글)
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // 관리자/교사 권한 확인
    const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'team_leader'];
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const { lessonId, publishedAt } = body;

    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        publishedAt: publishedAt ? new Date(publishedAt) : null
      },
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