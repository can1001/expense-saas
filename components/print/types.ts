/**
 * 프린트 컴포넌트 타입 정의
 * 중앙화된 타입을 re-export하고 프린트 전용 유틸리티 제공
 */

// 중앙화된 타입 re-export
export type { ExpenseItem, ExpenseAttachment, Expense } from '@/lib/types';

// 프린트용 통화 포맷 함수 (원 기호 없이 숫자만)
export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('ko-KR');
};
