/**
 * 예산 사용금액 서비스
 *
 * 세목별 예산 사용금액 계산 로직을 제공합니다.
 * 계산 기준: 1차 승인 이상 (APPROVED_STEP_1, APPROVED_STEP_2, APPROVED_FINAL)
 */

import { prisma } from '@/lib/prisma';

// 사용금액 계산에 포함되는 승인 상태
const APPROVED_STATUSES = ['APPROVED_STEP_1', 'APPROVED_STEP_2', 'APPROVED_FINAL'] as const;

/**
 * 세목별 사용금액 조회
 *
 * 1차 결재자(팀장) 승인 이상인 지출결의서의 금액을 집계합니다.
 * requestDate 기준으로 해당 연도의 지출결의서를 조회합니다.
 *
 * @param budgetDetailNames 세목 이름 목록
 * @param year 대상 연도
 * @returns 세목별 사용금액 Map (세목 이름 → 사용금액)
 */
export async function getUsedAmountByDetail(
  budgetDetailNames: string[],
  year: number
): Promise<Map<string, number>> {
  const usedAmounts = await prisma.expenseItem.groupBy({
    by: ['budgetDetail'],
    where: {
      budgetDetail: { in: budgetDetailNames },
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
    usedAmounts.map((item) => [item.budgetDetail, item._sum.amount || 0])
  );
}

/**
 * 전체 세목의 사용금액 조회
 *
 * 특정 연도의 모든 세목별 사용금액을 집계합니다.
 * 예산 관리 화면에서 사용됩니다.
 *
 * @param year 대상 연도
 * @returns 세목별 사용금액 Map (세목 이름 → 사용금액)
 */
export async function getAllUsedAmounts(
  year: number
): Promise<Map<string, number>> {
  const usedAmounts = await prisma.expenseItem.groupBy({
    by: ['budgetDetail'],
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
    usedAmounts.map((item) => [item.budgetDetail, item._sum.amount || 0])
  );
}
