import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecurringExpenseStatus } from '../RecurringExpenseStatus';

describe('RecurringExpenseStatus', () => {
  it('ACTIVE 상태는 녹색 배지로 "활성" 표시', () => {
    render(<RecurringExpenseStatus status="ACTIVE" />);

    const badge = screen.getByText('활성');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100', 'text-green-700');
  });

  it('PAUSED 상태는 노란색 배지로 "일시정지" 표시', () => {
    render(<RecurringExpenseStatus status="PAUSED" />);

    const badge = screen.getByText('일시정지');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-700');
  });

  it('COMPLETED 상태는 회색 배지로 "완료" 표시', () => {
    render(<RecurringExpenseStatus status="COMPLETED" />);

    const badge = screen.getByText('완료');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-600');
  });

  it('CANCELLED 상태는 빨간색 배지로 "취소" 표시', () => {
    render(<RecurringExpenseStatus status="CANCELLED" />);

    const badge = screen.getByText('취소');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('알 수 없는 상태는 기본 배지로 "-" 표시', () => {
    render(<RecurringExpenseStatus status="UNKNOWN" />);

    const badge = screen.getByText('-');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-500');
  });

  it('status가 undefined면 기본 배지로 "-" 표시', () => {
    render(<RecurringExpenseStatus status={undefined} />);

    const badge = screen.getByText('-');
    expect(badge).toBeInTheDocument();
  });
});
