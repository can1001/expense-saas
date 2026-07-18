import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Home, FileText, CheckSquare } from 'lucide-react';
import Sidebar, { SidebarConfig } from '../Sidebar';

let mockPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

const globalConfig: SidebarConfig = {
  variant: 'global',
  groups: [
    {
      items: [
        { href: '/', label: '대시보드', icon: Home },
        { href: '/expenses', label: '지출결의서', icon: FileText },
        { href: '/approvals', label: '결재함', icon: CheckSquare, badgeCount: 8 },
      ],
    },
  ],
};

const adminConfig: SidebarConfig = {
  variant: 'admin',
  backLink: { href: '/', label: '홈으로' },
  groups: [
    { title: '조직 관리', items: [{ href: '/admin/committees', label: '위원회 관리', icon: Home }] },
    { title: '시스템', items: [{ href: '/admin', label: '대시보드', icon: Home }] },
  ],
};

beforeEach(() => {
  mockPathname = '/';
});

describe('Sidebar', () => {
  it('그룹 타이틀과 메뉴 항목을 렌더링한다 (모바일+데스크톱 중복 렌더)', () => {
    render(<Sidebar config={adminConfig} />);
    expect(screen.getAllByText('조직 관리').length).toBeGreaterThan(0);
    expect(screen.getAllByText('위원회 관리').length).toBeGreaterThan(0);
  });

  it('백링크를 렌더링한다', () => {
    render(<Sidebar config={adminConfig} />);
    const backLinks = screen.getAllByText('홈으로');
    expect(backLinks.length).toBeGreaterThan(0);
    expect(backLinks[0].closest('a')).toHaveAttribute('href', '/');
  });

  it('badgeCount가 있으면 뱃지를 표시한다', () => {
    render(<Sidebar config={globalConfig} />);
    expect(screen.getAllByText('8').length).toBeGreaterThan(0);
  });

  it('badgeCount가 0이면 뱃지를 숨긴다', () => {
    const config: SidebarConfig = {
      variant: 'global',
      groups: [{ items: [{ href: '/approvals', label: '결재함', icon: CheckSquare, badgeCount: 0 }] }],
    };
    render(<Sidebar config={config} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  describe('활성 경로 하이라이트', () => {
    it('하위 경로도 부모 메뉴를 활성화한다', () => {
      mockPathname = '/expenses/123';
      render(<Sidebar config={globalConfig} />);
      const link = screen.getAllByText('지출결의서')[0].closest('a');
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('/admin은 정확 일치만 활성화한다', () => {
      mockPathname = '/admin/committees';
      render(<Sidebar config={adminConfig} />);
      const adminDash = screen.getAllByText('대시보드')[0].closest('a');
      expect(adminDash).not.toHaveAttribute('aria-current');
      const committees = screen.getAllByText('위원회 관리')[0].closest('a');
      expect(committees).toHaveAttribute('aria-current', 'page');
    });

    it('루트(/)는 정확 일치만 활성화한다', () => {
      mockPathname = '/expenses';
      render(<Sidebar config={globalConfig} />);
      const dash = screen.getAllByText('대시보드')[0].closest('a');
      expect(dash).not.toHaveAttribute('aria-current');
    });

    it('접두어만 같은 형제 경로는 활성화하지 않는다', () => {
      mockPathname = '/expenses-archive';
      render(<Sidebar config={globalConfig} />);
      const link = screen.getAllByText('지출결의서')[0].closest('a');
      expect(link).not.toHaveAttribute('aria-current');
    });
  });

  describe('모바일 드로어', () => {
    it('ESC 키로 onClose를 호출한다', () => {
      const onClose = vi.fn();
      render(<Sidebar config={globalConfig} isOpen onClose={onClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('열림 상태에서 body 스크롤을 잠근다', () => {
      render(<Sidebar config={globalConfig} isOpen onClose={() => {}} />);
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  it('footer 슬롯을 렌더링한다', () => {
    render(<Sidebar config={globalConfig} footer={<div>사용자 카드</div>} />);
    expect(screen.getAllByText('사용자 카드').length).toBeGreaterThan(0);
  });
});
