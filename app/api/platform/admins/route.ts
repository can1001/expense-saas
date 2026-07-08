import { NextRequest, NextResponse } from 'next/server';
import { prismaBase } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';
import { logPlatformActivity } from '@/lib/platform/activity-log';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// SuperAdmin 생성 스키마
const createAdminSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다.').max(50),
  isActive: z.boolean().optional().default(true),
});

// GET /api/platform/admins - SuperAdmin 목록 조회
export const GET = withSuperAdmin(async (request: NextRequest) => {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    const admins = await prismaBase.superAdmin.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 총 관리자 수
    const stats = {
      total: await prismaBase.superAdmin.count(),
      active: await prismaBase.superAdmin.count({ where: { isActive: true } }),
    };

    return NextResponse.json({
      admins,
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
});

// POST /api/platform/admins - SuperAdmin 생성
export const POST = withSuperAdmin(async (request: NextRequest, { superAdmin }) => {
  try {
    const body = await request.json();
    const data = createAdminSchema.parse(body);

    // 이메일 중복 확인
    const existing = await prismaBase.superAdmin.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new ApiError('이미 등록된 이메일입니다.', 409);
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 생성
    const newAdmin = await prismaBase.superAdmin.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        isActive: data.isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });

    // 활동 로그 기록
    await logPlatformActivity({
      superAdminId: superAdmin.id,
      superAdminEmail: superAdmin.email,
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: newAdmin.id,
      details: {
        targetType: 'superAdmin',
        email: newAdmin.email,
        name: newAdmin.name,
      },
    });

    return NextResponse.json(newAdmin, { status: 201 });
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
