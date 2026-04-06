import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/committees/[id] - 위원회 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, isActive, sortOrder, leaderId } = body;

    // 위원회 존재 확인
    const existing = await prisma.committee.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '위원회를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이름 변경 시 중복 확인
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.committee.findUnique({
        where: { name: name.trim() },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: '이미 존재하는 위원회명입니다.' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (leaderId !== undefined) updateData.leaderId = leaderId || null;

    const committee = await prisma.committee.update({
      where: { id },
      data: updateData,
      include: {
        leader: {
          select: { id: true, username: true },
        },
      },
    });

    return NextResponse.json(committee);
  } catch (error) {
    console.error('Error updating committee:', error);
    return NextResponse.json(
      { error: '위원회 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/committees/[id] - 위원회 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 하위 사역팀 확인
    const departmentCount = await prisma.department.count({
      where: { committeeId: id },
    });

    if (departmentCount > 0) {
      return NextResponse.json(
        { error: '하위 사역팀이 있는 위원회는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    await prisma.committee.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting committee:', error);
    return NextResponse.json(
      { error: '위원회 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
