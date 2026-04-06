import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/committees - 위원회 목록 조회
export async function GET() {
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
    console.error('Error fetching committees:', error);
    return NextResponse.json(
      { error: '위원회 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/committees - 위원회 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, leaderId } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: '위원회명을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 중복 확인
    const existing = await prisma.committee.findUnique({
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
    console.error('Error creating committee:', error);
    return NextResponse.json(
      { error: '위원회 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}
