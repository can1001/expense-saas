import { z } from 'zod';

// 중앙화된 계산 함수 및 스키마 re-export
export {
  calculateAmount,
  calculateTotalAmount as calculateTotal,
  expenseItemSchema as baseExpenseItemSchema,
} from '@/lib/schemas/expense-schema';

// API용 지출 항목 스키마 (order 필드 추가)
import { expenseItemSchema as baseSchema } from '@/lib/schemas/expense-schema';
export const expenseItemSchema = baseSchema.extend({
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
  // 청구팀은 서버에서 committee/department 기반으로 자동 생성하므로 입력값은 선택사항
  requestTeam: z.string().optional(),
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
