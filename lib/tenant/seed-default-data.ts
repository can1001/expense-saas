/**
 * 테넌트 기본 데이터 시딩 서비스
 *
 * 새 테넌트 생성 시 orgType에 따라 기본 계정과목을 자동으로 생성합니다.
 */

import { Prisma, OrgType } from '@prisma/client';
import { getDefaultDataForOrgType } from './default-chart-of-accounts';

// Prisma 트랜잭션 클라이언트 타입
type TransactionClient = Omit<
  typeof import('@prisma/client').PrismaClient.prototype,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface SeedDefaultDataParams {
  tenantId: string;
  orgType: OrgType;
  tx: TransactionClient;
}

export interface SeedDefaultDataResult {
  committeesCreated: number;
  departmentsCreated: number;
  budgetCategoriesCreated: number;
  budgetSubcategoriesCreated: number;
  budgetDetailsCreated: number;
}

/**
 * 테넌트에 기본 계정과목 데이터를 생성합니다.
 *
 * 트랜잭션 클라이언트를 받아서 실행하므로, 테넌트 생성과 함께 원자적으로 처리됩니다.
 *
 * @param params - tenantId, orgType, tx(트랜잭션 클라이언트)
 * @returns 생성된 항목 수 통계
 */
export async function seedDefaultData(
  params: SeedDefaultDataParams
): Promise<SeedDefaultDataResult> {
  const { tenantId, orgType, tx } = params;
  const defaultData = getDefaultDataForOrgType(orgType);

  const result: SeedDefaultDataResult = {
    committeesCreated: 0,
    departmentsCreated: 0,
    budgetCategoriesCreated: 0,
    budgetSubcategoriesCreated: 0,
    budgetDetailsCreated: 0,
  };

  // 1. 위원회 및 부서 생성
  for (const committeeData of defaultData.committees) {
    const committee = await tx.committee.create({
      data: {
        tenantId,
        name: committeeData.name,
        sortOrder: committeeData.sortOrder,
        isActive: true,
      },
    });
    result.committeesCreated++;

    // 부서 생성
    for (const deptData of committeeData.departments) {
      await tx.department.create({
        data: {
          tenantId,
          committeeId: committee.id,
          name: deptData.name,
          sortOrder: deptData.sortOrder,
          isActive: true,
        },
      });
      result.departmentsCreated++;
    }
  }

  // 2. 예산 항목(항 > 목 > 세목) 생성
  for (const categoryData of defaultData.budgetCategories) {
    const category = await tx.budgetCategory.create({
      data: {
        tenantId,
        name: categoryData.name,
        sortOrder: categoryData.sortOrder,
        isActive: true,
      },
    });
    result.budgetCategoriesCreated++;

    // 예산(목) 생성
    for (const subcategoryData of categoryData.subcategories) {
      const subcategory = await tx.budgetSubcategory.create({
        data: {
          tenantId,
          categoryId: category.id,
          name: subcategoryData.name,
          sortOrder: subcategoryData.sortOrder,
          isActive: true,
        },
      });
      result.budgetSubcategoriesCreated++;

      // 예산(세목) 생성
      for (const detailData of subcategoryData.details) {
        await tx.budgetDetail.create({
          data: {
            tenantId,
            subcategoryId: subcategory.id,
            name: detailData.name,
            accountCode: detailData.accountCode,
            description: detailData.description,
            sortOrder: detailData.sortOrder,
            isActive: true,
          },
        });
        result.budgetDetailsCreated++;
      }
    }
  }

  return result;
}

/**
 * 특정 부서에 예산 세목을 연결합니다.
 *
 * 부서별로 사용 가능한 예산 항목을 설정할 때 사용합니다.
 * 기본 시딩에서는 모든 세목을 전체 부서에 연결하지 않고,
 * 관리자가 나중에 설정하도록 합니다.
 *
 * @param tx - 트랜잭션 클라이언트
 * @param tenantId - 테넌트 ID
 * @param departmentId - 부서 ID
 * @param budgetDetailIds - 예산 세목 ID 배열
 */
export async function linkDepartmentBudgetDetails(
  tx: TransactionClient,
  tenantId: string,
  departmentId: string,
  budgetDetailIds: string[]
): Promise<void> {
  const data: Prisma.DepartmentBudgetDetailCreateManyInput[] = budgetDetailIds.map(
    (budgetDetailId) => ({
      tenantId,
      departmentId,
      budgetDetailId,
      isActive: true,
    })
  );

  await tx.departmentBudgetDetail.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * 테넌트의 모든 부서에 모든 예산 세목을 연결합니다.
 *
 * 초기 설정 시 모든 예산 항목을 사용 가능하게 하려면 이 함수를 호출합니다.
 *
 * @param tx - 트랜잭션 클라이언트
 * @param tenantId - 테넌트 ID
 */
export async function linkAllBudgetDetailsToAllDepartments(
  tx: TransactionClient,
  tenantId: string
): Promise<number> {
  // 모든 부서 조회
  const departments = await tx.department.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  });

  // 모든 예산 세목 조회
  const budgetDetails = await tx.budgetDetail.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  });

  if (departments.length === 0 || budgetDetails.length === 0) {
    return 0;
  }

  // 모든 조합 생성
  const data: Prisma.DepartmentBudgetDetailCreateManyInput[] = [];
  for (const dept of departments) {
    for (const detail of budgetDetails) {
      data.push({
        tenantId,
        departmentId: dept.id,
        budgetDetailId: detail.id,
        isActive: true,
      });
    }
  }

  const result = await tx.departmentBudgetDetail.createMany({
    data,
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * 테넌트의 기본 데이터 생성 상태를 확인합니다.
 *
 * @param tx - 트랜잭션 클라이언트 또는 Prisma 클라이언트
 * @param tenantId - 테넌트 ID
 * @returns 기본 데이터가 이미 존재하는지 여부
 */
export async function hasDefaultData(
  tx: TransactionClient,
  tenantId: string
): Promise<boolean> {
  const [committeeCount, categoryCount] = await Promise.all([
    tx.committee.count({ where: { tenantId } }),
    tx.budgetCategory.count({ where: { tenantId } }),
  ]);

  return committeeCount > 0 || categoryCount > 0;
}
