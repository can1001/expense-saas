import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * PUT /api/users/me/signatures/[id]/default
 * 기본 서명/도장으로 설정
 */
const handlePut: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params!;
    const currentUser = user;

    // 대상 서명/도장 확인
    const target = await prisma.userSignature.findFirst({
      where: {
        id,
        userId: currentUser.id,
      },
    });

    if (!target) {
      return NextResponse.json(
        { error: '서명/도장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 트랜잭션으로 기본 설정 변경
    await prisma.$transaction(async (tx) => {
      // 같은 타입의 기존 기본 해제
      await tx.userSignature.updateMany({
        where: {
          userId: currentUser.id,
          type: target.type,
          isDefault: true,
        },
        data: { isDefault: false },
      });

      // 대상을 기본으로 설정
      await tx.userSignature.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    return NextResponse.json({
      success: true,
      message: `기본 ${target.type === 'signature' ? '서명' : '도장'}으로 설정되었습니다.`,
    });
  } catch (error: any) {
    console.error('Set default signature error:', error);
    return NextResponse.json(
      { error: '기본 설정 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
};

export const PUT = withAuth(handlePut);
