/**
 * ID 검증 유틸리티 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  isCuid,
  validateId,
  validateExpenseId,
  validateAttachmentId,
  validateIds,
  validatePublicId,
} from '../id-validator';
import { ApiError } from '@/lib/api/error-handler';

describe('isCuid', () => {
  it('should return true for valid CUIDs', () => {
    expect(isCuid('clx1234567890abcdefghijk')).toBe(true);
    expect(isCuid('cm0abcdefghijklmnopqrstu')).toBe(true);
    expect(isCuid('c' + 'a'.repeat(24))).toBe(true);
  });

  it('should return false for invalid CUIDs', () => {
    // Too short
    expect(isCuid('c123')).toBe(false);

    // Too long
    expect(isCuid('clx1234567890abcdefghijkl')).toBe(false);

    // Doesn't start with 'c'
    expect(isCuid('xlx1234567890abcdefghijk')).toBe(false);

    // Contains uppercase
    expect(isCuid('clx1234567890ABCDEFGHIJK')).toBe(false);

    // Contains special characters
    expect(isCuid('clx1234567890abcdefghi_k')).toBe(false);

    // Empty string
    expect(isCuid('')).toBe(false);
  });

  it('should return false for non-string input', () => {
    expect(isCuid(null as any)).toBe(false);
    expect(isCuid(undefined as any)).toBe(false);
    expect(isCuid(123 as any)).toBe(false);
    expect(isCuid({} as any)).toBe(false);
    expect(isCuid([] as any)).toBe(false);
    expect(isCuid(true as any)).toBe(false);
  });
});

describe('validateId', () => {
  it('should not throw for valid CUIDs', () => {
    expect(() => validateId('clx1234567890abcdefghijk')).not.toThrow();
    expect(() => validateId('cm0abcdefghijklmnopqrstu')).not.toThrow();
  });

  it('should throw ApiError for invalid CUIDs', () => {
    expect(() => validateId('invalid')).toThrow(ApiError);
    expect(() => validateId('')).toThrow(ApiError);
    expect(() => validateId('c123')).toThrow(ApiError);
  });

  it('should throw with custom error message', () => {
    try {
      validateId('invalid', 'Custom error message');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe('Custom error message');
    }
  });

  it('should throw with 400 status code', () => {
    try {
      validateId('invalid');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
    }
  });
});

describe('validateExpenseId', () => {
  it('should not throw for valid expense IDs', () => {
    expect(() => validateExpenseId('clx1234567890abcdefghijk')).not.toThrow();
  });

  it('should throw with expense-specific error message', () => {
    try {
      validateExpenseId('invalid');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toContain('지출결의서');
    }
  });
});

describe('validateAttachmentId', () => {
  it('should not throw for valid attachment IDs', () => {
    expect(() => validateAttachmentId('clx1234567890abcdefghijk')).not.toThrow();
  });

  it('should throw with attachment-specific error message', () => {
    try {
      validateAttachmentId('invalid');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toContain('첨부파일');
    }
  });
});

describe('validateIds', () => {
  it('should not throw when all IDs are valid', () => {
    const validIds = [
      'clx1234567890abcdefghijk',
      'cm0abcdefghijklmnopqrstu',
      'c' + 'a'.repeat(24),
    ];
    expect(() => validateIds(validIds)).not.toThrow();
  });

  it('should throw ApiError when any ID is invalid', () => {
    const invalidIds = [
      'clx1234567890abcdefghijk', // valid
      'invalid-id', // invalid
      'cm0abcdefghijklmnopqrstu', // valid
    ];
    
    expect(() => validateIds(invalidIds)).toThrow(ApiError);
    
    try {
      validateIds(invalidIds);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
      expect((error as ApiError).details).toEqual({
        invalidIds: ['invalid-id'],
      });
    }
  });

  it('should throw ApiError with all invalid IDs in details', () => {
    const invalidIds = [
      'invalid-1',
      'invalid-2',
      'clx1234567890abcdefghijk', // valid
      'invalid-3',
    ];
    
    try {
      validateIds(invalidIds);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).details).toEqual({
        invalidIds: ['invalid-1', 'invalid-2', 'invalid-3'],
      });
    }
  });

  it('should throw ApiError with custom error message', () => {
    const invalidIds = ['invalid-id'];
    
    try {
      validateIds(invalidIds, 'Custom error message');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe('Custom error message');
    }
  });

  it('should throw with 400 status code', () => {
    const invalidIds = ['invalid-id'];
    
    try {
      validateIds(invalidIds);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
    }
  });

  it('should handle empty array', () => {
    expect(() => validateIds([])).not.toThrow();
  });

  it('should handle array with empty strings', () => {
    const idsWithEmpty = ['clx1234567890abcdefghijk', '', 'cm0abcdefghijklmnopqrstu'];
    
    expect(() => validateIds(idsWithEmpty)).toThrow(ApiError);
    
    try {
      validateIds(idsWithEmpty);
    } catch (error) {
      expect((error as ApiError).details).toEqual({
        invalidIds: [''],
      });
    }
  });
});

describe('validatePublicId', () => {
  it('should not throw for valid publicIds', () => {
    expect(() => validatePublicId('expense-receipts/1234-file.jpg')).not.toThrow();
    expect(() => validatePublicId('folder/subfolder/image.png')).not.toThrow();
    expect(() => validatePublicId('a'.repeat(500))).not.toThrow(); // Max length
  });

  it('should throw for empty publicIds', () => {
    expect(() => validatePublicId('')).toThrow(ApiError);
    expect(() => validatePublicId('   ')).toThrow(ApiError);
  });

  it('should throw for publicIds exceeding max length', () => {
    const tooLong = 'a'.repeat(501);
    try {
      validatePublicId(tooLong);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toContain('너무 깁니다');
      expect((error as ApiError).details).toEqual({
        maxLength: 500,
        actualLength: 501,
      });
    }
  });

  it('should throw for non-string publicIds', () => {
    expect(() => validatePublicId(null as any)).toThrow(ApiError);
    expect(() => validatePublicId(undefined as any)).toThrow(ApiError);
    expect(() => validatePublicId(123 as any)).toThrow(ApiError);
  });
});
