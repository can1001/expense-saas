import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, UserApiHandler } from '@/lib/auth/user';

// PATCH /api/budget-details/[id]/description - 적요 예제 수정
const handlePatch: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;
    const body = await request.json();
    const { description } = body as { description: string };

    if (description === undefined) {
      return NextResponse.json(
        { error: 'description 필드가 필요합니다.' },
        { status: 400 }
      );
    }

    // 세목 존재 확인
    const existing = await prisma.budgetDetail.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '세목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // description 업데이트
    const updated = await prisma.budgetDetail.update({
      where: { id },
      data: {
        description: description.trim() || null,
      },
    });

    return NextResponse.json({
      success: true,
      budgetDetail: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
      },
    });
  } catch (error) {
    console.error('Error updating budget detail description:', error);
    return NextResponse.json(
      { error: '적요 예제 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
};

export const PATCH = withAdmin(handlePatch);
