/**
 * ExpenseCard 컴포넌트 테스트
 *
 * 테스트 대상:
 * - 첨부파일 썸네일 표시
 * - 위원회/사역팀 두 줄 표시
 * - 기본 렌더링
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExpenseCard from '../ExpenseCard';
import { ExpenseListItem } from '@/lib/types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('ExpenseCard', () => {
  const mockOnSelect = vi.fn();
  const mockOnClick = vi.fn();

  const baseExpense: ExpenseListItem = {
    id: 'expense-1',
    committee: '선교위원회',
    department: '청년부',
    requestAmount: 150000,
    applicantName: '홍길동',
    requestDate: '2026-04-05',
    createdAt: '2026-04-05',
    status: 'APPROVED_FINAL',
    paymentStatus: 'PENDING',
    items: [
      {
        id: 'item-1',
        expenseId: 'expense-1',
        budgetCategory: '선교비',
        budgetSubcategory: '국내선교비',
        budgetDetail: '교통비',
        description: '출장 교통비',
        unitPrice: 150000,
        quantity: 1,
        amount: 150000,
        order: 1,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('기본 렌더링', () => {
    it('청구인 이름이 표시된다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('홍길동')).toBeInTheDocument();
    });

    it('청구금액이 표시된다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      // 150,000원 형식으로 표시
      expect(screen.getByText(/150,000/)).toBeInTheDocument();
    });

    it('결재상태 배지가 표시된다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('최종승인')).toBeInTheDocument();
    });
  });

  describe('위원회/사역팀 표시', () => {
    it('위원회가 표시된다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('선교위원회')).toBeInTheDocument();
    });

    it('사역팀(부)이 표시된다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('청년부')).toBeInTheDocument();
    });
  });

  describe('첨부파일 썸네일 표시', () => {
    it('첨부파일이 있으면 썸네일 이미지를 표시한다', () => {
      const expenseWithAttachment: ExpenseListItem = {
        ...baseExpense,
        attachments: [
          {
            id: 'attachment-1',
            secureUrl: 'https://example.com/image1.jpg',
            format: 'jpg',
          },
        ],
      };

      render(
        <ExpenseCard
          expense={expenseWithAttachment}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      const thumbnail = screen.getByAltText('첨부');
      expect(thumbnail).toBeInTheDocument();
      expect(thumbnail).toHaveAttribute('src', 'https://example.com/image1.jpg');
    });

    it('첨부파일이 없으면 썸네일을 표시하지 않는다', () => {
      const expenseWithoutAttachment: ExpenseListItem = {
        ...baseExpense,
        attachments: undefined,
      };

      render(
        <ExpenseCard
          expense={expenseWithoutAttachment}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.queryByAltText('첨부')).not.toBeInTheDocument();
    });

    it('첨부파일 배열이 비어있으면 썸네일을 표시하지 않는다', () => {
      const expenseWithEmptyAttachments: ExpenseListItem = {
        ...baseExpense,
        attachments: [],
      };

      render(
        <ExpenseCard
          expense={expenseWithEmptyAttachments}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.queryByAltText('첨부')).not.toBeInTheDocument();
    });
  });

  describe('예산 정보 표시', () => {
    it('예산 카테고리가 표시된다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('선교비')).toBeInTheDocument();
    });

    it('예산 서브카테고리가 표시된다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText(/국내선교비/)).toBeInTheDocument();
    });

    it('예산 세목이 표시된다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      // '교통비'는 budgetDetail과 description에 모두 존재하므로 getAllByText 사용
      const elements = screen.getAllByText(/교통비/);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('선택 상태', () => {
    it('선택되지 않은 상태에서 체크박스가 unchecked 상태다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('선택된 상태에서 체크박스가 checked 상태다', () => {
      render(
        <ExpenseCard
          expense={baseExpense}
          isSelected={true}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });
  });

  describe('결재/지급 상태에 따른 표시', () => {
    it('DRAFT 상태는 "임시저장" 배지를 표시한다', () => {
      const draftExpense: ExpenseListItem = {
        ...baseExpense,
        status: 'DRAFT',
      };

      render(
        <ExpenseCard
          expense={draftExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('임시저장')).toBeInTheDocument();
    });

    it('PENDING 상태는 "결재대기" 배지를 표시한다', () => {
      const pendingExpense: ExpenseListItem = {
        ...baseExpense,
        status: 'PENDING',
      };

      render(
        <ExpenseCard
          expense={pendingExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('결재대기')).toBeInTheDocument();
    });

    it('최종승인 + 지급완료 상태 표시', () => {
      const completedExpense: ExpenseListItem = {
        ...baseExpense,
        status: 'APPROVED_FINAL',
        paymentStatus: 'COMPLETED',
      };

      render(
        <ExpenseCard
          expense={completedExpense}
          isSelected={false}
          onSelect={mockOnSelect}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('최종승인')).toBeInTheDocument();
      expect(screen.getByText('지급완료')).toBeInTheDocument();
    });
  });
});
