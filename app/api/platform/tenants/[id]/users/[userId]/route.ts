import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

// 사용자 수정 스키마
const updateUserSchema = z.object({
  username: z.string().min(2, '이름은 최소 2자 이상이어야 합니다').max(100).optional(),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다').optional(),
  role: z.string().optional(),
  department: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /api/platform/tenants/[id]/users/[userId] - 사용자 상세 조회
export const GET = withSuperAdmin(async (
  request: NextRequest,
  { params }
) => {
  try {
    const { id: tenantId, userId } = await params!;

    // 테넌트 확인
    const tenant = await prismaBase.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사용자 조회
    const user = await prismaBase.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        userid: true,
        username: true,
        role: true,
        department: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 최근 지출결의서 활동
    const recentExpenses = await prismaBase.expense.findMany({
      where: { tenantId, applicantName: user.username },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        requestAmount: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...user,
      recentActivity: {
        expenses: recentExpenses,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});

// PUT /api/platform/tenants/[id]/users/[userId] - 사용자 수정
export const PUT = withSuperAdmin(async (
  request: NextRequest,
  { params }
) => {
  try {
    const { id: tenantId, userId } = await params!;
    const body = await request.json();

    // 유효성 검사
    const data = updateUserSchema.parse(body);

    // 기존 사용자 확인
    const existingUser = await prismaBase.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 업데이트 데이터 준비
    const updateData: Record<string, unknown> = { ...data };

    // 비밀번호 변경 시 해싱
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // 활성화 상태 변경 시 테넌트 currentUsers 업데이트
    if (data.isActive !== undefined && data.isActive !== existingUser.isActive) {
      const tenant = await prismaBase.tenant.findUnique({
        where: { id: tenantId },
        select: { maxUsers: true },
      });

      if (data.isActive) {
        // 비활성 → 활성: 사용자 수 제한 확인
        const activeUserCount = await prismaBase.user.count({
          where: { tenantId, isActive: true },
        });

        if (tenant && activeUserCount >= tenant.maxUsers) {
          throw new ApiError(
            `사용자 수 제한(${tenant.maxUsers}명)에 도달했습니다.`,
            400
          );
        }
      }
    }

    // 사용자 업데이트
    const user = await prismaBase.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          userid: true,
          username: true,
          role: true,
          department: true,
          phoneNumber: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // 활성화 상태 변경 시 currentUsers 업데이트
      if (data.isActive !== undefined && data.isActive !== existingUser.isActive) {
        const activeUserCount = await tx.user.count({
          where: { tenantId, isActive: true },
        });

        await tx.tenant.update({
          where: { id: tenantId },
          data: { currentUsers: activeUserCount },
        });
      }

      return updatedUser;
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { errors?: Array<{ path: string[]; message: string }> };
      const errorMessages = zodError.errors?.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return NextResponse.json(
        { error: '입력 데이터가 유효하지 않습니다.', details: errorMessages },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
});

// DELETE /api/platform/tenants/[id]/users/[userId] - 사용자 삭제
export const DELETE = withSuperAdmin(async (
  request: NextRequest,
  { params }
) => {
  try {
    const { id: tenantId, userId } = await params!;
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get('hard') === 'true';

    // 기존 사용자 확인
    const existingUser = await prismaBase.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (hardDelete) {
      // 하드 삭제: 연관 데이터가 있으면 삭제 불가
      if (existingUser._count.expenses > 0) {
        throw new ApiError(
          '지출 기록이 있는 사용자는 완전히 삭제할 수 없습니다. 비활성화를 사용하세요.',
          400
        );
      }

      await prismaBase.$transaction(async (tx) => {
        await tx.user.delete({
          where: { id: userId },
        });

        // currentUsers 업데이트
        if (existingUser.isActive) {
          const activeUserCount = await tx.user.count({
            where: { tenantId, isActive: true },
          });

          await tx.tenant.update({
            where: { id: tenantId },
            data: { currentUsers: activeUserCount },
          });
        }
      });

      return NextResponse.json({ message: '사용자가 완전히 삭제되었습니다.' });
    } else {
      // 소프트 삭제: 비활성화
      await prismaBase.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { isActive: false },
        });

        // currentUsers 업데이트
        if (existingUser.isActive) {
          const activeUserCount = await tx.user.count({
            where: { tenantId, isActive: true },
          });

          await tx.tenant.update({
            where: { id: tenantId },
            data: { currentUsers: activeUserCount - 1 },
          });
        }
      });

      return NextResponse.json({ message: '사용자가 비활성화되었습니다.' });
    }
  } catch (error) {
    return handleApiError(error);
  }
});
