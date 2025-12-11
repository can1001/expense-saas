import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

// GET /api/budget - 예산 마스터 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const committee = searchParams.get('committee');
    const department = searchParams.get('department');
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');

    // 필터 조건 구성
    const where: any = {
      isActive: true,
    };

    if (committee) where.committee = committee;
    if (department) where.department = department;
    if (category) where.category = category;
    if (subcategory) where.subcategory = subcategory;

    const budgetItems = await prisma.budgetMaster.findMany({
      where,
      orderBy: [
        { committee: 'asc' },
        { department: 'asc' },
        { category: 'asc' },
        { subcategory: 'asc' },
        { detail: 'asc' },
      ],
    });

    // 계층 구조로 변환
    const hierarchy = {
      committees: Array.from(new Set(budgetItems.map(item => item.committee))),
      departments: Array.from(new Set(budgetItems.map(item => item.department))),
      categories: Array.from(new Set(budgetItems.map(item => item.category))),
      subcategories: Array.from(new Set(budgetItems.map(item => item.subcategory))),
      details: Array.from(new Set(budgetItems.map(item => item.detail))),
    };

    return NextResponse.json({
      items: budgetItems,
      hierarchy,
      total: budgetItems.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/budget/hierarchy - 계층적 구조 조회
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { committee, department, category, subcategory } = body;

    // 다음 레벨의 옵션을 반환
    const where: any = { isActive: true };
    
    if (committee) where.committee = committee;
    if (department) where.department = department;
    if (category) where.category = category;
    if (subcategory) where.subcategory = subcategory;

    const items = await prisma.budgetMaster.findMany({
      where,
      select: {
        committee: true,
        department: true,
        category: true,
        subcategory: true,
        detail: true,
        manager: true,
      },
    });

    // 다음 레벨 추출
    let nextLevel: string[] = [];
    let field = '';

    if (!committee) {
      nextLevel = Array.from(new Set(items.map(item => item.committee)));
      field = 'committees';
    } else if (!department) {
      nextLevel = Array.from(new Set(items.map(item => item.department)));
      field = 'departments';
    } else if (!category) {
      nextLevel = Array.from(new Set(items.map(item => item.category)));
      field = 'categories';
    } else if (!subcategory) {
      nextLevel = Array.from(new Set(items.map(item => item.subcategory)));
      field = 'subcategories';
    } else {
      nextLevel = Array.from(new Set(items.map(item => item.detail)));
      field = 'details';
    }

    return NextResponse.json({
      field,
      options: nextLevel.filter(Boolean).sort(),
      items,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
