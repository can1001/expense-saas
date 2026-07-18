/**
 * TopbarBell 컴포넌트 테스트 (Phase 3 H3)
 *
 * 테스트 대상:
 * - 벨 아이콘 링크가 /mypage/notification-history 를 가리킨다
 * - 미확인 카운트 dot(신규 API 없음)이 렌더되지 않는다
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopbarBell from '../TopbarBell';

describe('TopbarBell', () => {
  it('알림 히스토리로 이동하는 링크를 렌더한다', () => {
    render(<TopbarBell />);

    const link = screen.getByRole('link', { name: '알림 히스토리' });
    expect(link).toHaveAttribute('href', '/mypage/notification-history');
  });

  it('미확인 카운트 dot을 렌더하지 않는다', () => {
    render(<TopbarBell />);

    expect(screen.queryByTestId('topbar-bell-dot')).not.toBeInTheDocument();
  });
});
