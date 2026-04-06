import { NextRequest, NextResponse } from 'next/server';
import {
  getYearRoles,
  setYearRole,
  deleteYearRole,
  findUserByUserid,
  CURRENT_YEAR,
  UserRole,
} from '@/lib/services/user-service';
import { prisma } from '@/lib/prisma';

// GET /api/users/year-roles - 연도별 역할 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') ?? String(CURRENT_YEAR));

    const yearRoles = await getYearRoles(year);

    return NextResponse.json({
      year,
      yearRoles: yearRoles.map(yr => ({
        id: yr.id,
        userId: yr.userId,
        year: yr.year,
        role: yr.role,
        departmentId: yr.departmentId,
        department: 'department' in yr && yr.department ? yr.department.name : null,
        user: 'user' in yr ? yr.user : undefined,
      })),
    });
  } catch (error) {
    console.error('Error fetching year roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch year roles' },
      { status: 500 }
    );
  }
}

// POST /api/users/year-roles - 연도별 역할 설정
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userid, year, role, departmentId } = body;

    // userId 또는 userid로 사용자 찾기
    let targetUserId = userId;
    if (!targetUserId && userid) {
      const user = await findUserByUserid(userid);
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      targetUserId = user.id;
    }

    if (!targetUserId || !year || !role) {
      return NextResponse.json(
        { error: 'userId (or userid), year, and role are required' },
        { status: 400 }
      );
    }

    // 역할 검증 (admin, user는 연도별 역할로 설정 불가)
    const validYearRoles: UserRole[] = ['finance_head', 'accountant', 'team_leader', 'admin_assistant'];
    if (!validYearRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role for year role. Valid roles: finance_head, accountant, team_leader, admin_assistant' },
        { status: 400 }
      );
    }

    const yearRole = await setYearRole(targetUserId, year, role, departmentId);

    return NextResponse.json(yearRole, { status: 201 });
  } catch (error) {
    console.error('Error setting year role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to set year role', details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/users/year-roles - 연도별 역할 삭제
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, year, departmentId } = body;

    if (!userId || !year) {
      return NextResponse.json(
        { error: 'userId and year are required' },
        { status: 400 }
      );
    }

    if (departmentId) {
      // 특정 부서 역할만 삭제
      await prisma.userYearRole.deleteMany({
        where: { userId, year, departmentId },
      });
    } else {
      // 해당 연도 전체 역할 삭제
      await deleteYearRole(userId, year);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting year role:', error);
    return NextResponse.json(
      { error: 'Failed to delete year role' },
      { status: 500 }
    );
  }
}
