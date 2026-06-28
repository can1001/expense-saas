import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: '작업 확인',
    message: '정말 진행하시겠습니까?',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('렌더링', () => {
    it('isOpen이 true일 때 다이얼로그가 표시되어야 함', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText('작업 확인')).toBeInTheDocument();
      expect(screen.getByText('정말 진행하시겠습니까?')).toBeInTheDocument();
    });

    it('isOpen이 false일 때 다이얼로그가 표시되지 않아야 함', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('기본 버튼 텍스트가 표시되어야 함', () => {
      render(<ConfirmDialog {...defaultProps} />);

      // 버튼 영역에서 확인/취소 버튼 찾기
      const buttons = screen.getAllByRole('button');
      const buttonTexts = buttons.map(b => b.textContent);
      expect(buttonTexts).toContain('확인');
      expect(buttonTexts).toContain('취소');
    });

    it('커스텀 버튼 텍스트가 표시되어야 함', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          confirmText="삭제하기"
          cancelText="돌아가기"
        />
      );

      expect(screen.getByText('삭제하기')).toBeInTheDocument();
      expect(screen.getByText('돌아가기')).toBeInTheDocument();
    });
  });

  describe('variant', () => {
    it('warning variant일 때 노란색 아이콘이 표시되어야 함', () => {
      render(<ConfirmDialog {...defaultProps} variant="warning" />);

      const iconContainer = screen.getByRole('alertdialog').querySelector('.bg-yellow-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('danger variant일 때 빨간색 아이콘이 표시되어야 함', () => {
      render(<ConfirmDialog {...defaultProps} variant="danger" />);

      const iconContainer = screen.getByRole('alertdialog').querySelector('.bg-red-100');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('상호작용', () => {
    it('확인 버튼 클릭 시 onConfirm이 호출되어야 함', async () => {
      const user = userEvent.setup();
      render(<ConfirmDialog {...defaultProps} confirmText="확인하기" />);

      await user.click(screen.getByText('확인하기'));

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('취소 버튼 클릭 시 onClose가 호출되어야 함', async () => {
      const user = userEvent.setup();
      render(<ConfirmDialog {...defaultProps} />);

      await user.click(screen.getByText('취소'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('오버레이 클릭 시 onClose가 호출되어야 함', async () => {
      render(<ConfirmDialog {...defaultProps} />);

      // 오버레이는 MODAL_OVERLAY 클래스를 가진 div
      const overlay = screen.getByRole('alertdialog').parentElement;
      fireEvent.click(overlay!);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('다이얼로그 내부 클릭 시 onClose가 호출되지 않아야 함', async () => {
      const user = userEvent.setup();
      render(<ConfirmDialog {...defaultProps} />);

      const dialog = screen.getByRole('alertdialog');
      await user.click(dialog);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('X 버튼 클릭 시 onClose가 호출되어야 함', async () => {
      const user = userEvent.setup();
      render(<ConfirmDialog {...defaultProps} />);

      // X 버튼은 svg를 포함한 button
      const closeButton = screen.getByRole('alertdialog').querySelector('button');
      await user.click(closeButton!);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('ESC 키 누르면 onClose가 호출되어야 함', async () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('로딩 상태', () => {
    it('isLoading이 true일 때 로딩 표시가 나타나야 함', () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      expect(screen.getByText('처리 중...')).toBeInTheDocument();
    });

    it('isLoading이 true일 때 버튼이 비활성화되어야 함', () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} confirmText="확인하기" />);

      const confirmButton = screen.getByText('처리 중...').closest('button');
      const cancelButton = screen.getByText('취소').closest('button');

      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it('isLoading이 true일 때 ESC 키가 작동하지 않아야 함', () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('isLoading이 true일 때 오버레이 클릭이 작동하지 않아야 함', () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      const overlay = screen.getByRole('alertdialog').parentElement;
      fireEvent.click(overlay!);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('접근성', () => {
    it('alertdialog role이 있어야 함', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('aria-modal이 true여야 함', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('aria-labelledby가 제목을 참조해야 함', () => {
      render(<ConfirmDialog {...defaultProps} />);

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-dialog-title');
    });

    it('aria-describedby가 메시지를 참조해야 함', () => {
      render(<ConfirmDialog {...defaultProps} />);

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'confirm-dialog-message');
    });
  });
});
