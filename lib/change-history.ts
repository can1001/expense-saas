import { PrismaClient } from '@prisma/client';

type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

interface YearRoleChange {
  userYearRoleId?: string;
  userId: string;
  year: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changedBy: string;
  changedById?: string;
  previousRole?: string;
  previousDept?: string;
  newRole?: string;
  newDept?: string;
}

interface BudgetDetailYearChange {
  budgetDetailYearId?: string;
  budgetDetailId: string;
  budgetDetailName?: string;
  year: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changedBy: string;
  changedById?: string;
  previousManagerId?: string;
  previousManagerName?: string;
  previousBudgetAmt?: number;
  newManagerId?: string;
  newManagerName?: string;
  newBudgetAmt?: number;
}

/**
 * 사용자 연도별 역할 변경 이력 기록
 */
export async function logYearRoleChange(
  tx: PrismaTransaction,
  change: YearRoleChange
): Promise<void> {
  await tx.userYearRoleHistory.create({
    data: {
      userYearRoleId: change.userYearRoleId,
      userId: change.userId,
      year: change.year,
      action: change.action,
      changedBy: change.changedBy,
      changedById: change.changedById,
      previousRole: change.previousRole,
      previousDept: change.previousDept,
      newRole: change.newRole,
      newDept: change.newDept,
    },
  });
}

/**
 * 예산 세목 연도별 설정 변경 이력 기록
 */
export async function logBudgetDetailYearChange(
  tx: PrismaTransaction,
  change: BudgetDetailYearChange
): Promise<void> {
  await tx.budgetDetailYearHistory.create({
    data: {
      budgetDetailYearId: change.budgetDetailYearId,
      budgetDetailId: change.budgetDetailId,
      budgetDetailName: change.budgetDetailName,
      year: change.year,
      action: change.action,
      changedBy: change.changedBy,
      changedById: change.changedById,
      previousManagerId: change.previousManagerId,
      previousManagerName: change.previousManagerName,
      previousBudgetAmt: change.previousBudgetAmt,
      newManagerId: change.newManagerId,
      newManagerName: change.newManagerName,
      newBudgetAmt: change.newBudgetAmt,
    },
  });
}

/**
 * 사용자 연도별 역할 일괄 변경 이력 기록 (복사 시)
 */
export async function logYearRoleBulkChange(
  tx: PrismaTransaction,
  changes: YearRoleChange[]
): Promise<void> {
  if (changes.length === 0) return;

  await tx.userYearRoleHistory.createMany({
    data: changes.map((change) => ({
      userYearRoleId: change.userYearRoleId,
      userId: change.userId,
      year: change.year,
      action: change.action,
      changedBy: change.changedBy,
      changedById: change.changedById,
      previousRole: change.previousRole,
      previousDept: change.previousDept,
      newRole: change.newRole,
      newDept: change.newDept,
    })),
  });
}

/**
 * 예산 세목 연도별 설정 일괄 변경 이력 기록 (복사 시)
 */
export async function logBudgetDetailYearBulkChange(
  tx: PrismaTransaction,
  changes: BudgetDetailYearChange[]
): Promise<void> {
  if (changes.length === 0) return;

  await tx.budgetDetailYearHistory.createMany({
    data: changes.map((change) => ({
      budgetDetailYearId: change.budgetDetailYearId,
      budgetDetailId: change.budgetDetailId,
      budgetDetailName: change.budgetDetailName,
      year: change.year,
      action: change.action,
      changedBy: change.changedBy,
      changedById: change.changedById,
      previousManagerId: change.previousManagerId,
      previousManagerName: change.previousManagerName,
      previousBudgetAmt: change.previousBudgetAmt,
      newManagerId: change.newManagerId,
      newManagerName: change.newManagerName,
      newBudgetAmt: change.newBudgetAmt,
    })),
  });
}
