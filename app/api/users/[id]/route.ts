import { NextResponse } from 'next/server';
import {
  findUserById,
  updateUser,
  deactivateUser,
  getRoleByCode,
  UserRole,
} from '@/lib/services/user-service';
import { withAuth, UserApiHandler, withPermissions } from '@/lib/auth/user';
import { ROLE_CODES, PERMISSIONS } from '@/lib/auth/permissions';

// GET /api/users/[id] - 사용자 상세 조회
const handleGet: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;
    const searchParams = request.nextUrl.searchParams;
    const includeRoleRef = searchParams.get('includeRoleRef') === 'true';

    const user = await findUserById(id, includeRoleRef);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
};

// PUT /api/users/[id] - 사용자 정보 수정
const handlePut: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;
    const body = await request.json();
    const { username, role, roleId, department, password, phoneNumber, isActive, canRegisterUsers } = body;

    // 사용자 존재 확인
    const existingUser = await findUserById(id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 역할 검증
    // P11: 역할 유효성은 ROLE_CODES 단일 출처로 검증(finance_member 포함)
    if (role && !ROLE_CODES.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // roleId로 전달된 경우 role 코드 조회
    let resolvedRole = role;
    let resolvedRoleId = roleId;

    if (roleId && !role) {
      const roleRef = await getRoleByCode(roleId);
      if (roleRef) {
        resolvedRole = roleRef.code as UserRole;
        resolvedRoleId = roleRef.id;
      }
    }

    const user = await updateUser(id, {
      username,
      role: resolvedRole,
      roleId: resolvedRoleId,
      department,
      password,
      phoneNumber,
      isActive,
      canRegisterUsers,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
};

// DELETE /api/users/[id] - 사용자 비활성화 (soft delete)
const handleDelete: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;

    // 사용자 존재 확인
    const existingUser = await findUserById(id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = await deactivateUser(id);

    return NextResponse.json({
      message: 'User deactivated successfully',
      user,
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate user' },
      { status: 500 }
    );
  }
};

export const GET = withAuth(handleGet);
export const PUT = withPermissions(PERMISSIONS.USER_MANAGE, handlePut);
export const DELETE = withPermissions(PERMISSIONS.USER_MANAGE, handleDelete);
