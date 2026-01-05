import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

/**
 * GET /api/budget - 예산 계층 데이터 조회 (정규화된 테이블 기반)
 *
 * 계층 구조:
 * - 위원회 (Committee)
 * - 사역팀(부) (Department)
 * - 예산(항) (BudgetCategory)
 * - 예산(목) (BudgetSubcategory)
 * - 예산(세목) (BudgetDetail)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const committee = searchParams.get('committee');
    const department = searchParams.get('department');
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');

    // 정규화된 테이블에서 전체 데이터 조회
    const committees = await prisma.committee.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // 필터링된 데이터 조회
    const departmentWhere: any = { isActive: true };
    if (committee) {
      const committeeRecord = await prisma.committee.findFirst({
        where: { name: committee, isActive: true },
      });
      if (committeeRecord) {
        departmentWhere.committeeId = committeeRecord.id;
      }
    }
    const departments = await prisma.department.findMany({
      where: departmentWhere,
      orderBy: { sortOrder: 'asc' },
    });

    // 카테고리는 선택된 부서와 연결된 세목들의 카테고리만
    let categories: { id: string; name: string }[] = [];
    let subcategories: { id: string; name: string }[] = [];
    let details: { id: string; name: string }[] = [];

    if (department) {
      const departmentRecord = await prisma.department.findFirst({
        where: { name: department },
      });

      if (departmentRecord) {
        // 해당 부서에 연결된 세목들의 카테고리 추출
        const linkedDetails = await prisma.departmentBudgetDetail.findMany({
          where: {
            departmentId: departmentRecord.id,
            isActive: true,
          },
          include: {
            budgetDetail: {
              include: {
                subcategory: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        });

        // 유니크한 카테고리 추출
        const categoryMap = new Map<string, { id: string; name: string }>();
        linkedDetails.forEach((ld) => {
          const cat = ld.budgetDetail.subcategory.category;
          if (cat.isActive) {
            categoryMap.set(cat.id, { id: cat.id, name: cat.name });
          }
        });
        categories = Array.from(categoryMap.values());

        // 카테고리 필터가 있으면 서브카테고리 추출
        if (category) {
          const subcategoryMap = new Map<string, { id: string; name: string }>();
          linkedDetails.forEach((ld) => {
            const subcat = ld.budgetDetail.subcategory;
            if (subcat.category.name === category && subcat.isActive) {
              subcategoryMap.set(subcat.id, { id: subcat.id, name: subcat.name });
            }
          });
          subcategories = Array.from(subcategoryMap.values());

          // 서브카테고리 필터가 있으면 세목 추출
          if (subcategory) {
            details = linkedDetails
              .filter((ld) => ld.budgetDetail.subcategory.name === subcategory && ld.budgetDetail.isActive)
              .map((ld) => ({
                id: ld.budgetDetail.id,
                name: ld.budgetDetail.name,
              }));
          }
        }
      }
    }

    return NextResponse.json({
      hierarchy: {
        committees: committees.map((c) => c.name),
        departments: departments.map((d) => d.name),
        categories: categories.map((c) => c.name),
        subcategories: subcategories.map((s) => s.name),
        details: details.map((d) => d.name),
      },
      total: details.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/budget - 계층적 드롭다운용 다음 레벨 옵션 반환
 *
 * 정규화된 테이블 기반으로 동작
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { committee, department, category, subcategory } = body;

    let field = '';
    let options: string[] = [];

    if (!committee) {
      // 위원회 목록 반환
      const committees = await prisma.committee.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      field = 'committees';
      options = committees.map((c) => c.name);
    } else if (!department) {
      // 선택된 위원회의 부서 목록 반환
      const committeeRecord = await prisma.committee.findFirst({
        where: { name: committee, isActive: true },
      });

      if (committeeRecord) {
        const departments = await prisma.department.findMany({
          where: {
            committeeId: committeeRecord.id,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
        });
        options = departments.map((d) => d.name);
      }
      field = 'departments';
    } else if (!category) {
      // 선택된 부서에 연결된 카테고리 목록 반환
      const departmentRecord = await prisma.department.findFirst({
        where: { name: department },
      });

      if (departmentRecord) {
        // 해당 부서에 연결된 세목들의 카테고리 추출
        const linkedDetails = await prisma.departmentBudgetDetail.findMany({
          where: {
            departmentId: departmentRecord.id,
            isActive: true,
          },
          include: {
            budgetDetail: {
              include: {
                subcategory: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        });

        const categoryNames = new Set<string>();
        linkedDetails.forEach((ld) => {
          if (ld.budgetDetail.subcategory.category.isActive) {
            categoryNames.add(ld.budgetDetail.subcategory.category.name);
          }
        });
        options = Array.from(categoryNames).sort();
      }
      field = 'categories';
    } else if (!subcategory) {
      // 선택된 카테고리의 서브카테고리 목록 반환 (부서 연결 기준)
      const departmentRecord = await prisma.department.findFirst({
        where: { name: department },
      });

      if (departmentRecord) {
        const linkedDetails = await prisma.departmentBudgetDetail.findMany({
          where: {
            departmentId: departmentRecord.id,
            isActive: true,
          },
          include: {
            budgetDetail: {
              include: {
                subcategory: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        });

        const subcategoryNames = new Set<string>();
        linkedDetails.forEach((ld) => {
          const subcat = ld.budgetDetail.subcategory;
          if (subcat.category.name === category && subcat.isActive) {
            subcategoryNames.add(subcat.name);
          }
        });
        options = Array.from(subcategoryNames).sort();
      }
      field = 'subcategories';
    } else {
      // 선택된 서브카테고리의 세목 목록 반환 (부서 연결 기준)
      const departmentRecord = await prisma.department.findFirst({
        where: { name: department },
      });

      if (departmentRecord) {
        const linkedDetails = await prisma.departmentBudgetDetail.findMany({
          where: {
            departmentId: departmentRecord.id,
            isActive: true,
          },
          include: {
            budgetDetail: {
              include: {
                subcategory: true,
              },
            },
          },
        });

        options = linkedDetails
          .filter((ld) => ld.budgetDetail.subcategory.name === subcategory && ld.budgetDetail.isActive)
          .map((ld) => ld.budgetDetail.name)
          .filter((name) => name && name.length > 0)
          .sort();
      }
      field = 'details';
    }

    return NextResponse.json({
      field,
      options: options.filter(Boolean),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
