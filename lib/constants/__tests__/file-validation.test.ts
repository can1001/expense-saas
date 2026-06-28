/**
 * 파일 검증 상수 및 유틸리티 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  FILE_VALIDATION,
  isAllowedMimeType,
  isAllowedExtension,
  isAllowedFormat,
  isValidFileSize,
  formatFileSize,
} from '../file-validation';

describe('FILE_VALIDATION constants', () => {
  it('should have correct MIME types', () => {
    expect(FILE_VALIDATION.ALLOWED_MIME_TYPES).toContain('image/jpeg');
    expect(FILE_VALIDATION.ALLOWED_MIME_TYPES).toContain('image/png');
    expect(FILE_VALIDATION.ALLOWED_MIME_TYPES).toContain('image/gif');
    expect(FILE_VALIDATION.ALLOWED_MIME_TYPES).toContain('image/webp');
    expect(FILE_VALIDATION.ALLOWED_MIME_TYPES).toContain('application/pdf');
  });

  it('should have correct file extensions', () => {
    expect(FILE_VALIDATION.ALLOWED_EXTENSIONS).toContain('.jpg');
    expect(FILE_VALIDATION.ALLOWED_EXTENSIONS).toContain('.png');
    expect(FILE_VALIDATION.ALLOWED_EXTENSIONS).toContain('.gif');
    expect(FILE_VALIDATION.ALLOWED_EXTENSIONS).toContain('.pdf');
  });

  it('should have correct max file size (5MB)', () => {
    expect(FILE_VALIDATION.MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
  });

  it('should have correct max files limit (10)', () => {
    expect(FILE_VALIDATION.MAX_FILES).toBe(10);
  });
});

describe('isAllowedMimeType', () => {
  it('should return true for allowed MIME types', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(true);
    expect(isAllowedMimeType('image/jpg')).toBe(true);
    expect(isAllowedMimeType('image/png')).toBe(true);
    expect(isAllowedMimeType('image/gif')).toBe(true);
    expect(isAllowedMimeType('image/webp')).toBe(true);
    expect(isAllowedMimeType('application/pdf')).toBe(true);
  });

  it('should return false for disallowed MIME types', () => {
    expect(isAllowedMimeType('video/mp4')).toBe(false);
    expect(isAllowedMimeType('text/plain')).toBe(false);
    expect(isAllowedMimeType('application/zip')).toBe(false);
  });
});

describe('isAllowedExtension', () => {
  it('should return true for allowed extensions', () => {
    expect(isAllowedExtension('photo.jpg')).toBe(true);
    expect(isAllowedExtension('image.jpeg')).toBe(true);
    expect(isAllowedExtension('picture.png')).toBe(true);
    expect(isAllowedExtension('animation.gif')).toBe(true);
    expect(isAllowedExtension('image.webp')).toBe(true);
    expect(isAllowedExtension('document.pdf')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isAllowedExtension('photo.JPG')).toBe(true);
    expect(isAllowedExtension('image.PNG')).toBe(true);
    expect(isAllowedExtension('file.JpEg')).toBe(true);
    expect(isAllowedExtension('document.PDF')).toBe(true);
  });

  it('should return false for disallowed extensions', () => {
    expect(isAllowedExtension('video.mp4')).toBe(false);
    expect(isAllowedExtension('file.txt')).toBe(false);
    expect(isAllowedExtension('archive.zip')).toBe(false);
  });
});

describe('isAllowedFormat', () => {
  it('should return true for allowed formats', () => {
    expect(isAllowedFormat('jpg')).toBe(true);
    expect(isAllowedFormat('jpeg')).toBe(true);
    expect(isAllowedFormat('png')).toBe(true);
    expect(isAllowedFormat('gif')).toBe(true);
    expect(isAllowedFormat('webp')).toBe(true);
    expect(isAllowedFormat('pdf')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isAllowedFormat('JPG')).toBe(true);
    expect(isAllowedFormat('PNG')).toBe(true);
    expect(isAllowedFormat('JpEg')).toBe(true);
    expect(isAllowedFormat('PDF')).toBe(true);
  });

  it('should return false for disallowed formats', () => {
    expect(isAllowedFormat('mp4')).toBe(false);
    expect(isAllowedFormat('txt')).toBe(false);
    expect(isAllowedFormat('zip')).toBe(false);
  });
});

describe('isValidFileSize', () => {
  it('should return true for valid file sizes', () => {
    expect(isValidFileSize(1)).toBe(true);
    expect(isValidFileSize(1024)).toBe(true);
    expect(isValidFileSize(1024 * 1024)).toBe(true); // 1MB
    expect(isValidFileSize(5 * 1024 * 1024)).toBe(true); // 5MB (max)
  });

  it('should return false for zero size', () => {
    expect(isValidFileSize(0)).toBe(false);
  });

  it('should return false for negative size', () => {
    expect(isValidFileSize(-1)).toBe(false);
    expect(isValidFileSize(-1000)).toBe(false);
  });

  it('should return false for files exceeding max size', () => {
    expect(isValidFileSize(5 * 1024 * 1024 + 1)).toBe(false); // 5MB + 1byte
    expect(isValidFileSize(10 * 1024 * 1024)).toBe(false); // 10MB
  });
});

describe('formatFileSize', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(1)).toBe('1 Bytes');
    expect(formatFileSize(500)).toBe('500 Bytes');
  });

  it('should format KB correctly', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(2048)).toBe('2 KB');
  });

  it('should format MB correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
  });

  it('should format GB correctly', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});
