/**
 * 예산 조회 서비스
 *
 * 예산 세목에서 위원회/사역팀 정보를 역추출합니다.
 * BudgetDetail → DepartmentBudgetDetail → Department → Committee
 */

import { prisma } from '@/lib/prisma';

export interface BudgetHierarchyInfo {
  committee: string;
  department: string;
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetailId: string;
}

/**
 * 예산 세목 이름으로 전체 계층 정보 조회
 *
 * @param budgetCategory 예산(항) 이름
 * @param budgetSubcategory 예산(목) 이름
 * @param budgetDetail 예산(세목) 이름
 * @returns 위원회, 사역팀, 예산 계층 정보
 */
export async function lookupBudgetHierarchy(
  budgetCategory: string,
  budgetSubcategory: string,
  budgetDetail: string
): Promise<BudgetHierarchyInfo | null> {
  // 1. BudgetDetail 찾기
  const detail = await prisma.budgetDetail.findFirst({
    where: {
      name: budgetDetail,
      subcategory: {
        name: budgetSubcategory,
        category: {
          name: budgetCategory,
        },
      },
    },
    include: {
      subcategory: {
        include: {
          category: true,
        },
      },
    },
  });

  if (!detail) {
    return null;
  }

  // 2. DepartmentBudgetDetail로 Department/Committee 찾기
  const deptBudgetDetail = await prisma.departmentBudgetDetail.findFirst({
    where: {
      budgetDetailId: detail.id,
      isActive: true,
    },
    include: {
      department: {
        include: {
          committee: true,
        },
      },
    },
  });

  if (!deptBudgetDetail) {
    return null;
  }

  return {
    committee: deptBudgetDetail.department.committee.name,
    department: deptBudgetDetail.department.name,
    budgetCategory: detail.subcategory.category.name,
    budgetSubcategory: detail.subcategory.name,
    budgetDetailId: detail.id,
  };
}

/**
 * 예산 세목 ID로 전체 계층 정보 조회
 */
export async function lookupBudgetHierarchyById(
  budgetDetailId: string
): Promise<BudgetHierarchyInfo | null> {
  const detail = await prisma.budgetDetail.findUnique({
    where: { id: budgetDetailId },
    include: {
      subcategory: {
        include: {
          category: true,
        },
      },
    },
  });

  if (!detail) {
    return null;
  }

  const deptBudgetDetail = await prisma.departmentBudgetDetail.findFirst({
    where: {
      budgetDetailId: detail.id,
      isActive: true,
    },
    include: {
      department: {
        include: {
          committee: true,
        },
      },
    },
  });

  if (!deptBudgetDetail) {
    return null;
  }

  return {
    committee: deptBudgetDetail.department.committee.name,
    department: deptBudgetDetail.department.name,
    budgetCategory: detail.subcategory.category.name,
    budgetSubcategory: detail.subcategory.name,
    budgetDetailId: detail.id,
  };
}
