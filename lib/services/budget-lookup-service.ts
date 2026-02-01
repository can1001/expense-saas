/**
 * 예산 조회 서비스
 *
 * 예산 세목에서 위원회/사역팀 정보를 역추출합니다.
 * BudgetDetail → DepartmentBudgetDetail → Department → Committee
 */

import { prisma } from '@/lib/prisma';

// 역할 코드 타입
type UserRole = 'admin' | 'finance_head' | 'accountant' | 'team_leader' | 'admin_assistant' | 'user';

/**
 * 연도별 역할 담당자 조회
 */
async function getYearRoleUser(year: number, role: UserRole): Promise<{ id: string; username: string } | null> {
  const yearRole = await prisma.userYearRole.findFirst({
    where: {
      year,
      role,
      user: { isActive: true },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  return yearRole?.user || null;
}

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
 * 세목의 담당자 ID 조회
 *
 * @param budgetCategory 예산(항) 이름
 * @param budgetSubcategory 예산(목) 이름
 * @param budgetDetail 예산(세목) 이름
 * @param year 연도
 * @returns 담당자 ID (없으면 null)
 */
export async function getManagerIdForDetail(
  budgetCategory: string,
  budgetSubcategory: string,
  budgetDetail: string,
  year: number
): Promise<{ managerId: string | null; managerName: string | null }> {
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
  });

  if (!detail) {
    return { managerId: null, managerName: null };
  }

  // 2. 연도별 담당자 조회
  const budgetDetailYear = await prisma.budgetDetailYear.findUnique({
    where: {
      budgetDetailId_year: { budgetDetailId: detail.id, year },
    },
    include: {
      manager: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  return {
    managerId: budgetDetailYear?.manager?.id || null,
    managerName: budgetDetailYear?.manager?.username || null,
  };
}

/**
 * 세목 담당자가 재정팀장인지 확인
 *
 * @param budgetCategory 예산(항) 이름
 * @param budgetSubcategory 예산(목) 이름
 * @param budgetDetail 예산(세목) 이름
 * @param year 연도
 * @returns 재정팀장 담당 여부
 */
export async function isFinanceHeadManager(
  budgetCategory: string,
  budgetSubcategory: string,
  budgetDetail: string,
  year: number
): Promise<{ isFinanceHead: boolean; managerName: string | null; financeHeadName: string | null }> {
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
  });

  if (!detail) {
    return { isFinanceHead: false, managerName: null, financeHeadName: null };
  }

  // 2. 연도별 담당자 조회
  const budgetDetailYear = await prisma.budgetDetailYear.findUnique({
    where: {
      budgetDetailId_year: { budgetDetailId: detail.id, year },
    },
    include: {
      manager: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  // 3. 재정팀장 조회
  const financeHead = await getYearRoleUser(year, 'finance_head');

  if (!financeHead) {
    return { isFinanceHead: false, managerName: budgetDetailYear?.manager?.username || null, financeHeadName: null };
  }

  const manager = budgetDetailYear?.manager;
  const isFinanceHead = manager?.id === financeHead.id;

  return {
    isFinanceHead,
    managerName: manager?.username || null,
    financeHeadName: financeHead.username,
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
