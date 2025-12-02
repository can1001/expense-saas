import { z } from 'zod';

// 지출 항목 스키마
export const expenseItemSchema = z.object({
  budgetDetail: z.string().min(1, '예산(세목)을 입력해주세요'),
  description: z.string().min(1, '적요를 입력해주세요'),
  unitPrice: z.number().int().positive('단가는 양수여야 합니다'),
  quantity: z.number().int().positive('수량은 양수여야 합니다'),
  amount: z.number().int(),
  order: z.number().int().optional(),
});

// 지출결의서 생성 스키마
export const createExpenseSchema = z.object({
  committee: z.string().min(1, '위원회를 선택해주세요'),
  department: z.string().min(1, '사역팀(부)을 선택해주세요'),
  budgetCategory: z.string().min(1, '예산(항)을 선택해주세요'),
  budgetSubcategory: z.string().min(1, '예산(목)을 선택해주세요'),

  expenseDate: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val || val === null) return null;
    return typeof val === 'string' ? new Date(val) : val;
  }),

  items: z.array(expenseItemSchema).min(1, '최소 1개 이상의 항목이 필요합니다'),

  requestDate: z.union([z.string(), z.date()]).transform(val =>
    typeof val === 'string' ? new Date(val) : val
  ),
  requestTeam: z.string().default('출납팀'),
  applicantName: z.string().min(1, '청구인을 입력해주세요'),
  applicantTitle: z.string().optional().nullable(),

  bankName: z.string().min(1, '은행명을 입력해주세요'),
  accountNumber: z.string().min(1, '계좌번호를 입력해주세요'),
  accountHolder: z.string().min(1, '예금주를 입력해주세요'),
});

// 지출결의서 수정 스키마
export const updateExpenseSchema = createExpenseSchema.partial();

// 타입 추출
export type ExpenseItem = z.infer<typeof expenseItemSchema>;
export type CreateExpense = z.infer<typeof createExpenseSchema>;
export type UpdateExpense = z.infer<typeof updateExpenseSchema>;

// 금액 계산 함수 (10원 단위 절사)
export function calculateAmount(unitPrice: number, quantity: number): number {
  return Math.floor((unitPrice * quantity) / 10) * 10;
}

// 전체 합계 계산
export function calculateTotal(items: ExpenseItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}
