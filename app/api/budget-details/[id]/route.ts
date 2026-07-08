import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAdmin, UserApiHandler } from '@/lib/auth/user';

// PATCH /api/budget-details/[id] - 예산(세목) 수정
const handlePatch: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;
    const body = await request.json();
    const { name, isActive, sortOrder, subcategoryId, accountCode, description } = body;

    // 예산(세목) 존재 확인
    const existing = await prisma.budgetDetail.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '예산(세목)을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이름 변경 시 중복 확인 (같은 서브카테고리 내에서)
    if (name && name.trim() !== existing.name) {
      const checkSubcategoryId = subcategoryId || existing.subcategoryId;
      const duplicate = await prisma.budgetDetail.findFirst({
        where: {
          subcategoryId: checkSubcategoryId,
          name: name.trim(),
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: '같은 예산(목) 내에 이미 존재하는 예산(세목)입니다.' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (subcategoryId !== undefined) updateData.subcategoryId = subcategoryId;
    if (accountCode !== undefined) updateData.accountCode = accountCode?.trim() || null;
    if (description !== undefined) updateData.description = description?.trim() || null;

    const detail = await prisma.budgetDetail.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error updating budget detail:', error);
    return NextResponse.json(
      { error: '예산(세목) 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
};

export const PATCH = withAdmin(handlePatch);
