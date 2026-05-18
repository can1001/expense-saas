import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FrequencySelector } from '../FrequencySelector';

describe('FrequencySelector', () => {
  it('4가지 주기 옵션을 표시해야 함', () => {
    render(<FrequencySelector value="MONTHLY" onChange={() => {}} />);

    expect(screen.getByRole('option', { name: '월간' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '분기 (3개월)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '반기 (6개월)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '연간' })).toBeInTheDocument();
  });

  it('선택된 값이 표시되어야 함', () => {
    render(<FrequencySelector value="QUARTERLY" onChange={() => {}} />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('QUARTERLY');
  });

  it('선택 변경 시 onChange 호출', () => {
    const handleChange = vi.fn();
    render(<FrequencySelector value="MONTHLY" onChange={handleChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'ANNUAL' } });

    expect(handleChange).toHaveBeenCalledWith('ANNUAL');
  });

  it('disabled 시 선택 불가', () => {
    render(<FrequencySelector value="MONTHLY" onChange={() => {}} disabled />);

    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });

  it('라벨이 표시되어야 함', () => {
    render(<FrequencySelector value="MONTHLY" onChange={() => {}} label="이체 주기" />);

    expect(screen.getByText('이체 주기')).toBeInTheDocument();
  });
});
