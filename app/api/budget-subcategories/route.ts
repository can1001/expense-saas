import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, UserApiHandler, withPermissions } from '@/lib/auth/user';
import { PERMISSIONS } from '@/lib/auth/permissions';

// GET /api/budget-subcategories - 예산(목) 목록 조회
const handleGet: UserApiHandler = async (request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};

    if (!includeInactive) {
      where.isActive = true;
      // 상위 항이 비활성인 경우에도 제외
      where.category = { isActive: true };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const subcategories = await prisma.budgetSubcategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        categoryId: true,
        sortOrder: true,
        isActive: true,
        _count: {
          select: { details: true },
        },
      },
    });

    return NextResponse.json({ subcategories });
  } catch (error) {
    console.error('Error fetching budget subcategories:', error);
    return NextResponse.json(
      { error: '예산(목) 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
};

// POST /api/budget-subcategories - 예산(목) 추가
const handlePost: UserApiHandler = async (request) => {
  try {
    const body = await request.json();
    const { name, categoryId } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: '예산(목) 이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: '예산(항)을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 카테고리 존재 확인
    const category = await prisma.budgetCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: '예산(항)을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 중복 확인 (같은 카테고리 내에서)
    const existing = await prisma.budgetSubcategory.findUnique({
      where: {
        categoryId_name: {
          categoryId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: '같은 예산(항) 내에 이미 존재하는 예산(목)입니다.' },
        { status: 409 }
      );
    }

    // 마지막 순서 조회 (해당 카테고리 내에서)
    const lastSubcategory = await prisma.budgetSubcategory.findFirst({
      where: { categoryId },
      orderBy: { sortOrder: 'desc' },
    });

    const subcategory = await prisma.budgetSubcategory.create({
      data: {
        name: name.trim(),
        categoryId,
        sortOrder: (lastSubcategory?.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(subcategory, { status: 201 });
  } catch (error) {
    console.error('Error creating budget subcategory:', error);
    return NextResponse.json(
      { error: '예산(목) 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
};

export const GET = withAuth(handleGet);
export const POST = withPermissions(PERMISSIONS.BUDGET_MASTER_MANAGE, handlePost);
