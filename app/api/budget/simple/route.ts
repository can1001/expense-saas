import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * POST /api/budget/simple - 간편 예산 선택 (위원회/사역팀 없이)
 *
 * 요청 본문:
 * - category?: string - 예산(항)
 * - subcategory?: string - 예산(목)
 *
 * 응답:
 * - field: 다음 레벨 필드명 (categories | subcategories | details)
 * - options: 선택 가능한 옵션 배열
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, subcategory } = body;

    const where: Record<string, unknown> = { isActive: true };

    if (category) where.category = category;
    if (subcategory) where.subcategory = subcategory;

    const items = await prisma.budgetMaster.findMany({
      where,
      select: {
        category: true,
        subcategory: true,
        detail: true,
      },
    });

    // 다음 레벨 추출
    let nextLevel: string[] = [];
    let field = '';

    if (!category) {
      // 모든 예산(항) 반환
      nextLevel = Array.from(new Set(items.map(item => item.category)));
      field = 'categories';
    } else if (!subcategory) {
      // 선택된 예산(항)에 속한 예산(목) 반환
      nextLevel = Array.from(new Set(items.map(item => item.subcategory)));
      field = 'subcategories';
    } else {
      // 선택된 예산(항/목)에 속한 예산(세목) 반환
      nextLevel = Array.from(new Set(items.map(item => item.detail)));
      field = 'details';
    }

    return NextResponse.json({
      field,
      options: nextLevel.filter(Boolean).sort(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
