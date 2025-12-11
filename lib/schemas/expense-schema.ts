/**
 * Zod 스키마 정의
 *
 * 지출결의서 폼 검증을 위한 스키마
 */

import { z } from 'zod';

/**
 * 세부 항목 스키마
 */
export const expenseItemSchema = z.object({
  budgetDetail: z
    .string()
    .min(1, '예산(세목)을 입력해주세요.')
    .max(100, '예산(세목)은 100자를 초과할 수 없습니다.'),

  description: z
    .string()
    .min(1, '적요를 입력해주세요.')
    .max(200, '적요는 200자를 초과할 수 없습니다.'),

  unitPrice: z
    .number()
    .positive('단가는 0보다 커야 합니다.')
    .int('단가는 정수여야 합니다.')
    .max(1000000000, '단가가 너무 큽니다.'),

  quantity: z
    .number()
    .positive('수량은 0보다 커야 합니다.')
    .int('수량은 정수여야 합니다.')
    .max(100000, '수량이 너무 큽니다.'),

  amount: z
    .number()
    .int('금액은 정수여야 합니다.')
    .nonnegative('금액은 음수일 수 없습니다.'),
});

/**
 * 지출결의서 폼 스키마
 */
export const expenseFormSchema = z.object({
  // 예산 정보 (필수)
  committee: z
    .string()
    .min(1, '위원회를 선택해주세요.')
    .max(50, '위원회 이름이 너무 깁니다.'),

  department: z
    .string()
    .min(1, '사역팀(부)을 선택해주세요.')
    .max(50, '사역팀(부) 이름이 너무 깁니다.'),

  budgetCategory: z
    .string()
    .min(1, '예산(항)을 선택해주세요.')
    .max(50, '예산(항) 이름이 너무 깁니다.'),

  budgetSubcategory: z
    .string()
    .min(1, '예산(목)을 선택해주세요.')
    .max(50, '예산(목) 이름이 너무 깁니다.'),

  // 지출일자 (선택사항)
  expenseDate: z
    .string()
    .optional()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      '올바른 날짜 형식이 아닙니다.'
    ),

  // 세부 항목들 (최소 1개, 최대 10개)
  items: z
    .array(expenseItemSchema)
    .min(1, '최소 1개의 항목이 필요합니다.')
    .max(10, '최대 10개까지 항목을 추가할 수 있습니다.'),

  // 신청 정보
  requestDate: z
    .string()
    .min(1, '청구 일자를 선택해주세요.')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      '올바른 날짜 형식이 아닙니다.'
    ),

  requestTeam: z
    .string()
    .min(1, '청구팀을 입력해주세요.')
    .max(50, '청구팀 이름이 너무 깁니다.'),

  applicantName: z
    .string()
    .min(1, '청구인 이름을 입력해주세요.')
    .max(50, '청구인 이름이 너무 깁니다.'),

  applicantTitle: z
    .string()
    .max(50, '직책 이름이 너무 깁니다.')
    .optional(),

  // 은행 정보
  bankName: z
    .string()
    .min(1, '은행명을 입력해주세요.')
    .max(50, '은행명이 너무 깁니다.'),

  accountNumber: z
    .string()
    .min(1, '계좌번호를 입력해주세요.')
    .max(50, '계좌번호가 너무 깁니다.')
    .regex(/^[0-9-]+$/, '계좌번호는 숫자와 하이픈(-)만 입력 가능합니다.'),

  accountHolder: z
    .string()
    .min(1, '예금주를 입력해주세요.')
    .max(50, '예금주 이름이 너무 깁니다.'),
});

/**
 * 타입 추출
 */
export type ExpenseItem = z.infer<typeof expenseItemSchema>;
export type ExpenseFormData = z.infer<typeof expenseFormSchema>;

/**
 * 기본값
 */
export const defaultExpenseItem: ExpenseItem = {
  budgetDetail: '',
  description: '',
  unitPrice: 0,
  quantity: 1,
  amount: 0,
};

export const defaultExpenseFormData: Partial<ExpenseFormData> = {
  requestDate: new Date().toISOString().split('T')[0],
  requestTeam: '출납팀',
  applicantName: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  items: [defaultExpenseItem],
};

/**
 * 금액 계산 함수 (10원 단위 절사)
 * 단가 × 수량 후 10원 단위로 내림 처리
 * 예: 11480 × 5 = 57400 → 57400
 * 예: 11483 × 5 = 57415 → 57410
 */
export function calculateAmount(unitPrice: number, quantity: number): number {
  return Math.floor((unitPrice * quantity) / 10) * 10;
}

/**
 * 총 청구금액 계산
 */
export function calculateTotalAmount(items: ExpenseItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}
