import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/departments/[id] - 사역팀 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, isActive, sortOrder, committeeId, leaderId } = body;

    // 사역팀 존재 확인
    const existing = await prisma.department.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '사역팀을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이름 변경 시 중복 확인 (같은 위원회 내에서)
    if (name && name.trim() !== existing.name) {
      const targetCommitteeId = committeeId || existing.committeeId;
      const duplicate = await prisma.department.findUnique({
        where: {
          committeeId_name: {
            committeeId: targetCommitteeId,
            name: name.trim(),
          },
        },
      });

      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { error: '같은 위원회 내에 이미 존재하는 사역팀명입니다.' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (committeeId !== undefined) updateData.committeeId = committeeId;
    if (leaderId !== undefined) updateData.leaderId = leaderId || null;

    const department = await prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        leader: {
          select: { id: true, username: true },
        },
      },
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: '사역팀 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id] - 사역팀 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 연결된 예산 세목 확인
    const budgetDetailCount = await prisma.departmentBudgetDetail.count({
      where: { departmentId: id },
    });

    if (budgetDetailCount > 0) {
      return NextResponse.json(
        { error: '연결된 예산 세목이 있는 사역팀은 삭제할 수 없습니다. 비활성화를 사용해주세요.' },
        { status: 400 }
      );
    }

    await prisma.department.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: '사역팀 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
