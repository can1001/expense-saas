/**
 * 파일 업로드 검증 관련 상수
 */

export const FILE_VALIDATION = {
  // 허용되는 MIME 타입
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ] as const,

  // 허용되는 파일 확장자
  ALLOWED_EXTENSIONS: [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
  ] as const,

  // 허용되는 이미지 포맷 (DB 저장용)
  ALLOWED_FORMATS: [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
  ] as const,

  // 파일 크기 제한 (5MB)
  MAX_FILE_SIZE: 5 * 1024 * 1024,

  // 파일명 최대 길이
  MAX_FILENAME_LENGTH: 255,

  // publicId 최대 길이
  MAX_PUBLIC_ID_LENGTH: 500,

  // 최대 첨부파일 개수
  MAX_FILES: 10,

  // Cloudinary 폴더
  CLOUDINARY_FOLDER: 'expense-receipts',
} as const;

// 타입 추출
export type AllowedMimeType = typeof FILE_VALIDATION.ALLOWED_MIME_TYPES[number];
export type AllowedExtension = typeof FILE_VALIDATION.ALLOWED_EXTENSIONS[number];
export type AllowedFormat = typeof FILE_VALIDATION.ALLOWED_FORMATS[number];

/**
 * MIME 타입 검증
 */
export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return FILE_VALIDATION.ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

/**
 * 파일 확장자 검증
 */
export function isAllowedExtension(fileName: string): boolean {
  const lowerFileName = fileName.toLowerCase();
  return FILE_VALIDATION.ALLOWED_EXTENSIONS.some(ext => lowerFileName.endsWith(ext));
}

/**
 * 이미지 포맷 검증
 */
export function isAllowedFormat(format: string): format is AllowedFormat {
  return FILE_VALIDATION.ALLOWED_FORMATS.includes(format.toLowerCase() as AllowedFormat);
}

/**
 * 파일 크기 검증
 */
export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= FILE_VALIDATION.MAX_FILE_SIZE;
}

/**
 * 파일 크기 포맷팅
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
