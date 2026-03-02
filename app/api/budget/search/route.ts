import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * GET /api/budget/search - 계정과목 검색
 *
 * 세목명, 목명, 항명으로 검색하여 결과 반환
 * 부서 필터 지원 (DepartmentBudgetDetail 기반)
 *
 * Query Parameters:
 * - q: 검색어 (2자 이상)
 * - departmentId: 부서 ID (접근 제어)
 * - year: 연도 (기본: 현재 연도)
 * - limit: 최대 결과 수 (기본: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const departmentId = searchParams.get('departmentId') || undefined;
    const year = parseInt(searchParams.get('year') || '') || new Date().getFullYear();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // 검색어 최소 길이 체크
    if (query.length < 1) {
      return NextResponse.json({ results: [], total: 0 });
    }

    // 검색 조건 생성
    const whereCondition: any = {
      isActive: true,
      yearSettings: {
        some: {
          year,
          isActive: true,
        },
      },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { subcategory: { name: { contains: query, mode: 'insensitive' } } },
        { subcategory: { category: { name: { contains: query, mode: 'insensitive' } } } },
      ],
    };

    // 부서 필터 적용
    if (departmentId) {
      whereCondition.departmentDetails = {
        some: {
          departmentId,
          isActive: true,
        },
      };
    }

    // 세목 검색 (총 개수와 결과를 병렬로 가져옴)
    const [budgetDetails, totalCount] = await Promise.all([
      prisma.budgetDetail.findMany({
        where: whereCondition,
        select: {
          id: true,
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
          departmentDetails: {
            where: { isActive: true },
            select: {
              department: {
                select: {
                  id: true,
                  name: true,
                  committee: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
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
        take: limit,
      }),
      prisma.budgetDetail.count({ where: whereCondition }),
    ]);

    // 응답 형식으로 변환
    const results = budgetDetails.map((detail) => {
      const yearSetting = detail.yearSettings[0];
      const category = detail.subcategory.category.name;
      const subcategory = detail.subcategory.name;

      // 부서 정보 추출 (departmentId가 있으면 해당 부서, 없으면 첫 번째)
      let department = detail.departmentDetails[0]?.department;
      if (departmentId) {
        const matched = detail.departmentDetails.find(
          (dd) => dd.department.id === departmentId
        );
        if (matched) {
          department = matched.department;
        }
      }

      return {
        id: detail.id,
        detail: detail.name,
        subcategory,
        category,
        fullPath: `${category} > ${subcategory} > ${detail.name}`,
        managerId: yearSetting?.manager?.id || null,
        managerName: yearSetting?.manager?.username || null,
        hierarchy: {
          committee: department?.committee.name || '',
          department: department?.name || '',
          category,
          subcategory,
          detail: detail.name,
        },
      };
    });

    return NextResponse.json({
      results,
      total: totalCount,
      showing: results.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
