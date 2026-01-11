import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';

/**
 * 현재 로그인한 사용자 조회 (세션 기반)
 */
async function getCurrentUser() {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
}

/**
 * GET /api/users/me/signatures/[id]
 * 특정 서명/도장 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const signature = await prisma.userSignature.findFirst({
      where: {
        id,
        userId: currentUser.id,
      },
    });

    if (!signature) {
      return NextResponse.json(
        { error: '서명/도장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ signature });
  } catch (error: any) {
    console.error('Get signature error:', error);
    return NextResponse.json(
      { error: '서명/도장 조회 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/me/signatures/[id]
 * 서명/도장 수정
 *
 * Body: {
 *   name?: string,
 *   imageData?: string (base64),
 *   isDefault?: boolean
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 기존 서명/도장 확인
    const existing = await prisma.userSignature.findFirst({
      where: {
        id,
        userId: currentUser.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '서명/도장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, imageData, isDefault } = body;

    // 유효성 검사
    if (imageData && !imageData.startsWith('data:image/')) {
      return NextResponse.json(
        { error: '유효하지 않은 이미지 데이터입니다.' },
        { status: 400 }
      );
    }

    // 트랜잭션으로 처리
    const signature = await prisma.$transaction(async (tx) => {
      // 기본 설정인 경우, 같은 타입의 기존 기본 해제
      if (isDefault === true) {
        await tx.userSignature.updateMany({
          where: {
            userId: currentUser.id,
            type: existing.type,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }

      // 업데이트
      return tx.userSignature.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(imageData !== undefined && { imageData }),
          ...(isDefault !== undefined && { isDefault }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: '수정되었습니다.',
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
    console.error('Update signature error:', error);
    return NextResponse.json(
      { error: '서명/도장 수정 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/me/signatures/[id]
 * 서명/도장 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 기존 서명/도장 확인
    const existing = await prisma.userSignature.findFirst({
      where: {
        id,
        userId: currentUser.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '서명/도장을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await prisma.userSignature.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `${existing.type === 'signature' ? '서명' : '도장'}이 삭제되었습니다.`,
    });
  } catch (error: any) {
    console.error('Delete signature error:', error);
    return NextResponse.json(
      { error: '서명/도장 삭제 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
