/**
 * 헌금 종류 관련 상수 및 유틸리티 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import { OfferingType } from '@prisma/client';
import {
  OFFERING_TYPE_LABELS,
  OFFERING_TYPE_COLORS,
  OFFERING_TYPES,
  mapKoreanTypeToEnum,
  formatCurrency,
  getTodayString,
  getWeekLabel,
} from '../offering-types';

describe('offering-types', () => {
  describe('OFFERING_TYPE_LABELS', () => {
    it('should have Korean labels for all offering types', () => {
      expect(OFFERING_TYPE_LABELS.TITHE).toBe('십일조');
      expect(OFFERING_TYPE_LABELS.THANKSGIVING).toBe('감사헌금');
      expect(OFFERING_TYPE_LABELS.SPECIAL).toBe('특별헌금');
      expect(OFFERING_TYPE_LABELS.MISSION).toBe('선교헌금');
      expect(OFFERING_TYPE_LABELS.BUILDING).toBe('건축헌금');
      expect(OFFERING_TYPE_LABELS.RELIEF).toBe('구제헌금');
      expect(OFFERING_TYPE_LABELS.OTHER).toBe('기타');
    });

    it('should contain all OfferingType enum values', () => {
      const expectedTypes: OfferingType[] = [
        'TITHE',
        'THANKSGIVING',
        'SPECIAL',
        'MISSION',
        'BUILDING',
        'RELIEF',
        'OTHER',
      ];

      expectedTypes.forEach((type) => {
        expect(OFFERING_TYPE_LABELS[type]).toBeDefined();
        expect(typeof OFFERING_TYPE_LABELS[type]).toBe('string');
      });
    });
  });

  describe('OFFERING_TYPE_COLORS', () => {
    it('should have color configuration for all offering types', () => {
      const types: OfferingType[] = [
        'TITHE',
        'THANKSGIVING',
        'SPECIAL',
        'MISSION',
        'BUILDING',
        'RELIEF',
        'OTHER',
      ];

      types.forEach((type) => {
        expect(OFFERING_TYPE_COLORS[type]).toBeDefined();
        expect(OFFERING_TYPE_COLORS[type].bg).toBeDefined();
        expect(OFFERING_TYPE_COLORS[type].text).toBeDefined();
        expect(typeof OFFERING_TYPE_COLORS[type].bg).toBe('string');
        expect(typeof OFFERING_TYPE_COLORS[type].text).toBe('string');
      });
    });

    it('should have valid Tailwind CSS classes', () => {
      expect(OFFERING_TYPE_COLORS.TITHE).toEqual({
        bg: 'bg-teal-100',
        text: 'text-teal-800',
      });
      expect(OFFERING_TYPE_COLORS.THANKSGIVING).toEqual({
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
      });
      expect(OFFERING_TYPE_COLORS.SPECIAL).toEqual({
        bg: 'bg-purple-100',
        text: 'text-purple-800',
      });
      expect(OFFERING_TYPE_COLORS.MISSION).toEqual({
        bg: 'bg-orange-100',
        text: 'text-orange-800',
      });
      expect(OFFERING_TYPE_COLORS.BUILDING).toEqual({
        bg: 'bg-blue-100',
        text: 'text-blue-800',
      });
      expect(OFFERING_TYPE_COLORS.RELIEF).toEqual({
        bg: 'bg-green-100',
        text: 'text-green-800',
      });
      expect(OFFERING_TYPE_COLORS.OTHER).toEqual({
        bg: 'bg-gray-100',
        text: 'text-gray-800',
      });
    });
  });

  describe('OFFERING_TYPES', () => {
    it('should be an array of all offering types', () => {
      expect(Array.isArray(OFFERING_TYPES)).toBe(true);
      expect(OFFERING_TYPES.length).toBe(7);
    });

    it('should contain all expected offering types', () => {
      expect(OFFERING_TYPES).toContain('TITHE');
      expect(OFFERING_TYPES).toContain('THANKSGIVING');
      expect(OFFERING_TYPES).toContain('SPECIAL');
      expect(OFFERING_TYPES).toContain('MISSION');
      expect(OFFERING_TYPES).toContain('BUILDING');
      expect(OFFERING_TYPES).toContain('RELIEF');
      expect(OFFERING_TYPES).toContain('OTHER');
    });
  });

  describe('mapKoreanTypeToEnum', () => {
    it('should map Korean strings to OfferingType enum values', () => {
      expect(mapKoreanTypeToEnum('십일조')).toBe('TITHE');
      expect(mapKoreanTypeToEnum('감사헌금')).toBe('THANKSGIVING');
      expect(mapKoreanTypeToEnum('특별헌금')).toBe('SPECIAL');
      expect(mapKoreanTypeToEnum('선교헌금')).toBe('MISSION');
      expect(mapKoreanTypeToEnum('건축헌금')).toBe('BUILDING');
      expect(mapKoreanTypeToEnum('구제헌금')).toBe('RELIEF');
      expect(mapKoreanTypeToEnum('기타')).toBe('OTHER');
    });

    it('should return null for unknown Korean strings', () => {
      expect(mapKoreanTypeToEnum('알 수 없는 헌금')).toBeNull();
      expect(mapKoreanTypeToEnum('')).toBeNull();
      expect(mapKoreanTypeToEnum('TITHE')).toBeNull(); // English should not work
    });
  });

  describe('formatCurrency', () => {
    it('should format numbers as Korean currency', () => {
      expect(formatCurrency(0)).toBe('0원');
      expect(formatCurrency(1000)).toBe('1,000원');
      expect(formatCurrency(10000)).toBe('10,000원');
      expect(formatCurrency(1000000)).toBe('1,000,000원');
      expect(formatCurrency(123456789)).toBe('123,456,789원');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-1000)).toBe('-1,000원');
      expect(formatCurrency(-123456)).toBe('-123,456원');
    });

    it('should handle decimal numbers', () => {
      expect(formatCurrency(1000.5)).toContain('1,000');
      expect(formatCurrency(999.99)).toContain('999');
    });
  });

  describe('getTodayString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const result = getTodayString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return today\'s date', () => {
      const result = getTodayString();
      const today = new Date().toISOString().slice(0, 10);
      expect(result).toBe(today);
    });
  });

  describe('getWeekLabel', () => {
    it('should format date as week label (month and week number)', () => {
      expect(getWeekLabel('2026-03-01')).toBe('3월 1주');
      expect(getWeekLabel('2026-03-07')).toBe('3월 1주');
      expect(getWeekLabel('2026-03-08')).toBe('3월 2주');
      expect(getWeekLabel('2026-03-15')).toBe('3월 3주');
      expect(getWeekLabel('2026-03-22')).toBe('3월 4주');
      expect(getWeekLabel('2026-03-29')).toBe('3월 5주');
    });

    it('should handle different months', () => {
      expect(getWeekLabel('2026-01-01')).toBe('1월 1주');
      expect(getWeekLabel('2026-02-15')).toBe('2월 3주');
      expect(getWeekLabel('2026-12-25')).toBe('12월 4주');
    });

    it('should calculate week number based on day of month', () => {
      // Days 1-7: Week 1
      expect(getWeekLabel('2026-04-01')).toBe('4월 1주');
      expect(getWeekLabel('2026-04-07')).toBe('4월 1주');

      // Days 8-14: Week 2
      expect(getWeekLabel('2026-04-08')).toBe('4월 2주');
      expect(getWeekLabel('2026-04-14')).toBe('4월 2주');

      // Days 15-21: Week 3
      expect(getWeekLabel('2026-04-15')).toBe('4월 3주');
      expect(getWeekLabel('2026-04-21')).toBe('4월 3주');

      // Days 22-28: Week 4
      expect(getWeekLabel('2026-04-22')).toBe('4월 4주');
      expect(getWeekLabel('2026-04-28')).toBe('4월 4주');

      // Days 29+: Week 5
      expect(getWeekLabel('2026-04-29')).toBe('4월 5주');
      expect(getWeekLabel('2026-04-30')).toBe('4월 5주');
    });
  });
});
