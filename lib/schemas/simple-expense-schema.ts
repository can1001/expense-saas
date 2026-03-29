/**
 * 간편 지출결의서 (Ver.4.1.4) Zod 스키마
 *
 * 기존 지출결의서와의 차이점:
 * - 위원회/사역팀 선택 없음
 * - 각 항목별로 예산(항/목/세목) 선택
 */

import { z } from 'zod';
import { calculateAmount, calculateTotalAmount } from './expense-schema';

// Re-export calculation functions
export { calculateAmount, calculateTotalAmount };

/**
 * 간편 지출결의서 세부 항목 스키마
 * 각 항목마다 예산(항/목/세목) 선택
 */
export const simpleExpenseItemSchema = z.object({
  // 예산 항목 (각 행마다 선택)
  budgetCategory: z
    .string()
    .min(1, '예산(항)을 선택해주세요.')
    .max(100, '예산(항)은 100자를 초과할 수 없습니다.'),

  budgetSubcategory: z
    .string()
    .min(1, '예산(목)을 선택해주세요.')
    .max(100, '예산(목)은 100자를 초과할 수 없습니다.'),

  budgetDetail: z
    .string()
    .min(1, '예산(세목)을 선택해주세요.')
    .max(100, '예산(세목)은 100자를 초과할 수 없습니다.'),

  description: z
    .string()
    .min(1, '적요를 입력해주세요.')
    .max(200, '적요는 200자를 초과할 수 없습니다.'),

  unitPrice: z
    .number()
    .nonnegative('단가는 0 이상이어야 합니다.')
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
 * 간편 지출결의서 폼 스키마
 */
export const simpleExpenseFormSchema = z.object({
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
    .array(simpleExpenseItemSchema)
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

  applicantName: z
    .string()
    .min(1, '청구인 이름을 입력해주세요.')
    .max(50, '청구인 이름이 너무 깁니다.'),

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
export type SimpleExpenseItem = z.infer<typeof simpleExpenseItemSchema>;
export type SimpleExpenseFormData = z.infer<typeof simpleExpenseFormSchema>;

/**
 * 기본값
 */
export const defaultSimpleExpenseItem: SimpleExpenseItem = {
  budgetCategory: '',
  budgetSubcategory: '',
  budgetDetail: '',
  description: '',
  unitPrice: 0,
  quantity: 1,
  amount: 0,
};

export const defaultSimpleExpenseFormData: Partial<SimpleExpenseFormData> = {
  requestDate: new Date().toISOString().split('T')[0],
  applicantName: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  items: [defaultSimpleExpenseItem],
};

/**
 * API용 스키마 (order 필드 추가, 날짜 변환)
 */
export const simpleExpenseItemApiSchema = simpleExpenseItemSchema.extend({
  order: z.number().int().optional(),
});

export const createSimpleExpenseSchema = z.object({
  expenseDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val || val === null) return null;
    return typeof val === 'string' ? new Date(val) : val;
  }),

  items: z.array(simpleExpenseItemApiSchema).min(1, '최소 1개 이상의 항목이 필요합니다'),

  requestDate: z.union([z.string(), z.date()]).transform(val =>
    typeof val === 'string' ? new Date(val) : val
  ),
  applicantName: z.string().min(1, '청구인을 입력해주세요'),

  bankName: z.string().min(1, '은행명을 입력해주세요'),
  accountNumber: z.string().min(1, '계좌번호를 입력해주세요'),
  accountHolder: z.string().min(1, '예금주를 입력해주세요'),

  // 상태 (저장/제출)
  status: z.enum(['DRAFT', 'PENDING']).optional().default('DRAFT'),
});

export const updateSimpleExpenseSchema = createSimpleExpenseSchema.partial();

export type CreateSimpleExpense = z.infer<typeof createSimpleExpenseSchema>;
export type UpdateSimpleExpense = z.infer<typeof updateSimpleExpenseSchema>;
