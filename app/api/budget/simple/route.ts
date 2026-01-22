import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * POST /api/budget/simple - 간편 예산 선택 (위원회/사역팀 없이)
 *
 * 정규화된 테이블 사용 (BudgetCategory, BudgetSubcategory, BudgetDetail)
 * 간편 지출결의서는 재정팀장이 담당하는 세목만 선택 가능
 *
 * 요청 본문:
 * - category?: string - 예산(항)
 * - subcategory?: string - 예산(목)
 * - year?: number - 연도 (기본값: 현재 연도)
 *
 * 응답:
 * - field: 다음 레벨 필드명 (categories | subcategories | details)
 * - options: 선택 가능한 옵션 배열
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, subcategory, year: requestYear } = body;
    const year = requestYear || new Date().getFullYear();

    let nextLevel: string[] = [];
    let field = '';

    // 재정팀장 ID 조회
    const financeHeadRole = await prisma.userYearRole.findFirst({
      where: {
        year,
        role: 'finance_head',
        user: { isActive: true },
      },
      select: {
        user: { select: { id: true } },
      },
    });

    const financeHeadId = financeHeadRole?.user?.id;

    if (!category) {
      // 재정팀장이 담당하는 세목이 있는 예산(항)만 반환
      if (financeHeadId) {
        const categories = await prisma.budgetCategory.findMany({
          where: {
            isActive: true,
            subcategories: {
              some: {
                isActive: true,
                details: {
                  some: {
                    isActive: true,
                    yearSettings: {
                      some: {
                        year,
                        managerId: financeHeadId,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
          select: { name: true },
        });
        nextLevel = categories.map((c) => c.name);
      }
      field = 'categories';
    } else if (!subcategory) {
      // 선택된 예산(항)에서 재정팀장이 담당하는 세목이 있는 예산(목)만 반환
      if (financeHeadId) {
        const categoryRecord = await prisma.budgetCategory.findFirst({
          where: { name: category, isActive: true },
        });

        if (categoryRecord) {
          const subcategories = await prisma.budgetSubcategory.findMany({
            where: {
              categoryId: categoryRecord.id,
              isActive: true,
              details: {
                some: {
                  isActive: true,
                  yearSettings: {
                    some: {
                      year,
                      managerId: financeHeadId,
                    },
                  },
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
            select: { name: true },
          });
          nextLevel = subcategories.map((s) => s.name);
        }
      }
      field = 'subcategories';
    } else {
      // 선택된 예산(항/목)에서 재정팀장이 담당하는 세목만 반환
      if (financeHeadId) {
        const subcategoryRecord = await prisma.budgetSubcategory.findFirst({
          where: {
            name: subcategory,
            category: { name: category },
            isActive: true,
          },
        });

        if (subcategoryRecord) {
          const details = await prisma.budgetDetail.findMany({
            where: {
              subcategoryId: subcategoryRecord.id,
              isActive: true,
              yearSettings: {
                some: {
                  year,
                  managerId: financeHeadId,
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
            select: { name: true },
          });
          nextLevel = details.map((d) => d.name);
        }
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
