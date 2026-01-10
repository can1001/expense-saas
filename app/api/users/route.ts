import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import {
  findUsers,
  createUser,
  findUserByUserid,
  getRoleByCode,
} from '@/lib/services/user-service';

// GET /api/users - 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') ?? '1');
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
    const role = searchParams.get('role') as UserRole | null;
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search') ?? undefined;
    const includeRoleRef = searchParams.get('includeRoleRef') === 'true';

    const { users, total } = await findUsers({
      page,
      pageSize,
      role: role ?? undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
      includeRoleRef,
    });

    return NextResponse.json({
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - 사용자 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userid, username, role, roleId, department, password } = body;

    // 필수 필드 검증
    if (!userid || !username) {
      return NextResponse.json(
        { error: 'userid and username are required' },
        { status: 400 }
      );
    }

    // 중복 확인
    const existingUser = await findUserByUserid(userid);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this userid already exists' },
        { status: 409 }
      );
    }

    // 역할 검증 (role enum 또는 roleId로 전달 가능)
    const validRoles: UserRole[] = ['admin', 'finance_head', 'accountant', 'team_leader', 'admin_assistant', 'user'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // roleId로 전달된 경우 role 코드 조회
    let resolvedRole = role ?? 'user';
    let resolvedRoleId = roleId;

    if (roleId && !role) {
      const roleRef = await getRoleByCode(roleId);
      if (roleRef) {
        resolvedRole = roleRef.code as UserRole;
        resolvedRoleId = roleRef.id;
      }
    }

    const user = await createUser({
      userid,
      username,
      role: resolvedRole,
      roleId: resolvedRoleId,
      department,
      password,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
