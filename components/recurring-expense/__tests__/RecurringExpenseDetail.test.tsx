import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecurringExpenseDetail } from '../RecurringExpenseDetail';

// Mock useRouter
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

const mockRecurringExpense = {
  id: '1',
  name: '월 임대료',
  description: '사무실 임대료',
  committee: '운영위원회',
  department: '사무국',
  budgetCategory: '고정비',
  budgetSubcategory: '임대료',
  budgetDetail: '사무실',
  recipientName: '홍길동',
  bankName: '국민은행',
  accountNumber: '1234567890',
  baseAmount: 500000,
  frequency: 'MONTHLY' as const,
  dayOfMonth: 15,
  status: 'ACTIVE' as const,
  startDate: new Date('2025-01-01'),
  endDate: null,
  advanceDays: 7,
  nextGenerationDate: new Date('2025-02-08'),
  lastGeneratedDate: new Date('2025-01-08'),
  createdAt: new Date('2024-12-01'),
  updatedAt: new Date('2024-12-15'),
};

describe('RecurringExpenseDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('기본 정보 표시', () => {
    it('자동이체 이름을 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('월 임대료')).toBeInTheDocument();
    });

    it('설명을 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('사무실 임대료')).toBeInTheDocument();
    });

    it('상태 배지를 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('활성')).toBeInTheDocument();
    });
  });

  describe('예산 정보 표시', () => {
    it('위원회를 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('운영위원회')).toBeInTheDocument();
    });

    it('사역팀/부를 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('사무국')).toBeInTheDocument();
    });

    it('예산 항목을 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('고정비')).toBeInTheDocument();
      expect(screen.getByText('임대료')).toBeInTheDocument();
    });
  });

  describe('수취인 정보 표시', () => {
    it('수취인명을 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('홍길동')).toBeInTheDocument();
    });

    it('은행명을 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('국민은행')).toBeInTheDocument();
    });

    it('계좌번호를 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('1234567890')).toBeInTheDocument();
    });
  });

  describe('이체 정보 표시', () => {
    it('금액을 콤마 포맷으로 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/500,000/)).toBeInTheDocument();
    });

    it('이체 주기를 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/월간/)).toBeInTheDocument();
    });

    it('이체일을 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/15일/)).toBeInTheDocument();
    });

    it('사전 생성일을 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/7일 전/)).toBeInTheDocument();
    });
  });

  describe('기간 정보 표시', () => {
    it('시작일을 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/2025-01-01/)).toBeInTheDocument();
    });

    it('종료일이 없으면 "무기한"으로 표시', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText('무기한')).toBeInTheDocument();
    });

    it('종료일이 있으면 종료일 표시', () => {
      const expenseWithEndDate = {
        ...mockRecurringExpense,
        endDate: new Date('2025-12-31'),
      };
      render(<RecurringExpenseDetail recurringExpense={expenseWithEndDate} />);

      expect(screen.getByText(/2025-12-31/)).toBeInTheDocument();
    });
  });

  describe('액션 버튼', () => {
    it('수정 버튼을 표시해야 함', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByRole('button', { name: /수정/i })).toBeInTheDocument();
    });

    it('수정 버튼 클릭 시 수정 페이지로 이동', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      fireEvent.click(screen.getByRole('button', { name: /수정/i }));

      expect(mockPush).toHaveBeenCalledWith('/recurring-expenses/1/edit');
    });

    it('ACTIVE 상태일 때 일시정지 버튼 표시', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByRole('button', { name: /일시정지/i })).toBeInTheDocument();
    });

    it('PAUSED 상태일 때 재개 버튼 표시', () => {
      const pausedExpense = { ...mockRecurringExpense, status: 'PAUSED' as const };
      render(<RecurringExpenseDetail recurringExpense={pausedExpense} />);

      expect(screen.getByRole('button', { name: /재개/i })).toBeInTheDocument();
    });

    it('CANCELLED/COMPLETED 상태일 때는 상태 변경 버튼 미표시', () => {
      const cancelledExpense = { ...mockRecurringExpense, status: 'CANCELLED' as const };
      render(<RecurringExpenseDetail recurringExpense={cancelledExpense} />);

      expect(screen.queryByRole('button', { name: /일시정지/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /재개/i })).not.toBeInTheDocument();
    });
  });

  describe('상태 변경', () => {
    it('일시정지 버튼 클릭 시 onStatusChange 호출', async () => {
      const handleStatusChange = vi.fn().mockResolvedValue(undefined);
      render(
        <RecurringExpenseDetail
          recurringExpense={mockRecurringExpense}
          onStatusChange={handleStatusChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /일시정지/i }));

      await waitFor(() => {
        expect(handleStatusChange).toHaveBeenCalledWith('PAUSED');
      });
    });

    it('재개 버튼 클릭 시 onStatusChange 호출', async () => {
      const handleStatusChange = vi.fn().mockResolvedValue(undefined);
      const pausedExpense = { ...mockRecurringExpense, status: 'PAUSED' as const };
      render(
        <RecurringExpenseDetail
          recurringExpense={pausedExpense}
          onStatusChange={handleStatusChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /재개/i }));

      await waitFor(() => {
        expect(handleStatusChange).toHaveBeenCalledWith('ACTIVE');
      });
    });
  });

  describe('다음 생성 예정일', () => {
    it('ACTIVE 상태일 때 다음 생성 예정일 표시', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/2025-02-08/)).toBeInTheDocument();
    });

    it('마지막 생성일 표시', () => {
      render(<RecurringExpenseDetail recurringExpense={mockRecurringExpense} />);

      expect(screen.getByText(/2025-01-08/)).toBeInTheDocument();
    });
  });
});
