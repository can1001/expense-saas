import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withAuth, withAdmin, UserApiHandler } from '@/lib/auth/user';

// GET /api/committees - 위원회 목록 조회
const handleGet: UserApiHandler = async () => {
  try {
    const committees = await prisma.committee.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        leader: {
          select: { id: true, username: true },
        },
        _count: {
          select: { departments: true },
        },
      },
    });

    return NextResponse.json({ committees });
  } catch (error) {
    return handleApiError(error);
  }
};

// POST /api/committees - 위원회 추가 (관리자 전용)
const handlePost: UserApiHandler = async (request) => {
  try {
    const body = await request.json();
    const { name, leaderId } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: '위원회명을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 중복 확인 (findFirst 사용 - name은 unique constraint가 아닐 수 있음)
    const existing = await prisma.committee.findFirst({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 위원회명입니다.' },
        { status: 409 }
      );
    }

    // 마지막 순서 조회
    const lastCommittee = await prisma.committee.findFirst({
      orderBy: { sortOrder: 'desc' },
    });

    const committee = await prisma.committee.create({
      data: {
        name: name.trim(),
        sortOrder: (lastCommittee?.sortOrder ?? 0) + 1,
        leaderId: leaderId || null,
      },
      include: {
        leader: {
          select: { id: true, username: true },
        },
      },
    });

    return NextResponse.json(committee, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAuth(handleGet);
export const POST = withAdmin(handlePost);
