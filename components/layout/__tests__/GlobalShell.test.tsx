/**
 * GlobalShell 컴포넌트 테스트 (Phase 4 G1)
 *
 * DashboardShell의 셸 부분(사용자 fetch·전역 사이드바·탑바·SidebarUserCard)을
 * 일반화한 재사용 컴포넌트. docs/SPEC_HEADER_CUTOVER_PHASE4_2026-07-20.md 2.1절
 * Sidebar는 모바일 드로어·데스크톱 nav를 동시에 렌더하므로 메뉴 라벨은 getAllByText로 검증한다.
 */

import { describe, it, expect, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import GlobalShell from '../GlobalShell';

function mockFetchImplementation(overrides: { user?: any; memberships?: any[] } = {}) {
  const user = overrides.user ?? { username: '홍길동', userid: 'hong', role: 'admin', roles: ['admin'] };
  const memberships = overrides.memberships ?? [];

  (global.fetch as Mock).mockImplementation(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/auth/me')) {
      return { ok: true, json: async () => ({ user }) } as Response;
    }
    if (url.includes('/me/memberships')) {
      return { ok: true, json: async () => ({ memberships }) } as Response;
    }
    if (url.includes('/pending-count')) {
      return { ok: true, json: async () => ({ count: 0 }) } as Response;
    }
    if (url.includes('/admin/roles')) {
      return { ok: true, json: async () => [] } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

describe('GlobalShell', () => {
  beforeEach(() => {
    (global.fetch as Mock).mockReset();
    mockFetchImplementation();
  });

  it('탑바 타이틀·children·actions를 렌더한다', async () => {
    render(
      <GlobalShell title="테스트 셸" actions={<button>+ 작성</button>}>
        <div>본문 콘텐츠</div>
      </GlobalShell>
    );

    expect(screen.getByText('테스트 셸')).toBeInTheDocument();
    expect(screen.getByText('본문 콘텐츠')).toBeInTheDocument();
    expect(screen.getByText('+ 작성')).toBeInTheDocument();

    // 사용자 fetch 완료까지 대기 — act 경고 방지
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  });

  it('/auth/me 조회 후 탑바 사용자 메뉴가 나타난다', async () => {
    render(<GlobalShell title="홈">본문</GlobalShell>);

    await waitFor(() => expect(screen.getAllByText('홍길동').length).toBeGreaterThan(0));
  });

  it('user prop 없이도 fetch된 사용자 role로 사이드바 결재함 메뉴 접근 여부가 파생된다', async () => {
    render(<GlobalShell title="홈">본문</GlobalShell>);

    // admin 역할은 결재 승인 권한이 있어 결재함 메뉴가 노출된다
    await waitFor(() => expect(screen.getAllByText('결재함').length).toBeGreaterThan(0));
  });

  it('user prop의 isBudgetManager로 결재함 메뉴 노출 여부를 판정한다', async () => {
    mockFetchImplementation({ user: { username: '김철수', userid: 'kim', role: 'user', roles: ['user'] } });

    render(
      <GlobalShell title="홈" user={{ roles: ['user'], isBudgetManager: true }}>
        본문
      </GlobalShell>
    );

    await waitFor(() => expect(screen.getAllByText('결재함').length).toBeGreaterThan(0));
  });

  it('일반 사용자(user 역할·세목 담당자 아님)는 결재함 메뉴가 노출되지 않는다', async () => {
    render(
      <GlobalShell title="홈" user={{ roles: ['user'] }}>
        본문
      </GlobalShell>
    );

    await waitFor(() => expect(screen.getAllByText('지출결의서').length).toBeGreaterThan(0));
    expect(screen.queryByText('결재함')).not.toBeInTheDocument();
  });
});
