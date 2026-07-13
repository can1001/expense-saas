import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { UserApiHandler, withPermissions } from '@/lib/auth/user';
import { isProtectedSystemRole, sanitizePermissions, PERMISSIONS } from '@/lib/auth/permissions';
import { invalidateRolePermissionCache } from '@/lib/auth/role-permission-cache';

/**
 * GET /api/admin/roles/[id]
 * 역할 상세 조회
 */
const handleGet: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            userYearRoles: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        { error: '역할을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(role);
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * PUT /api/admin/roles/[id]
 * 역할 수정
 */
const handlePut: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params!;
    const body = await request.json();

    const {
      code,
      name,
      description,
      stepNumber,
      sortOrder,
      isActive,
      permissions,
    } = body;

    // 역할 존재 확인
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: '역할을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 코드 변경 시 중복 검사
    if (code && code !== existingRole.code) {
      const duplicateRole = await prisma.role.findFirst({
        where: { code },
      });

      if (duplicateRole) {
        return NextResponse.json(
          { error: '이미 존재하는 역할 코드입니다.' },
          { status: 409 }
        );
      }
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(stepNumber !== undefined && { stepNumber }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
        ...(permissions !== undefined && { permissions: sanitizePermissions(permissions) }),
      },
    });

    // AC3: 역할 변경 시 권한 캐시 무효화 → 재로그인 없이 반영
    invalidateRolePermissionCache(user.tenantId);

    return NextResponse.json(role);
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * DELETE /api/admin/roles/[id]
 * 역할 삭제 (비활성화)
 */
const handleDelete: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params!;

    // 역할 존재 확인
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            userYearRoles: true,
          },
        },
      },
    });

    if (!existingRole) {
      return NextResponse.json(
        { error: '역할을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 기본 역할(admin, user)은 삭제 불가
    if (isProtectedSystemRole(existingRole.code)) {
      return NextResponse.json(
        { error: '기본 역할은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 사용 중인 역할은 삭제 불가
    if (existingRole._count.users > 0 || existingRole._count.userYearRoles > 0) {
      return NextResponse.json(
        {
          error: '사용 중인 역할은 삭제할 수 없습니다.',
          usedBy: {
            users: existingRole._count.users,
            yearRoles: existingRole._count.userYearRoles,
          },
        },
        { status: 400 }
      );
    }

    // 물리적 삭제 대신 비활성화
    const role = await prisma.role.update({
      where: { id },
      data: { isActive: false },
    });

    // AC3: 역할 변경 시 권한 캐시 무효화 → 재로그인 없이 반영
    invalidateRolePermissionCache(user.tenantId);

    return NextResponse.json({
      message: '역할이 비활성화되었습니다.',
      role,
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withPermissions(PERMISSIONS.ROLE_MANAGE, handleGet);
export const PUT = withPermissions(PERMISSIONS.ROLE_MANAGE, handlePut);
export const DELETE = withPermissions(PERMISSIONS.ROLE_MANAGE, handleDelete);
