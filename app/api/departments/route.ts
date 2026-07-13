import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withAuth, UserApiHandler, withPermissions } from '@/lib/auth/user';
import { PERMISSIONS } from '@/lib/auth/permissions';

// GET /api/departments - 사역팀 목록 조회
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const committeeId = searchParams.get('committeeId');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const where = committeeId ? { committeeId } : {};

    const departments = await prisma.department.findMany({
      where,
      orderBy: [{ committee: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      include: {
        committee: {
          select: { id: true, name: true },
        },
        // 연도별 팀장 조회
        yearRoles: {
          where: {
            year,
            role: 'team_leader',
          },
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
          take: 1,
        },
      },
    });

    // 응답 형식 변환
    const formattedDepartments = departments.map((dept) => {
      const leader = dept.yearRoles[0]?.user || null;
      return {
        id: dept.id,
        name: dept.name,
        committeeId: dept.committeeId,
        committeeName: dept.committee.name,
        sortOrder: dept.sortOrder,
        isActive: dept.isActive,
        leaderId: leader?.id || null,
        leaderName: leader?.username || null,
      };
    });

    return NextResponse.json({ departments: formattedDepartments });
  } catch (error) {
    return handleApiError(error);
  }
};

// POST /api/departments - 사역팀 추가 (관리자 전용)
const handlePost: UserApiHandler = async (request) => {
  try {
    const body = await request.json();
    const { name, committeeId } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: '사역팀명을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!committeeId) {
      return NextResponse.json(
        { error: '위원회를 선택해주세요.' },
        { status: 400 }
      );
    }

    // 위원회 존재 확인
    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
    });

    if (!committee) {
      return NextResponse.json(
        { error: '위원회를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 중복 확인 (같은 위원회 내에서)
    const existing = await prisma.department.findFirst({
      where: {
        committeeId,
        name: name.trim(),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: '같은 위원회 내에 이미 존재하는 사역팀명입니다.' },
        { status: 409 }
      );
    }

    // 마지막 순서 조회 (해당 위원회 내에서)
    const lastDepartment = await prisma.department.findFirst({
      where: { committeeId },
      orderBy: { sortOrder: 'desc' },
    });

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        committeeId,
        sortOrder: (lastDepartment?.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAuth(handleGet);
export const POST = withPermissions(PERMISSIONS.DEPARTMENT_MANAGE, handlePost);
