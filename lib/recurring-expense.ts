/**
 * 자동이체 (정기 지출결의서) 관련 유틸리티
 */
import { z } from 'zod';

/**
 * 자동이체 주기
 */
export enum RecurringFrequency {
  MONTHLY = 'MONTHLY',           // 매월
  QUARTERLY = 'QUARTERLY',       // 분기별 (3개월)
  SEMI_ANNUAL = 'SEMI_ANNUAL',   // 반기별 (6개월)
  ANNUAL = 'ANNUAL',             // 연간
}

/**
 * 자동이체 상태
 */
export enum RecurringExpenseStatus {
  ACTIVE = 'ACTIVE',       // 활성 (정상 실행)
  PAUSED = 'PAUSED',       // 일시 중지
  COMPLETED = 'COMPLETED', // 완료 (종료일 도달)
  CANCELLED = 'CANCELLED', // 취소
}

/**
 * 자동이체 생성 스키마
 */
export const createRecurringExpenseSchema = z.object({
  name: z.string().min(1, '자동이체 이름을 입력해주세요'),
  description: z.string().optional(),
  committee: z.string().min(1, '위원회를 선택해주세요'),
  department: z.string().min(1, '사역팀/부를 선택해주세요'),
  budgetCategory: z.string().min(1, '예산(항)을 선택해주세요'),
  budgetSubcategory: z.string().min(1, '예산(목)을 선택해주세요'),
  budgetDetail: z.string().min(1, '예산(세목)을 선택해주세요'),
  recipientName: z.string().min(1, '수취인명을 입력해주세요'),
  bankName: z.string().min(1, '은행명을 입력해주세요'),
  accountNumber: z.string().min(1, '계좌번호를 입력해주세요'),
  baseAmount: z.number().int().min(0, '기본 금액은 0 이상이어야 합니다'),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL']),
  dayOfMonth: z.number().int().min(1, '이체일은 1일 이상이어야 합니다').max(28, '이체일은 28일 이하여야 합니다'),
  startDate: z.date(),
  endDate: z.date().optional(),
  advanceDays: z.number().int().min(0, '사전 생성일은 0일 이상이어야 합니다').max(30, '사전 생성일은 30일 이하여야 합니다').default(7),
});

export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;

/**
 * 주어진 주기에 따라 다음 생성일을 계산
 *
 * @param frequency - 자동이체 주기
 * @param dayOfMonth - 이체일 (1-28)
 * @param advanceDays - 사전 생성일 (이체일 N일 전)
 * @param currentDate - 현재 날짜 (기본값: 오늘)
 * @param startMonth - 시작 월 (ANNUAL 주기에서 사용, 기본값: 1월)
 * @returns 다음 생성일
 */
export function calculateNextGenerationDate(
  frequency: RecurringFrequency,
  dayOfMonth: number,
  advanceDays: number,
  currentDate: Date = new Date(),
  startMonth: number = 1
): Date {
  const current = new Date(currentDate);
  current.setHours(0, 0, 0, 0);

  // 주기별 월 간격
  const monthInterval = getMonthInterval(frequency);

  // 현재 연월 기준으로 가능한 다음 이체일들을 계산
  let year = current.getFullYear();
  let month = current.getMonth() + 1; // 1-indexed

  // ANNUAL의 경우 시작 월 기준으로 계산
  if (frequency === RecurringFrequency.ANNUAL) {
    month = startMonth;
    // 올해 해당 월이 이미 지났으면 내년으로
    const thisYearTransferDate = new Date(year, startMonth - 1, dayOfMonth);
    const thisYearGenerationDate = new Date(thisYearTransferDate);
    thisYearGenerationDate.setDate(thisYearGenerationDate.getDate() - advanceDays);

    if (thisYearGenerationDate >= current) {
      return thisYearGenerationDate;
    }
    return new Date(year + 1, startMonth - 1, dayOfMonth - advanceDays);
  }

  // SEMI_ANNUAL의 경우
  if (frequency === RecurringFrequency.SEMI_ANNUAL) {
    // 1월과 7월 기준으로 계산
    const baseMonths = [1, 7];
    for (const baseMonth of baseMonths) {
      const transferDate = new Date(year, baseMonth - 1, dayOfMonth);
      const generationDate = new Date(transferDate);
      generationDate.setDate(generationDate.getDate() - advanceDays);

      if (generationDate >= current) {
        return generationDate;
      }
    }
    // 올해 둘 다 지났으면 내년 1월
    return new Date(year + 1, 0, dayOfMonth - advanceDays);
  }

  // QUARTERLY의 경우
  if (frequency === RecurringFrequency.QUARTERLY) {
    // 1, 4, 7, 10월 기준
    const quarterMonths = [1, 4, 7, 10];
    for (const quarterMonth of quarterMonths) {
      const transferDate = new Date(year, quarterMonth - 1, dayOfMonth);
      const generationDate = new Date(transferDate);
      generationDate.setDate(generationDate.getDate() - advanceDays);

      if (generationDate >= current) {
        return generationDate;
      }
    }
    // 올해 모두 지났으면 내년 1월
    return new Date(year + 1, 0, dayOfMonth - advanceDays);
  }

  // MONTHLY의 경우
  // 이번 달 이체일 기준 생성일 계산
  let transferDate = new Date(year, month - 1, dayOfMonth);
  let generationDate = new Date(transferDate);
  generationDate.setDate(generationDate.getDate() - advanceDays);

  // 이번 달 생성일이 이미 지났으면 다음 달로
  if (generationDate < current) {
    month += monthInterval;
    if (month > 12) {
      year += Math.floor((month - 1) / 12);
      month = ((month - 1) % 12) + 1;
    }
    transferDate = new Date(year, month - 1, dayOfMonth);
    generationDate = new Date(transferDate);
    generationDate.setDate(generationDate.getDate() - advanceDays);
  }

  return generationDate;
}

/**
 * 주기별 월 간격 반환
 */
function getMonthInterval(frequency: RecurringFrequency): number {
  switch (frequency) {
    case RecurringFrequency.MONTHLY:
      return 1;
    case RecurringFrequency.QUARTERLY:
      return 3;
    case RecurringFrequency.SEMI_ANNUAL:
      return 6;
    case RecurringFrequency.ANNUAL:
      return 12;
    default:
      return 1;
  }
}

/**
 * 지출결의서를 생성해야 하는지 확인
 *
 * @param nextGenerationDate - 다음 생성 예정일
 * @param currentDate - 현재 날짜 (기본값: 오늘)
 * @returns 생성해야 하면 true
 */
export function shouldGenerateExpense(
  nextGenerationDate: Date | null,
  currentDate: Date = new Date()
): boolean {
  if (!nextGenerationDate) {
    return false;
  }

  const next = new Date(nextGenerationDate);
  next.setHours(0, 0, 0, 0);

  const current = new Date(currentDate);
  current.setHours(0, 0, 0, 0);

  return current >= next;
}

/**
 * 다음 이체일 계산 (생성일이 아닌 실제 이체일)
 *
 * @param frequency - 자동이체 주기
 * @param dayOfMonth - 이체일 (1-28)
 * @param currentDate - 현재 날짜
 * @returns 다음 이체일
 */
export function calculateNextTransferDate(
  frequency: RecurringFrequency,
  dayOfMonth: number,
  currentDate: Date = new Date()
): Date {
  // 생성일 + advanceDays가 이체일이므로, advanceDays=0으로 계산하면 이체일
  return calculateNextGenerationDate(frequency, dayOfMonth, 0, currentDate);
}
