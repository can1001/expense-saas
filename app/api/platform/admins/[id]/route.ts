import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';
import { logPlatformActivity } from '@/lib/platform/activity-log';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// SuperAdmin 수정 스키마
const updateAdminSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요.').optional(),
  name: z.string().min(2).max(50).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.').optional(),
});

// GET /api/platform/admins/[id] - SuperAdmin 상세 조회
export const GET = withSuperAdmin(async (
  request: NextRequest,
  { params }
) => {
  try {
    const { id } = await params!;

    const admin = await prismaBase.superAdmin.findUnique({
      where: { id },
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
        { error: '관리자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(admin);
  } catch (error) {
    return handleApiError(error);
  }
});

// PUT /api/platform/admins/[id] - SuperAdmin 수정
export const PUT = withSuperAdmin(async (
  request: NextRequest,
  { params, superAdmin }
) => {
  try {
    const { id } = await params!;
    const body = await request.json();
    const data = updateAdminSchema.parse(body);

    // 기존 관리자 확인
    const existingAdmin = await prismaBase.superAdmin.findUnique({
      where: { id },
    });

    if (!existingAdmin) {
      return NextResponse.json(
        { error: '관리자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이메일 변경 시 중복 확인
    if (data.email && data.email !== existingAdmin.email) {
      const emailExists = await prismaBase.superAdmin.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new ApiError('이미 사용 중인 이메일입니다.', 409);
      }
    }

    // 마지막 활성 관리자 비활성화 방지
    if (data.isActive === false) {
      const activeCount = await prismaBase.superAdmin.count({
        where: { isActive: true },
      });

      if (activeCount <= 1 && existingAdmin.isActive) {
        throw new ApiError('최소 1명의 활성 관리자가 필요합니다.', 400);
      }
    }

    // 업데이트 데이터 준비
    const updateData: Record<string, unknown> = {};
    if (data.email !== undefined) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // 업데이트
    const updatedAdmin = await prismaBase.superAdmin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 활동 로그 기록
    await logPlatformActivity({
      superAdminId: superAdmin.id,
      superAdminEmail: superAdmin.email,
      action: data.isActive === false ? 'DEACTIVATE_USER' : 'UPDATE_USER',
      entityType: 'user',
      entityId: id,
      details: {
        targetType: 'superAdmin',
        targetEmail: updatedAdmin.email,
        changes: Object.keys(data).filter(k => k !== 'password'),
        passwordChanged: !!data.password,
      },
    });

    return NextResponse.json(updatedAdmin);
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

// PATCH는 PUT과 동일
export const PATCH = PUT;

// DELETE /api/platform/admins/[id] - SuperAdmin 삭제
export const DELETE = withSuperAdmin(async (
  request: NextRequest,
  { params, superAdmin }
) => {
  try {
    const { id } = await params!;

    // 기존 관리자 확인
    const existingAdmin = await prismaBase.superAdmin.findUnique({
      where: { id },
    });

    if (!existingAdmin) {
      return NextResponse.json(
        { error: '관리자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 자기 자신 삭제 방지
    if (id === superAdmin.id) {
      throw new ApiError('자기 자신은 삭제할 수 없습니다.', 400);
    }

    // 마지막 관리자 삭제 방지
    const totalCount = await prismaBase.superAdmin.count();
    if (totalCount <= 1) {
      throw new ApiError('최소 1명의 관리자가 필요합니다.', 400);
    }

    // 삭제
    await prismaBase.superAdmin.delete({
      where: { id },
    });

    // 활동 로그 기록
    await logPlatformActivity({
      superAdminId: superAdmin.id,
      superAdminEmail: superAdmin.email,
      action: 'DELETE_USER',
      entityType: 'user',
      entityId: id,
      details: {
        targetType: 'superAdmin',
        deletedEmail: existingAdmin.email,
        deletedName: existingAdmin.name,
      },
    });

    return NextResponse.json({ message: '관리자가 삭제되었습니다.' });
  } catch (error) {
    return handleApiError(error);
  }
});
