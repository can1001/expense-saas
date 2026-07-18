import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../ProgressBar';

describe('ProgressBar', () => {
  it('progressbar role과 aria 값을 제공한다', () => {
    render(<ProgressBar value={68} label="예산 집행률" />);
    const bar = screen.getByRole('progressbar', { name: '예산 집행률' });
    expect(bar).toHaveAttribute('aria-valuenow', '68');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('% 텍스트를 기본 표시한다', () => {
    render(<ProgressBar value={68} label="예산 집행률" />);
    expect(screen.getByText('68%')).toBeInTheDocument();
  });

  describe('경고 임계값 (기본 90%)', () => {
    const fillOf = (container: HTMLElement) =>
      container.querySelector('[role="progressbar"] > div') as HTMLElement;

    it('89%는 정상(그린)', () => {
      const { container } = render(<ProgressBar value={89} label="집행률" />);
      expect(fillOf(container).className).toContain('bg-brand-500');
    });

    it('90%는 경고(앰버 bar 색)', () => {
      const { container } = render(<ProgressBar value={90} label="집행률" />);
      expect(fillOf(container).className).toContain('bg-status-pending-bar');
    });

    it('91%는 경고 유지', () => {
      const { container } = render(<ProgressBar value={91} label="집행률" />);
      expect(fillOf(container).className).toContain('bg-status-pending-bar');
    });

    it('warnThreshold 커스텀 값을 따른다', () => {
      const { container } = render(
        <ProgressBar value={75} warnThreshold={70} label="집행률" />
      );
      expect(fillOf(container).className).toContain('bg-status-pending-bar');
    });
  });

  it('범위 밖 값은 0~100으로 클램프한다', () => {
    render(<ProgressBar value={130} label="집행률" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    render(<ProgressBar value={-5} label="음수" />);
    expect(screen.getByRole('progressbar', { name: '음수' })).toHaveAttribute(
      'aria-valuenow',
      '0'
    );
  });
});
