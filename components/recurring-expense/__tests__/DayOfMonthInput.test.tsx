import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayOfMonthInput } from '../DayOfMonthInput';

describe('DayOfMonthInput', () => {
  it('현재 값을 표시해야 함', () => {
    render(<DayOfMonthInput value={15} onChange={() => {}} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(15);
  });

  it('값 변경 시 onChange 호출', () => {
    const handleChange = vi.fn();
    render(<DayOfMonthInput value={15} onChange={handleChange} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '20' } });

    expect(handleChange).toHaveBeenCalledWith(20);
  });

  it('1 미만 입력 시 1로 고정', () => {
    const handleChange = vi.fn();
    render(<DayOfMonthInput value={15} onChange={handleChange} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });

    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it('28 초과 입력 시 28로 고정', () => {
    const handleChange = vi.fn();
    render(<DayOfMonthInput value={15} onChange={handleChange} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '31' } });

    expect(handleChange).toHaveBeenCalledWith(28);
  });

  it('disabled 시 입력 불가', () => {
    render(<DayOfMonthInput value={15} onChange={() => {}} disabled />);

    const input = screen.getByRole('spinbutton');
    expect(input).toBeDisabled();
  });

  it('라벨이 표시되어야 함', () => {
    render(<DayOfMonthInput value={15} onChange={() => {}} label="이체일" />);

    expect(screen.getByText('이체일')).toBeInTheDocument();
  });

  it('매월 N일 형식으로 도움말 표시', () => {
    render(<DayOfMonthInput value={25} onChange={() => {}} />);

    expect(screen.getByText('매월 25일')).toBeInTheDocument();
  });
});
