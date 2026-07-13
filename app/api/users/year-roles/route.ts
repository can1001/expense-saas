import { NextResponse } from 'next/server';
import {
  getYearRoles,
  setYearRole,
  deleteYearRole,
  findUserByUserid,
  CURRENT_YEAR,
  UserRole,
} from '@/lib/services/user-service';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler, withPermissions } from '@/lib/auth/user';
import { YEAR_ROLE_CODES, PERMISSIONS } from '@/lib/auth/permissions';

// GET /api/users/year-roles - 연도별 역할 목록 조회
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') ?? String(CURRENT_YEAR));

    const yearRoles = await getYearRoles(year);

    return NextResponse.json({
      year,
      yearRoles: yearRoles.map(yr => {
        const yrWithRelations = yr as typeof yr & {
          department?: { name: string } | null;
          user?: { id: string; username: string } | null;
        };
        return {
          id: yr.id,
          userId: yr.userId,
          year: yr.year,
          role: yr.role,
          departmentId: yr.departmentId,
          department: yrWithRelations.department?.name ?? null,
          user: yrWithRelations.user,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching year roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch year roles' },
      { status: 500 }
    );
  }
};

// POST /api/users/year-roles - 연도별 역할 설정
const handlePost: UserApiHandler = async (request) => {
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

    // 역할 검증 (admin, user는 연도별 역할로 설정 불가) — YEAR_ROLE_CODES 단일 출처
    if (!YEAR_ROLE_CODES.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role for year role. Valid roles: finance_head, accountant, finance_member, team_leader, admin_assistant' },
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
};

// DELETE /api/users/year-roles - 연도별 역할 삭제
const handleDelete: UserApiHandler = async (request) => {
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
};

export const GET = withAuth(handleGet);
export const POST = withPermissions(PERMISSIONS.USER_MANAGE, handlePost);
export const DELETE = withPermissions(PERMISSIONS.USER_MANAGE, handleDelete);
