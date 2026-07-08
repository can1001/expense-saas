import { NextResponse } from 'next/server';
import { findUsersByRole, UserRole } from '@/lib/services/user-service';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

// GET /api/users/by-role/[role] - 역할별 사용자 목록 조회
const handleGet: UserApiHandler = async (request, { params }) => {
  try {
    const { role } = await params! as { role: string };

    // 역할 검증
    const validRoles: UserRole[] = ['admin', 'finance_head', 'accountant', 'finance_member', 'team_leader', 'admin_assistant', 'user'];
    if (!validRoles.includes(role as UserRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Valid roles: admin, finance_head, accountant, finance_member, team_leader, admin_assistant, user' },
        { status: 400 }
      );
    }

    const users = await findUsersByRole(role as UserRole);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
};

export const GET = withAuth(handleGet);
