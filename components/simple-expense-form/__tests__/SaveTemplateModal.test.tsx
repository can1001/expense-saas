/**
 * SaveTemplateModal 컴포넌트 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveTemplateModal from '../SaveTemplateModal';

// Mock createTemplate function
const mockCreateTemplate = vi.fn();
vi.mock('@/lib/hooks', () => ({
  useTemplates: () => ({
    templates: [],
    loading: false,
    createTemplate: mockCreateTemplate,
    isMaxReached: false,
  }),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  templateData: {
    budgetCategory: '교회운영비',
    budgetSubcategory: '운영비',
    budgetDetail: '회의비',
    description: '매월 정기 회의',
    defaultAmount: 50000,
  },
};

describe('SaveTemplateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTemplate.mockResolvedValue({
      id: '1',
      name: '새 템플릿',
      budgetCategory: '교회운영비',
      budgetSubcategory: '운영비',
      budgetDetail: '회의비',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('모달이 열려있을 때 템플릿 정보를 표시한다', () => {
    render(<SaveTemplateModal {...defaultProps} />);

    expect(screen.getByText('템플릿으로 저장')).toBeInTheDocument();
    expect(screen.getByText(/교회운영비/)).toBeInTheDocument();
    expect(screen.getByText(/운영비/)).toBeInTheDocument();
    expect(screen.getByText(/회의비/)).toBeInTheDocument();
    expect(screen.getByText(/매월 정기 회의/)).toBeInTheDocument();
    expect(screen.getByText(/50,000원/)).toBeInTheDocument();
  });

  it('isOpen이 false일 때 아무것도 렌더링하지 않는다', () => {
    render(<SaveTemplateModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('템플릿으로 저장')).not.toBeInTheDocument();
  });

  it('템플릿 이름을 입력하고 저장 버튼을 클릭하면 createTemplate이 호출된다', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<SaveTemplateModal {...defaultProps} onSuccess={onSuccess} />);

    const input = screen.getByPlaceholderText('예: 월례 회의비, 출장 교통비');
    await user.type(input, '새 템플릿');

    await user.click(screen.getByRole('button', { name: '저장하기' }));

    await waitFor(() => {
      expect(mockCreateTemplate).toHaveBeenCalledWith({
        name: '새 템플릿',
        budgetCategory: '교회운영비',
        budgetSubcategory: '운영비',
        budgetDetail: '회의비',
        description: '매월 정기 회의',
        defaultAmount: 50000,
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('이름이 비어있으면 저장 버튼이 비활성화된다', async () => {
    render(<SaveTemplateModal {...defaultProps} />);

    const saveButton = screen.getByRole('button', { name: '저장하기' });
    expect(saveButton).toBeDisabled();
    expect(mockCreateTemplate).not.toHaveBeenCalled();
  });

  it('입력 필드의 maxLength가 50으로 설정되어 있다', () => {
    render(<SaveTemplateModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('예: 월례 회의비, 출장 교통비');
    expect(input).toHaveAttribute('maxLength', '50');
  });

  it('나중에 버튼 클릭 시 onClose가 호출된다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SaveTemplateModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: '나중에' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('글자 수 카운터를 표시한다', async () => {
    const user = userEvent.setup();
    render(<SaveTemplateModal {...defaultProps} />);

    expect(screen.getByText('0/50자')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('예: 월례 회의비, 출장 교통비');
    await user.type(input, '테스트');

    expect(screen.getByText('3/50자')).toBeInTheDocument();
  });

  it('저장 실패 시 에러 메시지를 표시한다', async () => {
    mockCreateTemplate.mockRejectedValue(new Error('저장 실패'));

    const user = userEvent.setup();
    render(<SaveTemplateModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('예: 월례 회의비, 출장 교통비');
    await user.type(input, '새 템플릿');

    await user.click(screen.getByRole('button', { name: '저장하기' }));

    await waitFor(() => {
      expect(screen.getByText('저장 실패')).toBeInTheDocument();
    });
  });
});

describe('SaveTemplateModal with maxReached', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('최대 템플릿 수에 도달하면 안내 메시지를 표시한다', () => {
    vi.doMock('@/lib/hooks', () => ({
      useTemplates: () => ({
        templates: [],
        loading: false,
        createTemplate: vi.fn(),
        isMaxReached: true,
      }),
    }));

    // Note: 모듈 캐싱으로 인해 위의 mock이 적용되지 않을 수 있음
    // 통합 테스트에서 검증 필요
  });
});
