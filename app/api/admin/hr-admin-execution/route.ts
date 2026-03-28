import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api/error-handler';

interface BudgetItem {
  name: string;
  budget: number;
  spent: number;
  executionRate: number;
  note?: string;
}

interface BudgetGroup {
  name: string;
  items: BudgetItem[];
  subtotal: {
    budget: number;
    spent: number;
    executionRate: number;
  };
}

/**
 * GET /api/admin/hr-admin-execution
 * 인사 및 행정비 예산 집행 현황 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // 연간 날짜 범위
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    // 1. 인사위/행정위 위원회 조회
    const personnelCommittee = await prisma.committee.findFirst({
      where: { name: { contains: '인사위' }, isActive: true },
      include: {
        departments: {
          where: { isActive: true },
          include: {
            budgetDetails: {
              where: { isActive: true },
              include: {
                budgetDetail: {
                  include: {
                    subcategory: {
                      include: { category: true },
                    },
                    yearSettings: {
                      where: { year, isActive: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const adminCommittee = await prisma.committee.findFirst({
      where: { name: { contains: '행정위' }, isActive: true },
      include: {
        departments: {
          where: { isActive: true },
          include: {
            budgetDetails: {
              where: { isActive: true },
              include: {
                budgetDetail: {
                  include: {
                    subcategory: {
                      include: { category: true },
                    },
                    yearSettings: {
                      where: { year, isActive: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // 2. 지출 데이터 조회 (APPROVED_FINAL 상태)
    const expenses = await prisma.expenseItem.findMany({
      where: {
        expense: {
          status: 'APPROVED_FINAL',
          requestDate: { gte: startDate, lte: endDate },
        },
      },
      select: {
        budgetCategory: true,
        budgetSubcategory: true,
        budgetDetail: true,
        amount: true,
        expense: {
          select: { committee: true, department: true },
        },
      },
    });

    // 세목별 지출 집계
    const spentByDetail = new Map<string, number>();
    expenses.forEach((item) => {
      const key = `${item.budgetCategory}|${item.budgetSubcategory}|${item.budgetDetail}`;
      spentByDetail.set(key, (spentByDetail.get(key) || 0) + item.amount);
    });

    // 3. 인사 섹션 데이터 구성
    const personnelItems: BudgetItem[] = [];
    let personnelTotalBudget = 0;
    let personnelTotalSpent = 0;

    if (personnelCommittee) {
      // 목(subcategory) 레벨로 집계
      const subcategoryMap = new Map<string, { budget: number; spent: number }>();

      personnelCommittee.departments.forEach((dept) => {
        dept.budgetDetails.forEach((dbd) => {
          const detail = dbd.budgetDetail;
          const subcatName = detail.subcategory?.name || detail.name;
          const catName = detail.subcategory?.category?.name || '';
          const budget = detail.yearSettings[0]?.budgetAmount || 0;

          const key = `${catName}|${subcatName}`;
          const spentKey = `${catName}|${subcatName}|${detail.name}`;
          const spent = spentByDetail.get(spentKey) || 0;

          if (!subcategoryMap.has(key)) {
            subcategoryMap.set(key, { budget: 0, spent: 0 });
          }
          const current = subcategoryMap.get(key)!;
          current.budget += budget;
          current.spent += spent;
        });
      });

      subcategoryMap.forEach((data, key) => {
        const [, subcatName] = key.split('|');
        const displayName = formatDisplayName(subcatName);
        const executionRate = data.budget > 0 ? Math.round((data.spent / data.budget) * 100) : 0;

        personnelItems.push({
          name: displayName,
          budget: data.budget,
          spent: data.spent,
          executionRate,
        });

        personnelTotalBudget += data.budget;
        personnelTotalSpent += data.spent;
      });
    }

    // 4. 행정비 섹션 데이터 구성 (그룹별)
    const adminGroups: BudgetGroup[] = [];
    let adminTotalBudget = 0;
    let adminTotalSpent = 0;

    if (adminCommittee) {
      // 항(category) 레벨로 그룹핑
      const categoryMap = new Map<string, Map<string, { budget: number; spent: number }>>();

      adminCommittee.departments.forEach((dept) => {
        dept.budgetDetails.forEach((dbd) => {
          const detail = dbd.budgetDetail;
          const catName = detail.subcategory?.category?.name || '기타';
          const subcatName = detail.subcategory?.name || detail.name;
          const budget = detail.yearSettings[0]?.budgetAmount || 0;

          const spentKey = `${catName}|${subcatName}|${detail.name}`;
          const spent = spentByDetail.get(spentKey) || 0;

          if (!categoryMap.has(catName)) {
            categoryMap.set(catName, new Map());
          }
          const subcatMap = categoryMap.get(catName)!;

          if (!subcatMap.has(subcatName)) {
            subcatMap.set(subcatName, { budget: 0, spent: 0 });
          }
          const current = subcatMap.get(subcatName)!;
          current.budget += budget;
          current.spent += spent;
        });
      });

      categoryMap.forEach((subcatMap, catName) => {
        const items: BudgetItem[] = [];
        let groupBudget = 0;
        let groupSpent = 0;

        subcatMap.forEach((data, subcatName) => {
          const displayName = formatDisplayName(subcatName);
          const executionRate = data.budget > 0 ? Math.round((data.spent / data.budget) * 100) : 0;

          items.push({
            name: displayName,
            budget: data.budget,
            spent: data.spent,
            executionRate,
          });

          groupBudget += data.budget;
          groupSpent += data.spent;
        });

        const groupExecutionRate = groupBudget > 0 ? Math.round((groupSpent / groupBudget) * 100) : 0;

        adminGroups.push({
          name: formatDisplayName(catName),
          items,
          subtotal: {
            budget: groupBudget,
            spent: groupSpent,
            executionRate: groupExecutionRate,
          },
        });

        adminTotalBudget += groupBudget;
        adminTotalSpent += groupSpent;
      });
    }

    const personnelExecutionRate = personnelTotalBudget > 0
      ? Math.round((personnelTotalSpent / personnelTotalBudget) * 100)
      : 0;

    const adminExecutionRate = adminTotalBudget > 0
      ? Math.round((adminTotalSpent / adminTotalBudget) * 100)
      : 0;

    return NextResponse.json({
      year,
      personnel: {
        items: personnelItems,
        total: {
          budget: personnelTotalBudget,
          spent: personnelTotalSpent,
          executionRate: personnelExecutionRate,
        },
      },
      admin: {
        groups: adminGroups,
        total: {
          budget: adminTotalBudget,
          spent: adminTotalSpent,
          executionRate: adminExecutionRate,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// 표시용 이름 포맷팅
function formatDisplayName(name: string): string {
  // 언더스코어를 공백으로 변환하고 정리
  return name
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
