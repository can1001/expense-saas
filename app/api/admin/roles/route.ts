import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { UserApiHandler, withPermissions } from '@/lib/auth/user';
import { sanitizePermissions, PERMISSIONS } from '@/lib/auth/permissions';
import { invalidateRolePermissionCache } from '@/lib/auth/role-permission-cache';

/**
 * GET /api/admin/roles
 * 역할 목록 조회
 */
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const roles = await prisma.role.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            userYearRoles: true,
          },
        },
      },
    });

    return NextResponse.json(roles);
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * POST /api/admin/roles
 * 역할 생성
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const body = await request.json();

    const {
      code,
      name,
      description,
      stepNumber,
      sortOrder,
      permissions,
    } = body;

    // 필수 필드 검증
    if (!code || !name) {
      return NextResponse.json(
        { error: '역할 코드와 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    // 중복 코드 검사 - findFirst 사용 (unique constraint 대신)
    const existingRole = await prisma.role.findFirst({
      where: { code },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: '이미 존재하는 역할 코드입니다.' },
        { status: 409 }
      );
    }

    const role = await prisma.role.create({
      data: {
        code,
        name,
        description,
        stepNumber: stepNumber ?? null,
        sortOrder: sortOrder ?? 0,
        permissions: sanitizePermissions(permissions),
      },
    });

    // AC3: 역할 변경 시 권한 캐시 무효화 → 재로그인 없이 반영
    invalidateRolePermissionCache(user.tenantId);

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withPermissions(PERMISSIONS.ROLE_MANAGE, handleGet);
export const POST = withPermissions(PERMISSIONS.ROLE_MANAGE, handlePost);
