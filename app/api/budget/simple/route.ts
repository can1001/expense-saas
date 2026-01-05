import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * POST /api/budget/simple - 간편 예산 선택 (위원회/사역팀 없이)
 *
 * 정규화된 테이블 사용 (BudgetCategory, BudgetSubcategory, BudgetDetail)
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

    let nextLevel: string[] = [];
    let field = '';

    if (!category) {
      // 모든 예산(항) 반환
      const categories = await prisma.budgetCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { name: true },
      });
      nextLevel = categories.map((c) => c.name);
      field = 'categories';
    } else if (!subcategory) {
      // 선택된 예산(항)에 속한 예산(목) 반환
      const categoryRecord = await prisma.budgetCategory.findFirst({
        where: { name: category, isActive: true },
      });

      if (categoryRecord) {
        const subcategories = await prisma.budgetSubcategory.findMany({
          where: {
            categoryId: categoryRecord.id,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
          select: { name: true },
        });
        nextLevel = subcategories.map((s) => s.name);
      }
      field = 'subcategories';
    } else {
      // 선택된 예산(항/목)에 속한 예산(세목) 반환
      const subcategoryRecord = await prisma.budgetSubcategory.findFirst({
        where: {
          name: subcategory,
          category: { name: category },
          isActive: true,
        },
        include: { category: true },
      });

      if (subcategoryRecord) {
        const details = await prisma.budgetDetail.findMany({
          where: {
            subcategoryId: subcategoryRecord.id,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
          select: { name: true },
        });
        nextLevel = details.map((d) => d.name);
      }
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
