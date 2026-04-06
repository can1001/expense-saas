/**
 * PrintItems 컴포넌트 테스트
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrintItems from '../PrintItems';
import { ExpenseItem } from '../types';

// 테스트용 아이템 데이터
const mockItems: ExpenseItem[] = [
  {
    id: 'item-1',
    expenseId: 'expense-1',
    budgetCategory: '사무행정비',
    budgetSubcategory: '회의및접대비',
    budgetDetail: '다과비',
    description: '3/15 팀 회의 다과',
    unitPrice: 5000,
    quantity: 10,
    amount: 50000,
    order: 1,
    createdAt: new Date(),
  },
  {
    id: 'item-2',
    expenseId: 'expense-1',
    budgetCategory: '사무행정비',
    budgetSubcategory: '사무용품비',
    budgetDetail: '복사용지',
    description: 'A4 용지 구매',
    unitPrice: 25000,
    quantity: 2,
    amount: 50000,
    order: 2,
    createdAt: new Date(),
  },
];

describe('PrintItems', () => {
  describe('기본 렌더링', () => {
    it('안내 문구가 표시되어야 함', () => {
      render(<PrintItems items={mockItems} totalAmount={100000} />);

      expect(screen.getByText(/아래 예시 참조하여/)).toBeInTheDocument();
    });

    it('예시 행이 표시되어야 함', () => {
      render(<PrintItems items={mockItems} totalAmount={100000} />);

      expect(screen.getByText('행사비(리더세미나)')).toBeInTheDocument();
      expect(screen.getByText('2/8 유치부 교사 성경학교 준비 다과비')).toBeInTheDocument();
    });

    it('테이블 헤더가 올바르게 표시되어야 함', () => {
      render(<PrintItems items={mockItems} totalAmount={100000} />);

      expect(screen.getByText('순번')).toBeInTheDocument();
      expect(screen.getByText('세 목')).toBeInTheDocument();
      expect(screen.getByText('적 요')).toBeInTheDocument();
      expect(screen.getByText('단 가')).toBeInTheDocument();
      expect(screen.getByText('수량')).toBeInTheDocument();
      expect(screen.getByText('금 액')).toBeInTheDocument();
    });
  });

  describe('아이템 렌더링', () => {
    it('아이템들이 올바르게 표시되어야 함', () => {
      render(<PrintItems items={mockItems} totalAmount={100000} />);

      // 첫 번째 아이템
      expect(screen.getByText('다과비')).toBeInTheDocument();
      expect(screen.getByText('3/15 팀 회의 다과')).toBeInTheDocument();
      expect(screen.getByText('5,000')).toBeInTheDocument();

      // 두 번째 아이템
      expect(screen.getByText('복사용지')).toBeInTheDocument();
      expect(screen.getByText('A4 용지 구매')).toBeInTheDocument();
      expect(screen.getByText('25,000')).toBeInTheDocument();
    });

    it('순번이 1부터 시작해야 함', () => {
      render(<PrintItems items={mockItems} totalAmount={100000} />);

      const cells = screen.getAllByRole('cell');
      // 첫 번째 행의 첫 번째 셀이 "1"
      expect(cells[0]).toHaveTextContent('1');
    });

    it('빈 아이템 배열일 때도 렌더링되어야 함', () => {
      render(<PrintItems items={[]} totalAmount={0} />);

      expect(screen.getByText('순번')).toBeInTheDocument();
      expect(screen.getByText('합 계')).toBeInTheDocument();
    });
  });

  describe('빈 행 처리', () => {
    it('아이템이 12개 미만일 때 빈 행으로 채워야 함', () => {
      render(<PrintItems items={mockItems} totalAmount={100000} />);

      // 2개 아이템 + 10개 빈 행 = 12개 tbody 행
      const tbody = screen.getAllByRole('rowgroup')[1]; // tbody
      const rows = tbody.querySelectorAll('tr');
      expect(rows.length).toBe(12);
    });

    it('아이템이 12개일 때 빈 행이 없어야 함', () => {
      const twelveItems: ExpenseItem[] = Array.from({ length: 12 }, (_, i) => ({
        id: `item-${i}`,
        expenseId: 'expense-1',
        budgetCategory: '테스트',
        budgetSubcategory: '테스트',
        budgetDetail: `세목${i}`,
        description: `설명${i}`,
        unitPrice: 1000,
        quantity: 1,
        amount: 1000,
        order: i + 1,
        createdAt: new Date(),
      }));

      render(<PrintItems items={twelveItems} totalAmount={12000} />);

      const tbody = screen.getAllByRole('rowgroup')[1];
      const rows = tbody.querySelectorAll('tr');
      expect(rows.length).toBe(12);

      // 빈 행(&nbsp;)이 없어야 함
      const emptyRows = tbody.querySelectorAll('tr.empty-row');
      expect(emptyRows.length).toBe(0);
    });
  });

  describe('합계 표시', () => {
    it('합계 금액이 올바르게 포맷되어 표시되어야 함', () => {
      render(<PrintItems items={mockItems} totalAmount={100000} />);

      expect(screen.getByText('합 계')).toBeInTheDocument();
      expect(screen.getByText('100,000')).toBeInTheDocument();
    });

    it('큰 금액도 올바르게 포맷되어야 함', () => {
      render(<PrintItems items={mockItems} totalAmount={12345678} />);

      expect(screen.getByText('12,345,678')).toBeInTheDocument();
    });

    it('0원도 올바르게 표시되어야 함', () => {
      render(<PrintItems items={[]} totalAmount={0} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});
