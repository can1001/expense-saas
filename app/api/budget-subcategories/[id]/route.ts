import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/budget-subcategories/[id] - 예산(목) 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, isActive, sortOrder, categoryId } = body;

    // 예산(목) 존재 확인
    const existing = await prisma.budgetSubcategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '예산(목)을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이름 변경 시 중복 확인 (같은 카테고리 내에서)
    if (name && name.trim() !== existing.name) {
      const checkCategoryId = categoryId || existing.categoryId;
      const duplicate = await prisma.budgetSubcategory.findUnique({
        where: {
          categoryId_name: {
            categoryId: checkCategoryId,
            name: name.trim(),
          },
        },
      });

      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: '같은 예산(항) 내에 이미 존재하는 예산(목)입니다.' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    const subcategory = await prisma.budgetSubcategory.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(subcategory);
  } catch (error) {
    console.error('Error updating budget subcategory:', error);
    return NextResponse.json(
      { error: '예산(목) 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}
