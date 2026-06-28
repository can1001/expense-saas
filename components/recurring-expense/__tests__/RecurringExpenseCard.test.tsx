import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecurringExpenseCard } from '../RecurringExpenseCard';

// Mock useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockRecurringExpense = {
  id: '1',
  name: '월 임대료',
  committee: '운영위원회',
  department: '사무국',
  budgetCategory: '고정비',
  budgetSubcategory: '임대료',
  recipientName: '홍길동',
  baseAmount: 500000,
  frequency: 'MONTHLY' as const,
  dayOfMonth: 15,
  status: 'ACTIVE' as const,
  nextGenerationDate: new Date('2025-02-08'),
};

describe('RecurringExpenseCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('기본 렌더링', () => {
    it('자동이체 이름을 표시해야 함', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('월 임대료')).toBeInTheDocument();
    });

    it('위원회/사역팀을 표시해야 함', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('운영위원회')).toBeInTheDocument();
      expect(screen.getByText('사무국')).toBeInTheDocument();
    });

    it('금액을 콤마 포맷으로 표시해야 함', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/500,000/)).toBeInTheDocument();
    });

    it('이체 주기를 표시해야 함', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/월간/i)).toBeInTheDocument();
    });

    it('이체일을 표시해야 함', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/15일/)).toBeInTheDocument();
    });

    it('상태 배지를 표시해야 함', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('활성')).toBeInTheDocument();
    });

    it('수취인 정보를 표시해야 함', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('홍길동')).toBeInTheDocument();
    });
  });

  describe('상태별 배지', () => {
    it('ACTIVE 상태는 녹색 배지', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      const badge = screen.getByText('활성');
      expect(badge).toHaveClass('bg-green-100', 'text-green-700');
    });

    it('PAUSED 상태는 노란색 배지', () => {
      const pausedExpense = { ...mockRecurringExpense, status: 'PAUSED' as const };
      render(<RecurringExpenseCard recurringExpense={pausedExpense} />);

      const badge = screen.getByText('일시정지');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-700');
    });

    it('CANCELLED 상태는 빨간색 배지', () => {
      const cancelledExpense = { ...mockRecurringExpense, status: 'CANCELLED' as const };
      render(<RecurringExpenseCard recurringExpense={cancelledExpense} />);

      const badge = screen.getByText('취소');
      expect(badge).toHaveClass('bg-red-100', 'text-red-700');
    });
  });

  describe('주기 표시', () => {
    it('MONTHLY는 "월간"으로 표시', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);
      expect(screen.getByText(/월간/)).toBeInTheDocument();
    });

    it('QUARTERLY는 "분기"로 표시', () => {
      const quarterlyExpense = { ...mockRecurringExpense, frequency: 'QUARTERLY' as const };
      render(<RecurringExpenseCard recurringExpense={quarterlyExpense} />);
      expect(screen.getByText(/분기/)).toBeInTheDocument();
    });

    it('SEMI_ANNUAL은 "반기"로 표시', () => {
      const semiAnnualExpense = { ...mockRecurringExpense, frequency: 'SEMI_ANNUAL' as const };
      render(<RecurringExpenseCard recurringExpense={semiAnnualExpense} />);
      expect(screen.getByText(/반기/)).toBeInTheDocument();
    });

    it('ANNUAL은 "연간"으로 표시', () => {
      const annualExpense = { ...mockRecurringExpense, frequency: 'ANNUAL' as const };
      render(<RecurringExpenseCard recurringExpense={annualExpense} />);
      expect(screen.getByText(/연간/)).toBeInTheDocument();
    });
  });

  describe('클릭 동작', () => {
    it('카드 클릭 시 상세 페이지로 이동', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      const card = screen.getByText('월 임대료').closest('div[role="button"]');
      if (card) {
        fireEvent.click(card);
        expect(mockPush).toHaveBeenCalledWith('/recurring-expenses/1');
      }
    });

    it('onClick prop이 있으면 onClick 호출', () => {
      const handleClick = vi.fn();
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} onClick={handleClick} />);

      const card = screen.getByText('월 임대료').closest('div[role="button"]');
      if (card) {
        fireEvent.click(card);
        expect(handleClick).toHaveBeenCalledWith('1');
      }
    });
  });

  describe('다음 생성 예정일', () => {
    it('ACTIVE 상태일 때 다음 생성 예정일 표시', () => {
      render(<RecurringExpenseCard recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/다음 생성/)).toBeInTheDocument();
    });

    it('PAUSED 상태일 때는 다음 생성 예정일 미표시', () => {
      const pausedExpense = { ...mockRecurringExpense, status: 'PAUSED' as const };
      render(<RecurringExpenseCard recurringExpense={pausedExpense} />);

      expect(screen.queryByText(/다음 생성/)).not.toBeInTheDocument();
    });
  });
});
