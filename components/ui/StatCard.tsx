import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  /** 지표 이름 (예: "대기 중 결재") */
  label: string;
  /** 큰 숫자/값 (예: "8건", "24,380,000") */
  value: string;
  /** 보조 영역 — StatusPill, ProgressBar 등 (예: <StatusPill variant="pending">승인 필요</StatusPill>) */
  sub?: ReactNode;
  className?: string;
}

/**
 * KPI 스탯 카드 — 대시보드 상단 지표용 (docs/DESIGN_SYSTEM_2026-07-18.md 3절)
 * 아이콘 타일(brand-100) + 라벨 + 큰 숫자(tabular-nums) + 보조 슬롯.
 */
export default function StatCard({ icon: Icon, label, value, sub, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-2xl border border-surface-border bg-white p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-100 text-brand-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-gray-500">{label}</div>
          <div className="truncate text-2xl font-bold tabular-nums text-gray-900">{value}</div>
        </div>
      </div>
      {sub && <div className="flex items-center gap-2 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
