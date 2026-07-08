import { NextRequest, NextResponse } from 'next/server';
import { prismaBase, Prisma } from '@/lib/prisma';
import { handleApiError, ApiError } from '@/lib/api/error-handler';
import { withSuperAdmin } from '@/lib/auth/super-admin';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

// 사용자 목록 쿼리 스키마
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['createdAt', 'username', 'userid', 'role']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 사용자 생성 스키마
const createUserSchema = z.object({
  userid: z.string().min(3, '아이디는 최소 3자 이상이어야 합니다').max(50),
  username: z.string().min(2, '이름은 최소 2자 이상이어야 합니다').max(100),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  role: z.string().default('user'),
  department: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
});

// GET /api/platform/tenants/[id]/users - 테넌트 사용자 목록
export const GET = withSuperAdmin(async (
  request: NextRequest,
  { params }
) => {
  try {
    const { id: tenantId } = await params!;
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // 쿼리 파라미터 유효성 검사
    const query = listUsersQuerySchema.parse(queryParams);
    const { page, limit, search, role, isActive, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    // 테넌트 존재 확인
    const tenant = await prismaBase.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, maxUsers: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // where 조건 구성
    const where: Prisma.UserWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { userid: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // 정렬 조건
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // 쿼리 실행
    const [users, total] = await Promise.all([
      prismaBase.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
      }),
      prismaBase.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      limits: {
        maxUsers: tenant.maxUsers,
        currentUsers: total,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});

// POST /api/platform/tenants/[id]/users - 테넌트 사용자 생성
export const POST = withSuperAdmin(async (
  request: NextRequest,
  { params }
) => {
  try {
    const { id: tenantId } = await params!;
    const body = await request.json();

    // 유효성 검사
    const data = createUserSchema.parse(body);

    // 테넌트 존재 및 제한 확인
    const tenant = await prismaBase.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        maxUsers: true,
        currentUsers: true,
        isActive: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!tenant.isActive) {
      throw new ApiError('비활성화된 테넌트에는 사용자를 추가할 수 없습니다.', 400);
    }

    // 사용자 수 제한 확인
    const currentUserCount = await prismaBase.user.count({
      where: { tenantId, isActive: true },
    });

    if (currentUserCount >= tenant.maxUsers) {
      throw new ApiError(
        `사용자 수 제한(${tenant.maxUsers}명)에 도달했습니다. 요금제를 업그레이드하거나 기존 사용자를 비활성화하세요.`,
        400
      );
    }

    // userid 중복 확인 (테넌트 내에서)
    const existingUser = await prismaBase.user.findFirst({
      where: { tenantId, userid: data.userid },
    });

    if (existingUser) {
      throw new ApiError('이미 사용 중인 아이디입니다.', 409);
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 사용자 생성 및 현재 사용자 수 업데이트
    const user = await prismaBase.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId,
          userid: data.userid,
          username: data.username,
          password: hashedPassword,
          role: data.role,
          department: data.department,
          phoneNumber: data.phoneNumber,
          isActive: true,
        },
        select: {
          id: true,
          userid: true,
          username: true,
          role: true,
          department: true,
          phoneNumber: true,
          isActive: true,
          createdAt: true,
        },
      });

      // 현재 사용자 수 업데이트
      await tx.tenant.update({
        where: { id: tenantId },
        data: { currentUsers: currentUserCount + 1 },
      });

      return newUser;
    });

    return NextResponse.json(user, { status: 201 });
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
