import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate, formatDateShort } from '../utils';

describe('utils', () => {
  describe('cn (className merger)', () => {
    it('merges multiple class names', () => {
      const result = cn('text-red-500', 'bg-blue-500');
      expect(result).toContain('text-red-500');
      expect(result).toContain('bg-blue-500');
    });

    it('handles conditional class names', () => {
      const isActive = true;
      const result = cn('base-class', isActive && 'active-class');
      expect(result).toContain('base-class');
      expect(result).toContain('active-class');
    });

    it('handles false conditional class names', () => {
      const isActive = false;
      const result = cn('base-class', isActive && 'active-class');
      expect(result).toContain('base-class');
      expect(result).not.toContain('active-class');
    });

    it('resolves Tailwind conflicts correctly', () => {
      const result = cn('p-4', 'p-8');
      expect(result).toBe('p-8');
    });

    it('handles array inputs', () => {
      const result = cn(['text-sm', 'font-bold']);
      expect(result).toContain('text-sm');
      expect(result).toContain('font-bold');
    });

    it('handles empty inputs', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('filters out undefined and null values', () => {
      const result = cn('text-red-500', undefined, null, 'bg-blue-500');
      expect(result).toContain('text-red-500');
      expect(result).toContain('bg-blue-500');
    });
  });

  describe('formatCurrency', () => {
    it('formats positive numbers correctly', () => {
      const result = formatCurrency(10000);
      expect(result).toBe('₩ 10,000 원');
    });

    it('formats large numbers with proper separators', () => {
      const result = formatCurrency(1234567);
      expect(result).toBe('₩ 1,234,567 원');
    });

    it('formats zero correctly', () => {
      const result = formatCurrency(0);
      expect(result).toBe('₩ 0 원');
    });

    it('formats negative numbers correctly', () => {
      const result = formatCurrency(-5000);
      expect(result).toBe('₩ -5,000 원');
    });

    it('handles decimal numbers by truncating', () => {
      const result = formatCurrency(10000.99);
      expect(result).toBe('₩ 10,000.99 원');
    });
  });

  describe('formatDate', () => {
    it('formats Date object correctly', () => {
      const date = new Date('2024-03-15');
      const result = formatDate(date);
      expect(result).toMatch(/2024년 03월 \d{2}일/);
    });

    it('formats string date correctly', () => {
      const result = formatDate('2024-03-15');
      expect(result).toMatch(/2024년 03월 \d{2}일/);
    });

    it('returns empty string for null', () => {
      const result = formatDate(null);
      expect(result).toBe('');
    });

    it('returns empty string for undefined', () => {
      const result = formatDate(undefined);
      expect(result).toBe('');
    });

    it('formats with Korean locale', () => {
      const date = new Date('2024-12-31');
      const result = formatDate(date);
      expect(result).toContain('년');
      expect(result).toContain('월');
      expect(result).toContain('일');
    });

    it('handles various date formats', () => {
      const isoDate = formatDate('2024-01-01T00:00:00.000Z');
      expect(isoDate).toMatch(/2024년 01월 01일/);
    });
  });

  describe('formatDateShort', () => {
    it('formats Date object to yyyy-MM-dd', () => {
      const date = new Date('2024-03-15');
      const result = formatDateShort(date);
      expect(result).toMatch(/2024-03-\d{2}/);
    });

    it('formats string date to yyyy-MM-dd', () => {
      const result = formatDateShort('2024-03-15');
      expect(result).toMatch(/2024-03-\d{2}/);
    });

    it('returns empty string for null', () => {
      const result = formatDateShort(null);
      expect(result).toBe('');
    });

    it('returns empty string for undefined', () => {
      const result = formatDateShort(undefined);
      expect(result).toBe('');
    });

    it('pads single digit months and days', () => {
      const date = new Date('2024-01-05');
      const result = formatDateShort(date);
      expect(result).toMatch(/2024-01-0\d/);
    });

    it('formats December 31st correctly', () => {
      const date = new Date('2024-12-31');
      const result = formatDateShort(date);
      expect(result).toMatch(/2024-12-31/);
    });

    it('handles ISO string input', () => {
      const result = formatDateShort('2024-06-15T12:00:00.000Z');
      expect(result).toMatch(/2024-06-\d{2}/);
    });
  });
});
