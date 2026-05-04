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
  budgetDetail: z.string().optional(), // 세목이 없는 예산 항목도 있음
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
 * 이체일에서 생성일을 계산하는 헬퍼
 */
function createGenerationDate(year: number, month: number, dayOfMonth: number, advanceDays: number): Date {
  const transferDate = new Date(year, month - 1, dayOfMonth);
  const generationDate = new Date(transferDate);
  generationDate.setDate(generationDate.getDate() - advanceDays);
  return generationDate;
}

/**
 * 주어진 월 목록에서 현재 날짜 이후의 첫 번째 생성일을 찾음
 */
function findNextGenerationDateInMonths(
  months: number[],
  year: number,
  dayOfMonth: number,
  advanceDays: number,
  current: Date
): Date {
  for (const month of months) {
    const generationDate = createGenerationDate(year, month, dayOfMonth, advanceDays);
    if (generationDate >= current) {
      return generationDate;
    }
  }
  // 올해 모두 지났으면 내년 첫 번째 월
  return createGenerationDate(year + 1, months[0], dayOfMonth, advanceDays);
}

/**
 * 주기별 대상 월 목록 반환
 */
function getTargetMonths(frequency: RecurringFrequency, startMonth: number): number[] {
  switch (frequency) {
    case RecurringFrequency.ANNUAL:
      return [startMonth];
    case RecurringFrequency.SEMI_ANNUAL:
      return [1, 7];
    case RecurringFrequency.QUARTERLY:
      return [1, 4, 7, 10];
    default:
      return [];
  }
}

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
  const year = current.getFullYear();

  // MONTHLY가 아닌 경우: 대상 월 목록에서 다음 생성일 찾기
  if (frequency !== RecurringFrequency.MONTHLY) {
    const targetMonths = getTargetMonths(frequency, startMonth);
    return findNextGenerationDateInMonths(targetMonths, year, dayOfMonth, advanceDays, current);
  }

  // MONTHLY의 경우
  let month = current.getMonth() + 1;
  let generationDate = createGenerationDate(year, month, dayOfMonth, advanceDays);

  // 이번 달 생성일이 이미 지났으면 다음 달로
  if (generationDate < current) {
    month += 1;
    const nextYear = month > 12 ? year + 1 : year;
    const nextMonth = month > 12 ? 1 : month;
    generationDate = createGenerationDate(nextYear, nextMonth, dayOfMonth, advanceDays);
  }

  return generationDate;
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
