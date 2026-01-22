import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * GET /api/budget/simple/all-details - 모든 세목 목록과 부모 정보 반환
 *
 * 간편 지출결의서에서 세목 선택 시 항, 목 자동 설정을 위해 사용
 * 재정팀장이 담당하는 세목만 반환
 *
 * 응답:
 * - details: 세목 목록 (name, category, subcategory 포함)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '') || new Date().getFullYear();

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

    if (!financeHeadId) {
      return NextResponse.json({ details: [] });
    }

    // 재정팀장이 담당하는 모든 세목 조회 (항, 목 정보 포함)
    const budgetDetails = await prisma.budgetDetail.findMany({
      where: {
        isActive: true,
        yearSettings: {
          some: {
            year,
            managerId: financeHeadId,
          },
        },
      },
      select: {
        name: true,
        subcategory: {
          select: {
            name: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { subcategory: { category: { sortOrder: 'asc' } } },
        { subcategory: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
      ],
    });

    // 응답 형식으로 변환
    const details = budgetDetails.map((detail) => ({
      name: detail.name,
      category: detail.subcategory.category.name,
      subcategory: detail.subcategory.name,
    }));

    return NextResponse.json({ details });
  } catch (error) {
    return handleApiError(error);
  }
}
