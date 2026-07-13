import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';

// 새 레슨 생성
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const {
      curriculumId,
      title,
      description,
      bibleVerse,
      keyPoint,
      content,
      videoUrl,
      materialUrl,
    } = body;

    if (!curriculumId || !title) {
      return NextResponse.json(
        { error: '커리큘럼과 제목은 필수입니다' },
        { status: 400 }
      );
    }

    // 해당 커리큘럼의 다음 레슨 번호 계산
    const existingLessons = await prisma.lesson.count({
      where: { curriculumId },
    });
    const nextLessonNumber = existingLessons + 1;

    // 레슨 생성
    const newLesson = await prisma.lesson.create({
      data: {
        curriculumId,
        title,
        description: description || null,
        bibleVerse: bibleVerse || null,
        keyPoint: keyPoint || null,
        content: content || null,
        videoUrl: videoUrl || null,
        materialUrl: materialUrl || null,
        lessonNumber: nextLessonNumber,
        isActive: true,
        publishedAt: null, // 기본적으로 비공개
      },
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

    return NextResponse.json(newLesson);
  } catch (error) {
    console.error('레슨 생성 실패:', error);
    return NextResponse.json(
      { error: '레슨 생성에 실패했습니다' },
      { status: 500 }
    );
  }
};

// 레슨 상세 조회
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE)) {
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
};

// 레슨 수정 (공개/비공개 토글 및 내용 수정)
const handlePut: UserApiHandler = async (request, { user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const {
      lessonId,
      curriculumId,
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

    // 커리큘럼 변경 처리
    if (curriculumId !== undefined) {
      // 현재 레슨의 커리큘럼 확인
      const currentLesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { curriculumId: true },
      });

      if (currentLesson && currentLesson.curriculumId !== curriculumId) {
        // 새 커리큘럼의 마지막 레슨 번호 계산
        const existingLessonsCount = await prisma.lesson.count({
          where: { curriculumId },
        });
        const newLessonNumber = existingLessonsCount + 1;

        updateData.curriculumId = curriculumId;
        updateData.lessonNumber = newLessonNumber;
      }
    }

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
};

// 레슨 순서 변경 (드래그 앤 드랍)
const handlePatch: UserApiHandler = async (request, { user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const { curriculumId, lessonIds } = body;

    if (!curriculumId || !lessonIds || !Array.isArray(lessonIds)) {
      return NextResponse.json(
        { error: 'curriculumId와 lessonIds 배열이 필요합니다' },
        { status: 400 }
      );
    }

    console.log('레슨 순서 변경 요청:', { curriculumId, lessonIds });

    // 유니크 제약 충돌 방지를 위해 임시 음수 번호로 먼저 설정
    for (let i = 0; i < lessonIds.length; i++) {
      await prisma.lesson.update({
        where: { id: lessonIds[i] },
        data: { lessonNumber: -(i + 1) },
      });
    }

    // 그 다음 실제 번호로 업데이트
    for (let i = 0; i < lessonIds.length; i++) {
      await prisma.lesson.update({
        where: { id: lessonIds[i] },
        data: { lessonNumber: i + 1 },
      });
    }

    // 업데이트된 레슨 목록 반환
    const updatedLessons = await prisma.lesson.findMany({
      where: { curriculumId },
      orderBy: { lessonNumber: 'asc' },
      select: {
        id: true,
        title: true,
        lessonNumber: true,
        isActive: true,
        publishedAt: true,
      },
    });

    return NextResponse.json({ success: true, lessons: updatedLessons });
  } catch (error) {
    console.error('레슨 순서 변경 실패:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: '레슨 순서 변경에 실패했습니다', details: errorMessage },
      { status: 500 }
    );
  }
};

// 레슨 삭제
const handleDelete: UserApiHandler = async (request, { user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.YOUTH_MANAGE)) {
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
};

export const POST = withAuth(handlePost);
export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);
