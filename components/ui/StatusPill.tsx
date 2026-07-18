import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusPillVariant = 'pending' | 'approved' | 'rejected' | 'brand';

interface StatusPillProps {
  variant: StatusPillVariant;
  children: ReactNode;
  className?: string;
}

/**
 * 결재 상태 필 — 대기(앰버)/승인(그린)/반려(레드)/브랜드(연그린)
 * 화면별 제각각인 상태 뱃지를 통합한다 (docs/DESIGN_SYSTEM_2026-07-18.md 4.3절).
 * 색상만으로 상태를 전달하지 않도록 텍스트 라벨을 필수로 받는다.
 */
const VARIANT_CLASSES: Record<StatusPillVariant, string> = {
  pending: 'bg-status-pending-bg text-status-pending',
  approved: 'bg-status-approved-bg text-status-approved',
  rejected: 'bg-status-rejected-bg text-status-rejected',
  brand: 'bg-brand-100 text-brand-600',
};

export default function StatusPill({ variant, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
