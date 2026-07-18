/**
 * DepartmentBudgetPanel 컴포넌트 테스트 (Phase 2 P2)
 *
 * 테스트 대상:
 * - /api/admin/budget-execution 조회 → 부서별 집행률 리스트 렌더
 * - 90% 임계값 이상 부서의 경고 배너 노출 (부서 0곳/전부 90% 미만이면 배너 없음)
 * - 로딩/에러 상태
 */

import { describe, it, expect, beforeEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DepartmentBudgetPanel from '../DepartmentBudgetPanel';

const BUDGET_EXECUTION_RESPONSE = {
  year: 2026,
  summary: { totalBudget: 0, totalSpent: 0, executionRate: 0 },
  committees: [
    {
      id: 'comm-1',
      name: '전도위원회',
      budget: 0,
      spent: 0,
      executionRate: 0,
      departments: [
        { id: 'dept-1', name: '전도부', budget: 1000000, spent: 950000, executionRate: 95 },
        { id: 'dept-2', name: '교육부', budget: 1000000, spent: 400000, executionRate: 40 },
      ],
    },
    {
      id: 'comm-2',
      name: '찬양위원회',
      budget: 0,
      spent: 0,
      executionRate: 0,
      departments: [{ id: 'dept-3', name: '찬양부', budget: 500000, spent: 100000, executionRate: 20 }],
    },
  ],
};

describe('DepartmentBudgetPanel', () => {
  beforeEach(() => {
    (global.fetch as Mock).mockReset();
  });

  it('로딩 중에는 스켈레톤을 표시한다', () => {
    (global.fetch as Mock).mockReturnValue(new Promise(() => {}));
    const { container } = render(<DepartmentBudgetPanel />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('위원회를 가로질러 부서별 집행률을 렌더링한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => BUDGET_EXECUTION_RESPONSE,
    });

    render(<DepartmentBudgetPanel />);

    await waitFor(() => expect(screen.getByText('전도부')).toBeInTheDocument());
    expect(screen.getByText('교육부')).toBeInTheDocument();
    expect(screen.getByText('찬양부')).toBeInTheDocument();
  });

  it('90% 이상 부서가 있으면 경고 배너를 표시한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => BUDGET_EXECUTION_RESPONSE,
    });

    render(<DepartmentBudgetPanel />);

    await waitFor(() =>
      expect(screen.getByText('⚠ 전도부 예산 90% 초과')).toBeInTheDocument()
    );
    expect(screen.queryByText('⚠ 교육부 예산 90% 초과')).not.toBeInTheDocument();
  });

  it('90% 이상 부서가 없으면 경고 배너를 표시하지 않는다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...BUDGET_EXECUTION_RESPONSE,
        committees: BUDGET_EXECUTION_RESPONSE.committees.map((c) => ({
          ...c,
          departments: c.departments.map((d) => ({ ...d, executionRate: 50 })),
        })),
      }),
    });

    render(<DepartmentBudgetPanel />);

    await waitFor(() => expect(screen.getByText('전도부')).toBeInTheDocument());
    expect(screen.queryByText(/예산 90% 초과/)).not.toBeInTheDocument();
  });

  it('부서가 0곳이면 배너 없이 안내 문구를 표시한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ...BUDGET_EXECUTION_RESPONSE, committees: [] }),
    });

    render(<DepartmentBudgetPanel />);

    await waitFor(() =>
      expect(screen.getByText('부서별 예산 데이터가 없습니다.')).toBeInTheDocument()
    );
    expect(screen.queryByText(/예산 90% 초과/)).not.toBeInTheDocument();
  });

  it('API 실패 시 한글 에러 문구를 표시한다', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: '서버 오류' }),
    });

    render(<DepartmentBudgetPanel />);

    await waitFor(() =>
      expect(screen.getByText('부서별 예산 집행 현황을 불러오지 못했습니다.')).toBeInTheDocument()
    );
  });
});
