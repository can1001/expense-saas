import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * GET /api/budget/simple/all-details - 모든 세목 목록과 부모 정보 반환
 *
 * 간편 지출결의서에서 세목 선택 시 항, 목 자동 설정을 위해 사용
 * 모든 세목을 반환하며, 담당자 정보 포함 (결재선 비교용)
 *
 * 응답:
 * - details: 세목 목록 (name, category, subcategory, managerId, managerName 포함)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '') || new Date().getFullYear();

    // 모든 활성 세목 조회 (항, 목 정보 + 연도별 담당자 포함)
    const budgetDetails = await prisma.budgetDetail.findMany({
      where: {
        isActive: true,
        yearSettings: {
          some: {
            year,
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
        yearSettings: {
          where: { year },
          select: {
            manager: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: [
        { name: 'asc' },  // 세목 이름 가나다순 정렬
      ],
    });

    // 응답 형식으로 변환 (담당자 정보 포함)
    const details = budgetDetails.map((detail) => {
      const yearSetting = detail.yearSettings[0];
      return {
        name: detail.name,
        category: detail.subcategory.category.name,
        subcategory: detail.subcategory.name,
        managerId: yearSetting?.manager?.id || null,
        managerName: yearSetting?.manager?.username || null,
      };
    });

    return NextResponse.json({ details });
  } catch (error) {
    return handleApiError(error);
  }
}
