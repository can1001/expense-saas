/**
 * DashboardClient 컴포넌트 테스트 (Phase 2 P1)
 *
 * 테스트 대상:
 * - /api/admin/dashboard 조회 → KPI 4카드 + 최근 지출결의서 테이블 렌더
 * - 상태 매핑(PENDING류 → 대기, APPROVED_FINAL → 승인, REJECTED → 반려, 그 외 → 원문)
 * - 행 클릭 시 상세 이동, 로딩/에러 상태
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DashboardClient from '../DashboardClient';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const DASHBOARD_RESPONSE = {
  year: 2026,
  kpi: {
    executionRate: 62.5,
    pendingApprovals: 8,
    monthlyExpense: 24380000,
    pendingPayments: 3,
  },
  recentExpenses: [
    {
      id: 'exp-1',
      applicantName: '홍길동',
      requestAmount: 120000,
      status: 'PENDING',
      department: '전도부',
    },
    {
      id: 'exp-2',
      applicantName: '김철수',
      requestAmount: 500000,
      status: 'APPROVED_FINAL',
      department: '교육부',
    },
    {
      id: 'exp-3',
      applicantName: '이영희',
      requestAmount: 80000,
      status: 'REJECTED',
      department: '찬양부',
    },
  ],
};

describe('DashboardClient', () => {
  beforeEach(() => {
    push.mockReset();
    (global.fetch as Mock).mockReset();
  });

  it('로딩 중에는 스켈레톤을 표시한다', () => {
    (global.fetch as Mock).mockReturnValue(new Promise(() => {}));
    const { container } = render(<DashboardClient />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('KPI 카드와 최근 지출결의서를 렌더링한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => DASHBOARD_RESPONSE,
    });

    render(<DashboardClient />);

    await waitFor(() => expect(screen.getByText('8건')).toBeInTheDocument());
    expect(screen.getByText('₩24,380,000')).toBeInTheDocument();
    expect(screen.getAllByText('62.5%').length).toBeGreaterThan(0);
    expect(screen.getByText('3건')).toBeInTheDocument();

    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('전도부')).toBeInTheDocument();
    expect(screen.getByText('₩120,000')).toBeInTheDocument();
  });

  it('연도 쿼리 파라미터로 대시보드 API를 호출한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => DASHBOARD_RESPONSE,
    });

    render(<DashboardClient />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/admin\/dashboard\?year=\d{4}$/)
      )
    );
  });

  it('상태를 매핑해 StatusPill로 표시한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => DASHBOARD_RESPONSE,
    });

    render(<DashboardClient />);

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.getByText('대기')).toBeInTheDocument();
    expect(screen.getByText('승인')).toBeInTheDocument();
    expect(screen.getByText('반려')).toBeInTheDocument();
  });

  it('행 클릭 시 상세 페이지로 이동한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => DASHBOARD_RESPONSE,
    });

    render(<DashboardClient />);

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    fireEvent.click(screen.getByText('홍길동').closest('tr')!);

    expect(push).toHaveBeenCalledWith('/expenses/exp-1');
  });

  it('전체 보기 링크가 /expenses로 연결된다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => DASHBOARD_RESPONSE,
    });

    render(<DashboardClient />);

    await waitFor(() => expect(screen.getByText('전체 보기 →')).toBeInTheDocument());
    expect(screen.getByText('전체 보기 →').closest('a')).toHaveAttribute('href', '/expenses');
  });

  it('최근 지출결의서가 없으면 안내 문구를 표시한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...DASHBOARD_RESPONSE, recentExpenses: [] }),
    });

    render(<DashboardClient />);

    await waitFor(() =>
      expect(screen.getByText('최근 지출결의서가 없습니다.')).toBeInTheDocument()
    );
  });

  it('API 실패 시 한글 에러 문구를 표시한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: '서버 오류' }),
    });

    render(<DashboardClient />);

    await waitFor(() =>
      expect(screen.getByText('대시보드 데이터를 불러오지 못했습니다.')).toBeInTheDocument()
    );
  });
});
