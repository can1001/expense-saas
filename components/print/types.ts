/**
 * 프린트 컴포넌트 타입 정의
 * 중앙화된 타입을 re-export하고 프린트 전용 유틸리티 제공
 */

// 중앙화된 타입 re-export
export type { ExpenseItem, ExpenseAttachment, Expense } from '@/lib/types';

// 결재 단계 타입
export interface ApprovalStep {
  id: string;
  stepNumber: number;
  stepName: string;
  approverName: string;
  status: string;
  approvedAt?: Date | null;
  signatureType?: string | null;
  signatureData?: string | null;
}

// 결재선 타입
export interface ApprovalLine {
  id: string;
  currentStep: number;
  totalSteps: number;
  steps: ApprovalStep[];
}

// 최종확인 단계 타입 (재정팀 검토, 회계 승인, 지급 완료)
// export interface ConfirmationStep {
//   type: 'finance_review' | 'accounting_approval' | 'payment_complete';
//   label: string;
//   signatureData?: string | null;
//   completedAt?: Date | null;
//   completedBy?: string | null;
// }

// 프린트용 통화 포맷 함수 (원 기호 없이 숫자만)
export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('ko-KR');
};
