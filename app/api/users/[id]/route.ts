import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import {
  findUserById,
  updateUser,
  deactivateUser,
  getRoleByCode,
} from '@/lib/services/user-service';

// GET /api/users/[id] - 사용자 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
}

// PUT /api/users/[id] - 사용자 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { username, role, roleId, department, password, isActive } = body;

    // 사용자 존재 확인
    const existingUser = await findUserById(id);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 역할 검증
    const validRoles: UserRole[] = ['admin', 'finance_head', 'accountant', 'team_leader', 'admin_assistant', 'user'];
    if (role && !validRoles.includes(role)) {
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
      isActive,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - 사용자 비활성화 (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
}
