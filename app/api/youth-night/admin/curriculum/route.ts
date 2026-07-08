import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// 새 커리큘럼과 레슨들 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // 관리자/교사 권한 확인
    const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'team_leader'];
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const { curriculum, lessons } = body;

    // 트랜잭션으로 커리큘럼과 레슨들을 함께 생성
    const result = await prisma.$transaction(async (tx) => {
      // 커리큘럼 생성
      const newCurriculum = await tx.curriculum.create({
        data: {
          title: curriculum.title,
          description: curriculum.description || null,
          type: 'YOUTH_NIGHT',
          ageGroup: curriculum.ageGroup,
          startDate: curriculum.startDate ? new Date(curriculum.startDate) : null,
          endDate: curriculum.endDate ? new Date(curriculum.endDate) : null,
          sortOrder: curriculum.sortOrder || 0,
          isActive: true,
        },
      });

      // 레슨들 생성
      const createdLessons = [];
      for (const lesson of lessons) {
        const newLesson = await tx.lesson.create({
          data: {
            curriculumId: newCurriculum.id,
            title: lesson.title,
            description: lesson.description || null,
            bibleVerse: lesson.bibleVerse || null,
            keyPoint: lesson.keyPoint || null,
            content: lesson.content || null,
            lessonNumber: lesson.lessonNumber,
            isActive: true,
            publishedAt: null, // 기본적으로 비공개
          },
        });
        createdLessons.push(newLesson);
      }

      return { curriculum: newCurriculum, lessons: createdLessons };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('커리큘럼 생성 실패:', error);
    return NextResponse.json(
      { error: '커리큘럼 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 커리큘럼 수정 (전체 필드 수정 지원)
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
      curriculumId,
      title,
      description,
      ageGroup,
      startDate,
      endDate,
      sortOrder,
      isActive,
    } = body;

    // 업데이트할 데이터 객체 구성
    const updateData: Prisma.CurriculumUpdateInput = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (ageGroup !== undefined) updateData.ageGroup = ageGroup;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedCurriculum = await prisma.curriculum.update({
      where: { id: curriculumId },
      data: updateData,
    });

    return NextResponse.json(updatedCurriculum);
  } catch (error) {
    console.error('커리큘럼 수정 실패:', error);
    return NextResponse.json(
      { error: '커리큘럼 수정에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 커리큘럼 삭제
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    // 관리자/교사 권한 확인
    const ALLOWED_ROLES = ['admin', 'finance_head', 'accountant', 'team_leader'];
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const { curriculumId } = body;

    // 관련된 데이터들 함께 삭제 (CASCADE 설정으로 자동 처리됨)
    await prisma.curriculum.delete({
      where: { id: curriculumId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('커리큘럼 삭제 실패:', error);
    return NextResponse.json(
      { error: '커리큘럼 삭제에 실패했습니다' },
      { status: 500 }
    );
  }
}