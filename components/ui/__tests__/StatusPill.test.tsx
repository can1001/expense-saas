import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusPill from '../StatusPill';

describe('StatusPill', () => {
  it('라벨 텍스트를 렌더링한다', () => {
    render(<StatusPill variant="pending">대기</StatusPill>);
    expect(screen.getByText('대기')).toBeInTheDocument();
  });

  it.each([
    ['pending', 'bg-status-pending-bg', 'text-status-pending'],
    ['approved', 'bg-status-approved-bg', 'text-status-approved'],
    ['rejected', 'bg-status-rejected-bg', 'text-status-rejected'],
    ['brand', 'bg-brand-100', 'text-brand-600'],
  ] as const)('%s variant는 해당 토큰 클래스를 적용한다', (variant, bg, text) => {
    render(<StatusPill variant={variant}>라벨</StatusPill>);
    const pill = screen.getByText('라벨');
    expect(pill.className).toContain(bg);
    expect(pill.className).toContain(text);
  });

  it('className을 병합한다', () => {
    render(
      <StatusPill variant="approved" className="ml-2">
        승인
      </StatusPill>
    );
    expect(screen.getByText('승인').className).toContain('ml-2');
  });
});
