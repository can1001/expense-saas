/**
 * print/types 유틸리티 함수 테스트
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../types';

describe('formatCurrency', () => {
  describe('기본 포맷팅', () => {
    it('양수를 천 단위 콤마로 포맷해야 함', () => {
      expect(formatCurrency(1000)).toBe('1,000');
      expect(formatCurrency(10000)).toBe('10,000');
      expect(formatCurrency(100000)).toBe('100,000');
      expect(formatCurrency(1000000)).toBe('1,000,000');
    });

    it('0을 올바르게 포맷해야 함', () => {
      expect(formatCurrency(0)).toBe('0');
    });

    it('1000 미만의 숫자는 콤마 없이 포맷해야 함', () => {
      expect(formatCurrency(1)).toBe('1');
      expect(formatCurrency(100)).toBe('100');
      expect(formatCurrency(999)).toBe('999');
    });
  });

  describe('큰 숫자 처리', () => {
    it('백만 단위 숫자를 올바르게 포맷해야 함', () => {
      expect(formatCurrency(1234567)).toBe('1,234,567');
    });

    it('천만 단위 숫자를 올바르게 포맷해야 함', () => {
      expect(formatCurrency(12345678)).toBe('12,345,678');
    });

    it('억 단위 숫자를 올바르게 포맷해야 함', () => {
      expect(formatCurrency(123456789)).toBe('123,456,789');
    });
  });

  describe('음수 처리', () => {
    it('음수도 올바르게 포맷해야 함', () => {
      expect(formatCurrency(-1000)).toBe('-1,000');
      expect(formatCurrency(-12345)).toBe('-12,345');
    });
  });

  describe('원 기호 미포함 확인', () => {
    it('결과에 원(₩) 기호가 포함되지 않아야 함', () => {
      const result = formatCurrency(10000);
      expect(result).not.toContain('₩');
      expect(result).not.toContain('원');
    });
  });
});
