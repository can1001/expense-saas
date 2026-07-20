import StatusPill, { StatusPillVariant } from '@/components/ui/StatusPill';

// 지출결의서 상태 → StatusPill 매핑 (app/approvals/page.tsx의 패턴과 동일)
const EXPENSE_STATUS_PILL: Partial<Record<string, StatusPillVariant>> = {
  PENDING: 'pending',
  APPROVED_STEP_1: 'pending',
  APPROVED_STEP_2: 'pending',
  IN_PROGRESS: 'pending',
  APPROVED_FINAL: 'approved',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const EXPENSE_STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성중',
  PENDING: '1차 결재대기',
  APPROVED_STEP_1: '2차 결재대기',
  APPROVED_STEP_2: '3차 결재대기',
  APPROVED_FINAL: '최종승인',
  IN_PROGRESS: '결재진행중',
  APPROVED: '승인완료',
  REJECTED: '반려',
  WITHDRAWN: '회수',
};

export default function ExpenseStatusPill({ status }: { status: string }) {
  const variant = EXPENSE_STATUS_PILL[status];
  const label = EXPENSE_STATUS_LABEL[status] ?? status;
  if (!variant) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
        {label}
      </span>
    );
  }
  return <StatusPill variant={variant}>{label}</StatusPill>;
}
