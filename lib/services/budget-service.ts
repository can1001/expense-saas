/**
 * 예산 사용금액 서비스
 *
 * 세목별 예산 사용금액 계산 로직을 제공합니다.
 * 계산 기준: 1차 승인 이상 (APPROVED_STEP_1, APPROVED_STEP_2, APPROVED_FINAL)
 *
 * 같은 이름의 세목(BudgetDetail.name)이 서로 다른 목(subcategory) 아래에
 * 공존할 수 있으므로 항/목/세목 3-튜플로 식별한다. 단순히 세목 이름만으로
 * 필터/집계하면 부서가 다른 동일명 세목의 사용금액이 합산되는 버그가 발생한다.
 */

import { prisma } from '@/lib/prisma';

// 사용금액 계산에 포함되는 승인 상태
const APPROVED_STATUSES = ['APPROVED_STEP_1', 'APPROVED_STEP_2', 'APPROVED_FINAL'] as const;

export type BudgetDetailKey = {
  budgetCategory: string;
  budgetSubcategory: string;
  budgetDetail: string;
};

/**
 * 항/목/세목 3-튜플을 단일 문자열 키로 변환한다. Map 키로 사용.
 */
export function makeBudgetDetailKey(k: BudgetDetailKey): string {
  return `${k.budgetCategory}|${k.budgetSubcategory}|${k.budgetDetail}`;
}

/**
 * 항/목/세목 조합별 사용금액 조회
 *
 * 1차 결재자(팀장) 승인 이상인 지출결의서의 금액을 집계합니다.
 * requestDate 기준으로 해당 연도의 지출결의서를 조회합니다.
 *
 * @param keys 항/목/세목 3-튜플 목록
 * @param year 대상 연도
 * @param excludeExpenseId 제외할 지출결의서 ID (현재 보고 있는 지출결의서의 이중 차감 방지용)
 * @returns 합성 키(`항|목|세목`) → 사용금액 Map
 */
export async function getUsedAmountByDetail(
  keys: BudgetDetailKey[],
  year: number,
  excludeExpenseId?: string
): Promise<Map<string, number>> {
  if (keys.length === 0) {
    return new Map();
  }

  const usedAmounts = await prisma.expenseItem.groupBy({
    by: ['budgetCategory', 'budgetSubcategory', 'budgetDetail'],
    where: {
      OR: keys.map((k) => ({
        budgetCategory: k.budgetCategory,
        budgetSubcategory: k.budgetSubcategory,
        budgetDetail: k.budgetDetail,
      })),
      expense: {
        status: { in: [...APPROVED_STATUSES] },
        requestDate: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
        ...(excludeExpenseId ? { id: { not: excludeExpenseId } } : {}),
      },
    },
    _sum: { amount: true },
  });

  return new Map(
    usedAmounts.map((item) => [
      makeBudgetDetailKey({
        budgetCategory: item.budgetCategory,
        budgetSubcategory: item.budgetSubcategory,
        budgetDetail: item.budgetDetail,
      }),
      item._sum.amount || 0,
    ])
  );
}

/**
 * 전체 항/목/세목 조합의 사용금액 조회
 *
 * 특정 연도의 모든 항/목/세목 조합별 사용금액을 집계합니다.
 * 예산 관리 화면에서 사용됩니다.
 *
 * @param year 대상 연도
 * @returns 합성 키(`항|목|세목`) → 사용금액 Map
 */
export async function getAllUsedAmounts(
  year: number
): Promise<Map<string, number>> {
  const usedAmounts = await prisma.expenseItem.groupBy({
    by: ['budgetCategory', 'budgetSubcategory', 'budgetDetail'],
    where: {
      expense: {
        status: { in: [...APPROVED_STATUSES] },
        requestDate: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      },
    },
    _sum: { amount: true },
  });

  return new Map(
    usedAmounts.map((item) => [
      makeBudgetDetailKey({
        budgetCategory: item.budgetCategory,
        budgetSubcategory: item.budgetSubcategory,
        budgetDetail: item.budgetDetail,
      }),
      item._sum.amount || 0,
    ])
  );
}
