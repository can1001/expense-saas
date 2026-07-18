import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Clock } from 'lucide-react';
import StatCard from '../StatCard';
import StatusPill from '../StatusPill';

describe('StatCard', () => {
  it('라벨과 값을 렌더링한다', () => {
    render(<StatCard icon={Clock} label="대기 중 결재" value="8건" />);
    expect(screen.getByText('대기 중 결재')).toBeInTheDocument();
    expect(screen.getByText('8건')).toBeInTheDocument();
  });

  it('값에 tabular-nums를 적용한다', () => {
    render(<StatCard icon={Clock} label="이번 달 지출" value="24,380,000" />);
    expect(screen.getByText('24,380,000').className).toContain('tabular-nums');
  });

  it('sub 슬롯을 렌더링한다', () => {
    render(
      <StatCard
        icon={Clock}
        label="대기 중 결재"
        value="8건"
        sub={<StatusPill variant="pending">승인 필요</StatusPill>}
      />
    );
    expect(screen.getByText('승인 필요')).toBeInTheDocument();
  });

  it('sub가 없으면 보조 영역을 그리지 않는다', () => {
    const { container } = render(<StatCard icon={Clock} label="라벨" value="값" />);
    // 카드 직계 자식은 상단 행 하나뿐
    expect(container.firstElementChild?.childElementCount).toBe(1);
  });
});
