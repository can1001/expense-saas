import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';
import { OfferingType } from '@prisma/client';
import { mapKoreanTypeToEnum } from '@/lib/constants/offering-types';


/**
 * GET /api/admin/offerings/[id]
 * 헌금 상세 조회
 */
const handleGet: UserApiHandler = async (request, { params, user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.OFFERING_MANAGE)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;

    const offering = await prisma.offering.findUnique({
      where: { id },
    });

    if (!offering) {
      return NextResponse.json(
        { error: '헌금 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...offering,
      date: offering.date.toISOString().slice(0, 10),
    });
  } catch (error: unknown) {
    console.error('Get offering error:', error);
    return NextResponse.json(
      { error: '헌금 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

/**
 * PUT /api/admin/offerings/[id]
 * 헌금 수정
 */
const handlePut: UserApiHandler = async (request, { params, user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.OFFERING_MANAGE)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { date, name, type, amount, memo } = body;

    // 기존 헌금 확인
    const existingOffering = await prisma.offering.findUnique({
      where: { id },
    });

    if (!existingOffering) {
      return NextResponse.json(
        { error: '헌금 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 한글 타입을 enum으로 변환
    let offeringType: OfferingType | undefined;
    if (type !== undefined) {
      if (Object.values(OfferingType).includes(type as OfferingType)) {
        offeringType = type as OfferingType;
      } else {
        const mapped = mapKoreanTypeToEnum(type);
        offeringType = mapped || 'OTHER';
      }
    }

    const offering = await prisma.offering.update({
      where: { id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(name !== undefined && { name }),
        ...(offeringType !== undefined && { type: offeringType }),
        ...(amount !== undefined && { amount: Number(amount) }),
        ...(memo !== undefined && { memo: memo || null }),
      },
    });

    return NextResponse.json({
      success: true,
      offering: {
        ...offering,
        date: offering.date.toISOString().slice(0, 10),
      },
    });
  } catch (error: unknown) {
    console.error('Update offering error:', error);
    return NextResponse.json(
      { error: '헌금 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/admin/offerings/[id]
 * 헌금 삭제
 */
const handleDelete: UserApiHandler = async (request, { params, user }) => {
  try {
    if (!roleHasPermission(user.role, PERMISSIONS.OFFERING_MANAGE)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;

    // 기존 헌금 확인
    const existingOffering = await prisma.offering.findUnique({
      where: { id },
    });

    if (!existingOffering) {
      return NextResponse.json(
        { error: '헌금 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await prisma.offering.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '헌금이 삭제되었습니다.',
    });
  } catch (error: unknown) {
    console.error('Delete offering error:', error);
    return NextResponse.json(
      { error: '헌금 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
