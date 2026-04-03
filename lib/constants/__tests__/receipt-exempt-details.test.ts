/**
 * 영수증 첨부 예외 세목 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  RECEIPT_EXEMPT_DETAILS,
  areAllItemsReceiptExempt,
} from '../receipt-exempt-details';

describe('RECEIPT_EXEMPT_DETAILS', () => {
  it('should export RECEIPT_EXEMPT_DETAILS constant', () => {
    expect(RECEIPT_EXEMPT_DETAILS).toBeDefined();
    expect(Array.isArray(RECEIPT_EXEMPT_DETAILS)).toBe(true);
  });

  it('should contain expected exempt details', () => {
    expect(RECEIPT_EXEMPT_DETAILS).toContain('교역자식대');
    expect(RECEIPT_EXEMPT_DETAILS).toContain('사무간사식대');
    expect(RECEIPT_EXEMPT_DETAILS).toContain('목회_통신비');
    expect(RECEIPT_EXEMPT_DETAILS).toContain('공간사역비');
    expect(RECEIPT_EXEMPT_DETAILS).toContain('사택관리비');
  });

  it('should have 5 exempt details', () => {
    expect(RECEIPT_EXEMPT_DETAILS.length).toBe(5);
  });

  it('should not contain empty strings', () => {
    RECEIPT_EXEMPT_DETAILS.forEach((detail) => {
      expect(detail.length).toBeGreaterThan(0);
    });
  });
});

describe('areAllItemsReceiptExempt', () => {
  describe('returns true when all items are exempt', () => {
    it('should return true for single exempt item', () => {
      const items = [{ budgetDetail: '교역자식대' }];
      expect(areAllItemsReceiptExempt(items)).toBe(true);
    });

    it('should return true for multiple exempt items', () => {
      const items = [
        { budgetDetail: '교역자식대' },
        { budgetDetail: '사무간사식대' },
        { budgetDetail: '목회_통신비' },
      ];
      expect(areAllItemsReceiptExempt(items)).toBe(true);
    });

    it('should return true for all exempt details', () => {
      const items = RECEIPT_EXEMPT_DETAILS.map((detail) => ({
        budgetDetail: detail,
      }));
      expect(areAllItemsReceiptExempt(items)).toBe(true);
    });
  });

  describe('returns false when any item is not exempt', () => {
    it('should return false for single non-exempt item', () => {
      const items = [{ budgetDetail: '회의비' }];
      expect(areAllItemsReceiptExempt(items)).toBe(false);
    });

    it('should return false for mixed items (exempt + non-exempt)', () => {
      const items = [
        { budgetDetail: '교역자식대' }, // exempt
        { budgetDetail: '회의비' }, // not exempt
      ];
      expect(areAllItemsReceiptExempt(items)).toBe(false);
    });

    it('should return false when budgetDetail is undefined', () => {
      const items = [{ budgetDetail: undefined }];
      expect(areAllItemsReceiptExempt(items)).toBe(false);
    });

    it('should return false when budgetDetail is empty string', () => {
      const items = [{ budgetDetail: '' }];
      expect(areAllItemsReceiptExempt(items)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for empty array', () => {
      expect(areAllItemsReceiptExempt([])).toBe(false);
    });

    it('should handle items without budgetDetail property', () => {
      const items = [{}] as Array<{ budgetDetail?: string }>;
      expect(areAllItemsReceiptExempt(items)).toBe(false);
    });

    it('should be case-sensitive', () => {
      const items = [{ budgetDetail: '교역자식대' }]; // correct
      expect(areAllItemsReceiptExempt(items)).toBe(true);

      const itemsUpperCase = [{ budgetDetail: '교역자식대 ' }]; // with space
      expect(areAllItemsReceiptExempt(itemsUpperCase)).toBe(false);
    });
  });
});
