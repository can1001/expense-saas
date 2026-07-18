/**
 * SidebarUserCard 컴포넌트 테스트 (Phase 2 P4)
 *
 * 테스트 대상:
 * - /auth/me 조회 → 아바타(이름 첫 글자)·이름·이메일(없으면 userid) 렌더
 * - 클릭 시 메뉴(마이페이지/로그아웃) 열림, ESC·외부 클릭으로 닫힘
 * - 로그아웃 클릭 시 /auth/logout POST 후 /login 이동
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SidebarUserCard from '../SidebarUserCard';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const ME_RESPONSE = {
  user: {
    id: 'user-1',
    userid: 'hong123',
    username: '홍길동',
  },
};

describe('SidebarUserCard', () => {
  beforeEach(() => {
    push.mockReset();
    (global.fetch as Mock).mockReset();
  });

  it('사용자 정보를 조회해 아바타·이름·userid를 표시한다 (이메일 없음)', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ME_RESPONSE,
    });

    render(<SidebarUserCard />);

    expect(await screen.findByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('hong123')).toBeInTheDocument();
    expect(screen.getByText('홍')).toBeInTheDocument();
  });

  it('이메일이 있으면 이메일을 우선 표시한다', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { ...ME_RESPONSE.user, email: 'hong@example.com' } }),
    });

    render(<SidebarUserCard />);

    expect(await screen.findByText('hong@example.com')).toBeInTheDocument();
  });

  it('클릭 시 메뉴가 열리고 마이페이지 링크를 포함한다', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ME_RESPONSE,
    });

    render(<SidebarUserCard />);
    fireEvent.click(await screen.findByText('홍길동'));

    const link = screen.getByText('마이페이지').closest('a');
    expect(link).toHaveAttribute('href', '/mypage');
  });

  it('ESC 키로 메뉴가 닫힌다', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ME_RESPONSE,
    });

    render(<SidebarUserCard />);
    fireEvent.click(await screen.findByText('홍길동'));
    expect(screen.getByText('마이페이지')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('마이페이지')).not.toBeInTheDocument());
  });

  it('외부 클릭 시 메뉴가 닫힌다', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ME_RESPONSE,
    });

    render(<SidebarUserCard />);
    fireEvent.click(await screen.findByText('홍길동'));
    expect(screen.getByText('마이페이지')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByText('마이페이지')).not.toBeInTheDocument());
  });

  it('로그아웃 클릭 시 /auth/logout POST 후 /login 으로 이동한다', async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ME_RESPONSE })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<SidebarUserCard />);
    fireEvent.click(await screen.findByText('홍길동'));
    fireEvent.click(screen.getByText('로그아웃'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(global.fetch).toHaveBeenLastCalledWith('/api/auth/logout', { method: 'POST' });
  });

  it('사용자 정보가 없으면 아무것도 렌더링하지 않는다', async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: null }),
    });

    const { container } = render(<SidebarUserCard />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
