/**
 * 저장된 은행 계좌 Zod 스키마
 */

import { z } from 'zod';

// 계좌번호 정규식 (숫자와 하이픈만 허용)
const accountNumberRegex = /^[0-9-]+$/;

/**
 * 은행 계좌 생성 스키마
 */
export const savedBankAccountSchema = z.object({
  bankName: z
    .string()
    .min(1, '은행명을 입력해주세요.')
    .max(50, '은행명이 너무 깁니다.'),

  accountNumber: z
    .string()
    .min(1, '계좌번호를 입력해주세요.')
    .max(50, '계좌번호가 너무 깁니다.')
    .regex(accountNumberRegex, '계좌번호는 숫자와 하이픈(-)만 입력 가능합니다.'),

  accountHolder: z
    .string()
    .min(1, '예금주를 입력해주세요.')
    .max(50, '예금주 이름이 너무 깁니다.'),

  nickname: z
    .string()
    .max(50, '별명이 너무 깁니다.')
    .optional()
    .nullable(),

  isDefault: z.boolean().optional().default(false),
});

/**
 * 은행 계좌 수정 스키마 (모든 필드 선택적)
 */
export const updateBankAccountSchema = savedBankAccountSchema.partial();

/**
 * 타입 추출
 */
export type SavedBankAccountInput = z.infer<typeof savedBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;

/**
 * 저장된 은행 계좌 타입 (DB에서 반환되는 전체 필드)
 */
export interface SavedBankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  nickname: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
