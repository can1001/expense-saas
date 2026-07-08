import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, UserApiHandler } from '@/lib/auth/user';

// PATCH /api/budget-categories/[id] - 예산(항) 수정
const handlePatch: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;
    const body = await request.json();
    const { name, isActive, sortOrder } = body;

    // 예산(항) 존재 확인
    const existing = await prisma.budgetCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '예산(항)을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이름 변경 시 중복 확인
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.budgetCategory.findFirst({
        where: { name: name.trim() },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: '이미 존재하는 예산(항)입니다.' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const category = await prisma.budgetCategory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating budget category:', error);
    return NextResponse.json(
      { error: '예산(항) 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
};

export const PATCH = withAdmin(handlePatch);
