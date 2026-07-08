import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';
import { withAdmin, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/admin/year-config/[year]
 * 특정 연도의 설정 데이터 조회
 */
const handleGet: UserApiHandler = async (request, { params }) => {
  try {
    const { year: yearStr } = await params!;
    const year = parseInt(yearStr);

    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json({ error: '유효하지 않은 연도입니다.' }, { status: 400 });
    }

    const [yearRolesCount, budgetDetailYearsCount] = await Promise.all([
      prisma.userYearRole.count({ where: { year } }),
      prisma.budgetDetailYear.count({ where: { year } }),
    ]);

    return NextResponse.json({
      year,
      data: {
        yearRoles: yearRolesCount,
        budgetDetailYears: budgetDetailYearsCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * DELETE /api/admin/year-config/[year]
 * 특정 연도의 설정 데이터 삭제
 *
 * Query params:
 * - target: 'all' | 'roles' | 'budgets' (default: 'all')
 */
const handleDelete: UserApiHandler = async (request, { params }) => {
  try {
    const { year: yearStr } = await params!;
    const year = parseInt(yearStr);

    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json({ error: '유효하지 않은 연도입니다.' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const target = searchParams.get('target') || 'all';

    const result: {
      yearRolesDeleted?: number;
      budgetDetailYearsDeleted?: number;
    } = {};

    await prisma.$transaction(async (tx) => {
      // 역할 삭제
      if (target === 'all' || target === 'roles') {
        const deleted = await tx.userYearRole.deleteMany({
          where: { year },
        });
        result.yearRolesDeleted = deleted.count;
      }

      // 예산 담당자/금액 삭제
      if (target === 'all' || target === 'budgets') {
        const deleted = await tx.budgetDetailYear.deleteMany({
          where: { year },
        });
        result.budgetDetailYearsDeleted = deleted.count;
      }
    });

    return NextResponse.json({
      success: true,
      year,
      target,
      result,
      message: `${year}년 데이터가 삭제되었습니다.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAdmin(handleGet);
export const DELETE = withAdmin(handleDelete);
