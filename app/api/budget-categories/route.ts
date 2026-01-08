import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/budget-categories - 예산(항) 목록 조회
export async function GET() {
  try {
    const categories = await prisma.budgetCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching budget categories:', error);
    return NextResponse.json(
      { error: '예산(항) 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/budget-categories - 예산(항) 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: '예산(항) 이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 중복 확인
    const existing = await prisma.budgetCategory.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 예산(항)입니다.' },
        { status: 409 }
      );
    }

    // 마지막 순서 조회
    const lastCategory = await prisma.budgetCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
    });

    const category = await prisma.budgetCategory.create({
      data: {
        name: name.trim(),
        sortOrder: (lastCategory?.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating budget category:', error);
    return NextResponse.json(
      { error: '예산(항) 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}
