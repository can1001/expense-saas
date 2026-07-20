import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReceiptGallery, { ReceiptItem } from '../ReceiptGallery';

const mockReceipts: ReceiptItem[] = [
  {
    id: 'att-1',
    url: 'https://res.cloudinary.com/demo/image/upload/receipt1.jpg',
    secureUrl: 'https://res.cloudinary.com/demo/image/upload/receipt1.jpg',
    fileName: 'receipt1.jpg',
    format: 'jpg',
    expenseId: 'expense-12345678',
    department: '사무국',
    committee: '운영위원회',
    requestAmount: 50000,
    status: 'APPROVED_FINAL',
    applicantName: '홍길동',
    requestDate: '2026-07-01',
  },
];

describe('ReceiptGallery', () => {
  it('영수증이 없으면 빈 상태 메시지를 표시해야 함', () => {
    render(<ReceiptGallery receipts={[]} />);
    expect(screen.getByText('해당 조건의 영수증이 없습니다.')).toBeInTheDocument();
  });

  it('영수증 썸네일과 메타 정보를 표시해야 함', () => {
    render(<ReceiptGallery receipts={mockReceipts} />);
    expect(screen.getByText('사무국')).toBeInTheDocument();
    expect(screen.getByText(/50,000/)).toBeInTheDocument();
    expect(screen.getByText('최종승인')).toBeInTheDocument();
  });

  it('썸네일 클릭 시 원본 모달과 "원본 열기" 링크를 표시해야 함', () => {
    render(<ReceiptGallery receipts={mockReceipts} />);
    fireEvent.click(screen.getByRole('button'));

    const openLink = screen.getByRole('link', { name: '원본 열기' });
    expect(openLink).toHaveAttribute('href', mockReceipts[0].secureUrl);
  });

  it('모달 닫기 버튼 클릭 시 모달이 닫혀야 함', () => {
    render(<ReceiptGallery receipts={mockReceipts} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('link', { name: '원본 열기' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('link', { name: '원본 열기' })).not.toBeInTheDocument();
  });
});
