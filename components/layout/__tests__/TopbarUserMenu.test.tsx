/**
 * TopbarUserMenu 컴포넌트 테스트 (Phase 3 H2)
 *
 * 테스트 대상:
 * - 아바타(이름 첫 글자)·이름·역할 배지 렌더
 * - 클릭 시 드롭다운 열림 — Header.tsx 드롭다운과 동일 항목(비밀번호/서명/알림 설정·히스토리)
 * - 알림 발송·사용자 등록은 권한 있는 역할에서만 노출
 * - ESC·외부 클릭으로 닫힘
 * - 로그아웃 클릭 시 /auth/logout POST 후 /login 이동 (useLogout 공통 훅)
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TopbarUserMenu from '../TopbarUserMenu';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const ADMIN_USER = { username: '홍길동', role: 'admin' };
const PLAIN_USER = { username: '김철수', role: 'user' };

describe('TopbarUserMenu', () => {
  beforeEach(() => {
    push.mockReset();
    (global.fetch as Mock).mockReset();
    (global.fetch as Mock).mockResolvedValue({ ok: true, json: async () => [] });
  });

  it('아바타 이니셜·이름·역할 배지를 표시한다', () => {
    render(<TopbarUserMenu user={ADMIN_USER} />);

    expect(screen.getByText('홍')).toBeInTheDocument();
    expect(screen.getByText('홍길동')).toBeInTheDocument();
  });

  it('클릭 시 드롭다운이 열리고 Header와 동일한 마이페이지 항목을 포함한다', () => {
    render(<TopbarUserMenu user={ADMIN_USER} />);
    fireEvent.click(screen.getByText('홍길동'));

    expect(screen.getByText('비밀번호 변경').closest('a')).toHaveAttribute('href', '/mypage/password');
    expect(screen.getByText('서명/도장 관리').closest('a')).toHaveAttribute('href', '/mypage/signatures');
    expect(screen.getByText('알림 설정').closest('a')).toHaveAttribute('href', '/mypage/notifications');
    expect(screen.getByText('알림 히스토리').closest('a')).toHaveAttribute(
      'href',
      '/mypage/notification-history'
    );
  });

  it('알림 발송·사용자 등록 권한이 있는 역할(admin)에서는 해당 항목이 노출된다', () => {
    render(<TopbarUserMenu user={ADMIN_USER} />);
    fireEvent.click(screen.getByText('홍길동'));

    expect(screen.getByText('알림 발송')).toBeInTheDocument();
    expect(screen.getByText('사용자 등록')).toBeInTheDocument();
  });

  it('권한 없는 역할(user)에서는 알림 발송·사용자 등록이 노출되지 않는다', () => {
    render(<TopbarUserMenu user={PLAIN_USER} />);
    fireEvent.click(screen.getByText('김철수'));

    expect(screen.queryByText('알림 발송')).not.toBeInTheDocument();
    expect(screen.queryByText('사용자 등록')).not.toBeInTheDocument();
  });

  it('ESC 키로 드롭다운이 닫힌다', async () => {
    render(<TopbarUserMenu user={ADMIN_USER} />);
    fireEvent.click(screen.getByText('홍길동'));
    expect(screen.getByText('비밀번호 변경')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('비밀번호 변경')).not.toBeInTheDocument());
  });

  it('외부 클릭 시 드롭다운이 닫힌다', async () => {
    render(<TopbarUserMenu user={ADMIN_USER} />);
    fireEvent.click(screen.getByText('홍길동'));
    expect(screen.getByText('비밀번호 변경')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByText('비밀번호 변경')).not.toBeInTheDocument());
  });

  it('로그아웃 클릭 시 /auth/logout POST 후 /login 으로 이동한다', async () => {
    render(<TopbarUserMenu user={ADMIN_USER} />);
    fireEvent.click(screen.getByText('홍길동'));
    fireEvent.click(screen.getByText('로그아웃'));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(global.fetch).toHaveBeenLastCalledWith('/api/auth/logout', { method: 'POST' });
  });
});
