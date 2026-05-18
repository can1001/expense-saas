import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecurringExpenseForm } from '../RecurringExpenseForm';

// Mock BudgetSelector
vi.mock('@/components/BudgetSelector', () => ({
  default: ({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) => (
    <div data-testid="budget-selector">
      <button
        type="button"
        onClick={() => onChange({
          committee: '운영위원회',
          department: '사무국',
          category: '인건비',
          subcategory: '급여',
          detail: '월급',
        })}
      >
        예산 선택
      </button>
      <span>{value.committee || '선택안됨'}</span>
    </div>
  ),
}));

// Mock useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('RecurringExpenseForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('필드 렌더링', () => {
    it('자동이체 이름 필드를 표시해야 함', () => {
      render(<RecurringExpenseForm />);

      expect(screen.getByLabelText(/자동이체 이름/i)).toBeInTheDocument();
    });

    it('예산 선택 필드를 표시해야 함', () => {
      render(<RecurringExpenseForm />);

      expect(screen.getByTestId('budget-selector')).toBeInTheDocument();
    });

    it('수취인 정보 필드들을 표시해야 함', () => {
      render(<RecurringExpenseForm />);

      expect(screen.getByLabelText(/수취인/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/은행명/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/계좌번호/i)).toBeInTheDocument();
    });

    it('금액 필드를 표시해야 함', () => {
      render(<RecurringExpenseForm />);

      expect(screen.getByLabelText(/기본 금액/i)).toBeInTheDocument();
    });

    it('주기 선택 필드를 표시해야 함', () => {
      render(<RecurringExpenseForm />);

      expect(screen.getByLabelText(/이체 주기/i)).toBeInTheDocument();
    });

    it('이체일 필드를 표시해야 함', () => {
      render(<RecurringExpenseForm />);

      expect(screen.getByLabelText(/이체일/i)).toBeInTheDocument();
    });

    it('시작일 필드를 표시해야 함', () => {
      render(<RecurringExpenseForm />);

      expect(screen.getByLabelText(/시작일/i)).toBeInTheDocument();
    });

    it('종료일 필드를 표시해야 함 (선택사항)', () => {
      render(<RecurringExpenseForm />);

      expect(screen.getByLabelText(/종료일/i)).toBeInTheDocument();
    });

    it('등록 버튼을 표시해야 함', () => {
      render(<RecurringExpenseForm />);

      expect(screen.getByRole('button', { name: /등록/i })).toBeInTheDocument();
    });
  });

  describe('금액 입력', () => {
    it('금액 입력 시 콤마 포맷을 적용해야 함', async () => {
      render(<RecurringExpenseForm />);

      const amountInput = screen.getByLabelText(/기본 금액/i);
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '1000000');

      expect(amountInput).toHaveValue('1,000,000');
    });

    it('비숫자 입력은 무시해야 함', async () => {
      render(<RecurringExpenseForm />);

      const amountInput = screen.getByLabelText(/기본 금액/i);
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, 'abc123def');

      expect(amountInput).toHaveValue('123');
    });
  });

  describe('폼 검증', () => {
    it('필수 필드 없이 제출 시 에러 표시', async () => {
      render(<RecurringExpenseForm />);

      const submitButton = screen.getByRole('button', { name: /등록/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/자동이체 이름을 입력해주세요/i)).toBeInTheDocument();
      });
    });

    it('예산 미선택 시 에러 표시', async () => {
      render(<RecurringExpenseForm />);

      const nameInput = screen.getByLabelText(/자동이체 이름/i);
      await userEvent.type(nameInput, '월 임대료');

      const submitButton = screen.getByRole('button', { name: /등록/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/위원회를 선택해주세요/i)).toBeInTheDocument();
      });
    });
  });

  describe('폼 제출', () => {
    it('유효한 폼 제출 시 API 호출', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1' }),
      });

      render(<RecurringExpenseForm />);

      // 필수 필드 입력
      await userEvent.type(screen.getByLabelText(/자동이체 이름/i), '월 임대료');

      // 예산 선택
      fireEvent.click(screen.getByText('예산 선택'));

      // 수취인 정보
      await userEvent.type(screen.getByLabelText(/수취인/i), '홍길동');
      await userEvent.type(screen.getByLabelText(/은행명/i), '국민은행');
      await userEvent.type(screen.getByLabelText(/계좌번호/i), '1234567890');

      // 금액
      await userEvent.type(screen.getByLabelText(/기본 금액/i), '500000');

      // 제출
      const submitButton = screen.getByRole('button', { name: /등록/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/recurring-expenses', expect.objectContaining({
          method: 'POST',
        }));
      });
    });

    it('API 성공 시 목록 페이지로 이동', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1' }),
      });

      render(<RecurringExpenseForm />);

      // 필수 필드 입력
      await userEvent.type(screen.getByLabelText(/자동이체 이름/i), '월 임대료');
      fireEvent.click(screen.getByText('예산 선택'));
      await userEvent.type(screen.getByLabelText(/수취인/i), '홍길동');
      await userEvent.type(screen.getByLabelText(/은행명/i), '국민은행');
      await userEvent.type(screen.getByLabelText(/계좌번호/i), '1234567890');
      await userEvent.type(screen.getByLabelText(/기본 금액/i), '500000');

      fireEvent.click(screen.getByRole('button', { name: /등록/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/recurring-expenses');
      });
    });

    it('API 실패 시 에러 메시지 표시', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: '서버 오류가 발생했습니다.' }),
      });

      render(<RecurringExpenseForm />);

      // 필수 필드 입력
      await userEvent.type(screen.getByLabelText(/자동이체 이름/i), '월 임대료');
      fireEvent.click(screen.getByText('예산 선택'));
      await userEvent.type(screen.getByLabelText(/수취인/i), '홍길동');
      await userEvent.type(screen.getByLabelText(/은행명/i), '국민은행');
      await userEvent.type(screen.getByLabelText(/계좌번호/i), '1234567890');
      await userEvent.type(screen.getByLabelText(/기본 금액/i), '500000');

      fireEvent.click(screen.getByRole('button', { name: /등록/i }));

      await waitFor(() => {
        expect(screen.getByText(/서버 오류가 발생했습니다/i)).toBeInTheDocument();
      });
    });

    it('제출 중에는 버튼 비활성화', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ id: '1' }),
        }), 100))
      );

      render(<RecurringExpenseForm />);

      // 필수 필드 입력
      await userEvent.type(screen.getByLabelText(/자동이체 이름/i), '월 임대료');
      fireEvent.click(screen.getByText('예산 선택'));
      await userEvent.type(screen.getByLabelText(/수취인/i), '홍길동');
      await userEvent.type(screen.getByLabelText(/은행명/i), '국민은행');
      await userEvent.type(screen.getByLabelText(/계좌번호/i), '1234567890');
      await userEvent.type(screen.getByLabelText(/기본 금액/i), '500000');

      const submitButton = screen.getByRole('button', { name: /등록/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('수정 모드', () => {
    const existingData = {
      id: '1',
      name: '기존 자동이체',
      committee: '운영위원회',
      department: '사무국',
      budgetCategory: '인건비',
      budgetSubcategory: '급여',
      budgetDetail: '월급',
      recipientName: '홍길동',
      bankName: '국민은행',
      accountNumber: '1234567890',
      baseAmount: 500000,
      frequency: 'MONTHLY' as const,
      dayOfMonth: 15,
      startDate: new Date('2025-01-01'),
      advanceDays: 7,
    };

    it('기존 데이터로 폼 초기화', () => {
      render(<RecurringExpenseForm initialData={existingData} />);

      expect(screen.getByLabelText(/자동이체 이름/i)).toHaveValue('기존 자동이체');
      expect(screen.getByLabelText(/수취인/i)).toHaveValue('홍길동');
      expect(screen.getByLabelText(/기본 금액/i)).toHaveValue('500,000');
    });

    it('수정 모드에서는 "수정" 버튼 표시', () => {
      render(<RecurringExpenseForm initialData={existingData} />);

      expect(screen.getByRole('button', { name: /수정/i })).toBeInTheDocument();
    });

    it('수정 모드에서는 PUT 요청', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '1' }),
      });

      render(<RecurringExpenseForm initialData={existingData} />);

      fireEvent.click(screen.getByRole('button', { name: /수정/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/recurring-expenses/1', expect.objectContaining({
          method: 'PUT',
        }));
      });
    });
  });
});
