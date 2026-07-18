import { cn } from '@/lib/utils';

interface ProgressBarProps {
  /** 0~100 (범위 밖 값은 클램프) */
  value: number;
  /** 이 값 이상이면 경고(앰버)로 전환. 기본 90 (예산 초과 임박 기준) */
  warnThreshold?: number;
  /** 스크린리더용 라벨 (예: "예산 집행률") */
  label: string;
  /** % 숫자 텍스트 표시 여부 — 색상만으로 상태를 전달하지 않기 위해 기본 표시 */
  showValue?: boolean;
  className?: string;
}

/**
 * 예산 집행률 프로그레스 바
 * 경고 상태의 채움색은 흰 배경 대비 3:1을 만족하는 status-pending-bar(#D97706)를 사용하고,
 * % 텍스트를 병기해 색각 이상 사용자도 판별 가능하게 한다.
 */
export default function ProgressBar({
  value,
  warnThreshold = 90,
  label,
  showValue = true,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const isWarn = clamped >= warnThreshold;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-track"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            isWarn ? 'bg-status-pending-bar' : 'bg-brand-500'
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue && (
        <span
          className={cn(
            'text-xs font-semibold tabular-nums',
            isWarn ? 'text-status-pending' : 'text-gray-500'
          )}
        >
          {clamped}%
        </span>
      )}
    </div>
  );
}
