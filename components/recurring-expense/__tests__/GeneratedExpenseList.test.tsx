import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GeneratedExpenseList } from '../GeneratedExpenseList';

describe('GeneratedExpenseList', () => {
  const mockExpenses = [
    {
      id: '1',
      requestAmount: 500000,
      status: 'APPROVED',
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      requestAmount: 300000,
      status: 'PENDING',
      createdAt: '2024-01-10T10:00:00Z',
    },
    {
      id: '3',
      requestAmount: 200000,
      status: 'DRAFT',
      createdAt: '2024-01-05T10:00:00Z',
    },
  ];

  describe('렌더링', () => {
    it('지출결의서 목록이 표시되어야 함', () => {
      render(<GeneratedExpenseList expenses={mockExpenses} />);

      expect(screen.getByText('생성 이력')).toBeInTheDocument();
      expect(screen.getByText(/500,000/)).toBeInTheDocument();
      expect(screen.getByText(/300,000/)).toBeInTheDocument();
      expect(screen.getByText(/200,000/)).toBeInTheDocument();
    });

    it('상태 배지가 표시되어야 함', () => {
      render(<GeneratedExpenseList expenses={mockExpenses} />);

      expect(screen.getByText('승인')).toBeInTheDocument();
      expect(screen.getByText('결재대기')).toBeInTheDocument();
      expect(screen.getByText('임시저장')).toBeInTheDocument();
    });

    it('날짜가 표시되어야 함', () => {
      render(<GeneratedExpenseList expenses={mockExpenses} />);

      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
      expect(screen.getByText('2024-01-10')).toBeInTheDocument();
      expect(screen.getByText('2024-01-05')).toBeInTheDocument();
    });

    it('빈 목록일 때 안내 메시지가 표시되어야 함', () => {
      render(<GeneratedExpenseList expenses={[]} />);

      expect(screen.getByText('생성된 지출결의서가 없습니다.')).toBeInTheDocument();
    });
  });

  describe('링크', () => {
    it('각 항목이 지출결의서 상세 페이지로 연결되어야 함', () => {
      render(<GeneratedExpenseList expenses={mockExpenses} />);

      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveAttribute('href', '/expenses/1');
      expect(links[1]).toHaveAttribute('href', '/expenses/2');
      expect(links[2]).toHaveAttribute('href', '/expenses/3');
    });
  });

  describe('상태 배지 색상', () => {
    it('APPROVED 상태는 초록색 배지여야 함', () => {
      render(<GeneratedExpenseList expenses={[mockExpenses[0]]} />);

      const badge = screen.getByText('승인');
      expect(badge).toHaveClass('bg-green-100', 'text-green-700');
    });

    it('PENDING 상태는 노란색 배지여야 함', () => {
      render(<GeneratedExpenseList expenses={[mockExpenses[1]]} />);

      const badge = screen.getByText('결재대기');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-700');
    });

    it('DRAFT 상태는 회색 배지여야 함', () => {
      render(<GeneratedExpenseList expenses={[mockExpenses[2]]} />);

      const badge = screen.getByText('임시저장');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
    });

    it('REJECTED 상태는 빨간색 배지여야 함', () => {
      const rejectedExpense = { ...mockExpenses[0], status: 'REJECTED' };
      render(<GeneratedExpenseList expenses={[rejectedExpense]} />);

      const badge = screen.getByText('반려');
      expect(badge).toHaveClass('bg-red-100', 'text-red-700');
    });
  });

  describe('5건 이상일 때', () => {
    it('건수 표시가 나타나야 함', () => {
      const manyExpenses = Array.from({ length: 5 }, (_, i) => ({
        id: String(i + 1),
        requestAmount: 100000 * (i + 1),
        status: 'APPROVED',
        createdAt: `2024-01-${String(15 - i).padStart(2, '0')}T10:00:00Z`,
      }));

      render(<GeneratedExpenseList expenses={manyExpenses} />);

      expect(screen.getByText('최근 5건')).toBeInTheDocument();
    });

    it('5건 미만일 때 건수 표시가 없어야 함', () => {
      render(<GeneratedExpenseList expenses={mockExpenses} />);

      expect(screen.queryByText(/최근 \d건/)).not.toBeInTheDocument();
    });
  });
});
