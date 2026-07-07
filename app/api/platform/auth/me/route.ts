import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';

// GET /api/platform/auth/me - 현재 로그인된 SuperAdmin 정보
export const GET = withSuperAdmin(async (request: NextRequest, { superAdmin }) => {
  try {
    // DB에서 최신 정보 조회
    const admin = await prismaBase.superAdmin.findUnique({
      where: { id: superAdmin.id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: '관리자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      admin,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
