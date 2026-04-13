/**
 * 재정보고서 컴포넌트 유틸리티
 */

// 금액 포맷 (천 단위 콤마)
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

// 전년 대비 증감 포맷 (▲ 빨강, ▼ 파랑)
export function formatDiff(current: number, previous: number | undefined): {
  text: string;
  isIncrease: boolean;
  diff: number;
} {
  if (previous === undefined) {
    return { text: '-', isIncrease: false, diff: 0 };
  }
  const diff = current - previous;
  const isIncrease = diff >= 0;
  const symbol = isIncrease ? '▲' : '▼';
  return {
    text: `${symbol} ${formatAmount(Math.abs(diff))}`,
    isIncrease,
    diff,
  };
}

// 진척률 포맷
export function formatRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}
