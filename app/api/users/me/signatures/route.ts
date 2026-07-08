import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/users/me/signatures
 * 내 서명/도장 목록 조회
 */
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const currentUser = user;

    const signatures = await prisma.userSignature.findMany({
      where: { userId: currentUser.id },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        type: true,
        name: true,
        imageData: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ signatures });
  } catch (error: any) {
    console.error('Get signatures error:', error);
    return NextResponse.json(
      { error: '서명/도장 목록 조회 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
};

/**
 * POST /api/users/me/signatures
 * 서명/도장 등록
 *
 * Body: {
 *   type: "signature" | "stamp",
 *   name: string,
 *   imageData: string (base64),
 *   isDefault?: boolean
 * }
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const currentUser = user;

    const body = await request.json();
    const { type, name, imageData, isDefault } = body;

    // 유효성 검사
    if (!type || !['signature', 'stamp'].includes(type)) {
      return NextResponse.json(
        { error: '유효하지 않은 타입입니다. (signature 또는 stamp)' },
        { status: 400 }
      );
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: '이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!imageData || !imageData.startsWith('data:image/')) {
      return NextResponse.json(
        { error: '유효하지 않은 이미지 데이터입니다.' },
        { status: 400 }
      );
    }

    // 트랜잭션으로 처리 (기본 설정 시 기존 기본 해제)
    const signature = await prisma.$transaction(async (tx) => {
      // 기본 설정인 경우, 같은 타입의 기존 기본 해제
      if (isDefault) {
        await tx.userSignature.updateMany({
          where: {
            userId: currentUser.id,
            type,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      // 새 서명/도장 생성
      return tx.userSignature.create({
        data: {
          userId: currentUser.id,
          type,
          name: name.trim(),
          imageData,
          isDefault: isDefault || false,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `${type === 'signature' ? '서명' : '도장'}이 등록되었습니다.`,
      signature: {
        id: signature.id,
        type: signature.type,
        name: signature.name,
        imageData: signature.imageData,
        isDefault: signature.isDefault,
        createdAt: signature.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Create signature error:', error);
    return NextResponse.json(
      { error: '서명/도장 등록 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
};

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
