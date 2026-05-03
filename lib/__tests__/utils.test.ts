import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate, formatDateShort, maskAccountNumber, formatRelativeTime, getExpenseEditPath } from '../utils';

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

  describe('maskAccountNumber', () => {
    it('masks account number with more than 4 digits', () => {
      const result = maskAccountNumber('1234567890');
      expect(result).toBe('****7890');
    });

    it('shows full number if 4 digits or less', () => {
      const result = maskAccountNumber('1234');
      expect(result).toBe('1234');
    });

    it('shows full number if less than 4 digits', () => {
      const result = maskAccountNumber('123');
      expect(result).toBe('123');
    });

    it('returns empty string for null', () => {
      const result = maskAccountNumber(null);
      expect(result).toBe('');
    });

    it('returns empty string for undefined', () => {
      const result = maskAccountNumber(undefined);
      expect(result).toBe('');
    });

    it('removes non-numeric characters before masking', () => {
      const result = maskAccountNumber('123-456-7890');
      expect(result).toBe('****7890');
    });

    it('handles account numbers with spaces', () => {
      const result = maskAccountNumber('123 456 7890');
      expect(result).toBe('****7890');
    });

    it('handles account numbers with dashes and spaces', () => {
      const result = maskAccountNumber('123-456 789-0');
      expect(result).toBe('****7890');
    });

    it('handles very long account numbers', () => {
      const result = maskAccountNumber('12345678901234567890');
      expect(result).toBe('****7890');
    });

    it('handles empty string', () => {
      const result = maskAccountNumber('');
      expect(result).toBe('');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "방금" for less than 1 minute', () => {
      const now = Date.now();
      const result = formatRelativeTime(now);
      expect(result).toBe('방금');
    });

    it('returns "방금" for 30 seconds ago', () => {
      const now = Date.now();
      const thirtySecondsAgo = now - 30000;
      const result = formatRelativeTime(thirtySecondsAgo);
      expect(result).toBe('방금');
    });

    it('returns "1분 전" for 1 minute ago', () => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const result = formatRelativeTime(oneMinuteAgo);
      expect(result).toBe('1분 전');
    });

    it('returns "5분 전" for 5 minutes ago', () => {
      const now = Date.now();
      const fiveMinutesAgo = now - 300000;
      const result = formatRelativeTime(fiveMinutesAgo);
      expect(result).toBe('5분 전');
    });

    it('returns "59분 전" for 59 minutes ago', () => {
      const now = Date.now();
      const fiftyNineMinutesAgo = now - 3540000;
      const result = formatRelativeTime(fiftyNineMinutesAgo);
      expect(result).toBe('59분 전');
    });

    it('returns "1시간 전" for 1 hour ago', () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const result = formatRelativeTime(oneHourAgo);
      expect(result).toBe('1시간 전');
    });

    it('returns "5시간 전" for 5 hours ago', () => {
      const now = Date.now();
      const fiveHoursAgo = now - 18000000;
      const result = formatRelativeTime(fiveHoursAgo);
      expect(result).toBe('5시간 전');
    });

    it('returns "23시간 전" for 23 hours ago', () => {
      const now = Date.now();
      const twentyThreeHoursAgo = now - 82800000;
      const result = formatRelativeTime(twentyThreeHoursAgo);
      expect(result).toBe('23시간 전');
    });

    it('returns "어제" for exactly 1 day ago', () => {
      const now = Date.now();
      const oneDayAgo = now - 86400000;
      const result = formatRelativeTime(oneDayAgo);
      expect(result).toBe('어제');
    });

    it('returns "2일 전" for 2 days ago', () => {
      const now = Date.now();
      const twoDaysAgo = now - 172800000;
      const result = formatRelativeTime(twoDaysAgo);
      expect(result).toBe('2일 전');
    });

    it('returns "6일 전" for 6 days ago', () => {
      const now = Date.now();
      const sixDaysAgo = now - 518400000;
      const result = formatRelativeTime(sixDaysAgo);
      expect(result).toBe('6일 전');
    });

    it('returns "지난주" for 7 days ago', () => {
      const now = Date.now();
      const sevenDaysAgo = now - 604800000;
      const result = formatRelativeTime(sevenDaysAgo);
      expect(result).toBe('지난주');
    });

    it('returns "지난주" for 30 days ago', () => {
      const now = Date.now();
      const thirtyDaysAgo = now - 2592000000;
      const result = formatRelativeTime(thirtyDaysAgo);
      expect(result).toBe('지난주');
    });
  });

  describe('getExpenseEditPath', () => {
    it('returns simple edit path for version 4.1.4', () => {
      const result = getExpenseEditPath('expense-123', '4.1.4');
      expect(result).toBe('/expenses/simple/expense-123/edit');
    });

    it('returns regular edit path for other versions', () => {
      const result = getExpenseEditPath('expense-123', '4.1.0');
      expect(result).toBe('/expenses/expense-123/edit');
    });

    it('returns regular edit path for version 4.1.3', () => {
      const result = getExpenseEditPath('expense-123', '4.1.3');
      expect(result).toBe('/expenses/expense-123/edit');
    });

    it('returns regular edit path for null version', () => {
      const result = getExpenseEditPath('expense-123', null);
      expect(result).toBe('/expenses/expense-123/edit');
    });

    it('returns regular edit path for undefined version', () => {
      const result = getExpenseEditPath('expense-123', undefined);
      expect(result).toBe('/expenses/expense-123/edit');
    });

    it('returns regular edit path when version is not provided', () => {
      const result = getExpenseEditPath('expense-123');
      expect(result).toBe('/expenses/expense-123/edit');
    });

    it('handles UUID-like expense IDs', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const result = getExpenseEditPath(uuid, '4.1.4');
      expect(result).toBe(`/expenses/simple/${uuid}/edit`);
    });

    it('handles empty string ID', () => {
      const result = getExpenseEditPath('', '4.1.4');
      expect(result).toBe('/expenses/simple//edit');
    });
  });
});
