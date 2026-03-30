/**
 * 예산 세목 즐겨찾기 및 최근 사용 관련 설정 상수 테스트
 */

import { describe, it, expect } from 'vitest';
import { BUDGET_PREFERENCES } from '../budget-preferences';

describe('BUDGET_PREFERENCES', () => {
  it('should export BUDGET_PREFERENCES constant', () => {
    expect(BUDGET_PREFERENCES).toBeDefined();
  });

  it('should have MAX_FAVORITES property', () => {
    expect(BUDGET_PREFERENCES.MAX_FAVORITES).toBe(20);
    expect(typeof BUDGET_PREFERENCES.MAX_FAVORITES).toBe('number');
  });

  it('should have MAX_RECENT_DISPLAY property', () => {
    expect(BUDGET_PREFERENCES.MAX_RECENT_DISPLAY).toBe(5);
    expect(typeof BUDGET_PREFERENCES.MAX_RECENT_DISPLAY).toBe('number');
  });

  it('should have MAX_RECENT_STORAGE property', () => {
    expect(BUDGET_PREFERENCES.MAX_RECENT_STORAGE).toBe(50);
    expect(typeof BUDGET_PREFERENCES.MAX_RECENT_STORAGE).toBe('number');
  });

  it('should have CLEANUP_DAYS property', () => {
    expect(BUDGET_PREFERENCES.CLEANUP_DAYS).toBe(90);
    expect(typeof BUDGET_PREFERENCES.CLEANUP_DAYS).toBe('number');
  });

  it('should have all required properties', () => {
    const requiredKeys = [
      'MAX_FAVORITES',
      'MAX_RECENT_DISPLAY',
      'MAX_RECENT_STORAGE',
      'CLEANUP_DAYS',
    ];
    const actualKeys = Object.keys(BUDGET_PREFERENCES);
    expect(actualKeys).toEqual(requiredKeys);
  });

  it('should have logical value relationships', () => {
    // MAX_RECENT_STORAGE should be greater than MAX_RECENT_DISPLAY
    expect(BUDGET_PREFERENCES.MAX_RECENT_STORAGE).toBeGreaterThan(
      BUDGET_PREFERENCES.MAX_RECENT_DISPLAY
    );

    // All values should be positive
    expect(BUDGET_PREFERENCES.MAX_FAVORITES).toBeGreaterThan(0);
    expect(BUDGET_PREFERENCES.MAX_RECENT_DISPLAY).toBeGreaterThan(0);
    expect(BUDGET_PREFERENCES.MAX_RECENT_STORAGE).toBeGreaterThan(0);
    expect(BUDGET_PREFERENCES.CLEANUP_DAYS).toBeGreaterThan(0);
  });

  it('should be readonly at TypeScript compile time', () => {
    // TypeScript enforces this at compile time with 'as const'
    // At runtime, JavaScript objects are mutable, but TypeScript prevents modification
    // This test verifies the constant is defined and accessible
    expect(BUDGET_PREFERENCES).toBeDefined();
    expect(typeof BUDGET_PREFERENCES).toBe('object');
  });
});
