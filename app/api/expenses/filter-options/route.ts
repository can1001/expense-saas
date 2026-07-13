/**
 * GET /api/expenses/filter-options
 *
 * 지출결의서 목록 페이지의 필터 드롭다운 옵션 채우기 용도.
 * 권한 범위 내에서 실제로 사용된 committee / department / budgetCategory 의 unique 값을 반환한다.
 */

import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/prisma';
import { getEffectiveRole, CURRENT_YEAR } from '@/lib/services/user-service';
import { handleApiError } from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { roleHasPermission, PERMISSIONS } from '@/lib/auth/permissions';

const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const currentUser = user;

    const { role: effectiveRole, departmentId: effectiveDepartmentId } =
      await getEffectiveRole(currentUser.id, CURRENT_YEAR);

    // 권한별 where 절 (목록 API 와 동일한 규칙)
    const where: Prisma.ExpenseWhereInput = {};
    if (roleHasPermission(effectiveRole, PERMISSIONS.EXPENSE_READ_ALL)) {
      // 전체 접근
    } else if (effectiveRole === 'team_leader') {
      let effectiveDepartment: string | null = null;
      if (effectiveDepartmentId) {
        const dept = await prisma.department.findUnique({
          where: { id: effectiveDepartmentId },
          include: { committee: { select: { name: true } } },
        });
        if (dept) {
          effectiveDepartment = `${dept.committee.name}/${dept.name}`;
        }
      }
      const department = effectiveDepartment ?? currentUser.department;
      if (department) {
        where.department = department;
      } else {
        where.userId = currentUser.id;
      }
    } else {
      where.userId = currentUser.id;
    }

    const [committeeRows, departmentRows, categoryRows] = await Promise.all([
      prisma.expense.findMany({
        where,
        select: { committee: true },
        distinct: ['committee'],
      }),
      prisma.expense.findMany({
        where,
        select: { department: true },
        distinct: ['department'],
      }),
      prisma.expenseItem.findMany({
        where: { expense: where },
        select: { budgetCategory: true },
        distinct: ['budgetCategory'],
      }),
    ]);

    const committees = committeeRows.map((r) => r.committee).filter(Boolean).sort();
    const departments = departmentRows.map((r) => r.department).filter(Boolean).sort();
    const budgetCategories = categoryRows.map((r) => r.budgetCategory).filter(Boolean).sort();

    return NextResponse.json({ committees, departments, budgetCategories });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAuth(handleGet);
