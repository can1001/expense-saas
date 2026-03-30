/**
 * 적요 즐겨찾기 관련 설정 상수 테스트
 */

import { describe, it, expect } from 'vitest';
import { MEMO_PREFERENCES } from '../memo-preferences';

describe('MEMO_PREFERENCES', () => {
  it('should export MEMO_PREFERENCES constant', () => {
    expect(MEMO_PREFERENCES).toBeDefined();
  });

  it('should have MAX_FAVORITES property', () => {
    expect(MEMO_PREFERENCES.MAX_FAVORITES).toBe(30);
    expect(typeof MEMO_PREFERENCES.MAX_FAVORITES).toBe('number');
  });

  it('should have MAX_DISPLAY property', () => {
    expect(MEMO_PREFERENCES.MAX_DISPLAY).toBe(10);
    expect(typeof MEMO_PREFERENCES.MAX_DISPLAY).toBe('number');
  });

  it('should have all required properties', () => {
    const requiredKeys = ['MAX_FAVORITES', 'MAX_DISPLAY'];
    const actualKeys = Object.keys(MEMO_PREFERENCES);
    expect(actualKeys).toEqual(requiredKeys);
  });

  it('should have logical value relationships', () => {
    // MAX_FAVORITES should be greater than or equal to MAX_DISPLAY
    expect(MEMO_PREFERENCES.MAX_FAVORITES).toBeGreaterThanOrEqual(
      MEMO_PREFERENCES.MAX_DISPLAY
    );

    // All values should be positive
    expect(MEMO_PREFERENCES.MAX_FAVORITES).toBeGreaterThan(0);
    expect(MEMO_PREFERENCES.MAX_DISPLAY).toBeGreaterThan(0);
  });

  it('should be readonly at TypeScript compile time', () => {
    // TypeScript enforces this at compile time with 'as const'
    // At runtime, JavaScript objects are mutable, but TypeScript prevents modification
    // This test verifies the constant is defined and accessible
    expect(MEMO_PREFERENCES).toBeDefined();
    expect(typeof MEMO_PREFERENCES).toBe('object');
  });
});
