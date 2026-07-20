import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MissingReceiptList, { MissingReceiptExpense } from '../MissingReceiptList';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockExpenses: MissingReceiptExpense[] = [
  {
    expenseId: 'expense-1',
    applicantName: '홍길동',
    department: '사무국',
    committee: '운영위원회',
    requestAmount: 30000,
    status: 'PENDING',
    requestDate: '2026-07-05',
  },
];

describe('MissingReceiptList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('미첨부 결의서가 없으면 빈 상태 메시지를 표시해야 함', () => {
    render(<MissingReceiptList expenses={[]} />);
    expect(screen.getByText('해당 조건의 미첨부 결의서가 없습니다.')).toBeInTheDocument();
  });

  it('신청자·부서·금액·상태·작성일을 표시해야 함', () => {
    render(<MissingReceiptList expenses={mockExpenses} />);
    expect(screen.getByText(/홍길동/)).toBeInTheDocument();
    expect(screen.getByText(/사무국/)).toBeInTheDocument();
    expect(screen.getByText(/30,000/)).toBeInTheDocument();
    expect(screen.getByText('1차 결재대기')).toBeInTheDocument();
    expect(screen.getByText('2026-07-05')).toBeInTheDocument();
  });

  it('행 클릭 시 결의서 상세 페이지로 이동해야 함', () => {
    render(<MissingReceiptList expenses={mockExpenses} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockPush).toHaveBeenCalledWith('/expenses/expense-1');
  });
});
