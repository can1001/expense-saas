/**
 * 에러 메시지 상수
 */

export const ERROR_MESSAGES = {
  // File validation errors
  FILE_NOT_PROVIDED: '파일이 제공되지 않았습니다.',
  FILE_EMPTY: '빈 파일은 업로드할 수 없습니다.',
  FILE_TOO_LARGE: '파일 크기는 5MB를 초과할 수 없습니다.',
  FILE_INVALID_TYPE: '지원하지 않는 파일 형식입니다. 이미지 파일만 업로드 가능합니다.',
  FILE_INVALID_EXTENSION: '지원하지 않는 파일 확장자입니다.',
  FILENAME_TOO_LONG: '파일명이 너무 깁니다. (최대 255자)',
  MAX_FILES_EXCEEDED: '최대 첨부파일 개수를 초과했습니다.',

  // Resource errors
  EXPENSE_NOT_FOUND: '지출결의서를 찾을 수 없습니다.',
  ATTACHMENT_NOT_FOUND: '첨부파일을 찾을 수 없습니다.',
  RESOURCE_NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',

  // Validation errors
  INVALID_ID: '유효하지 않은 ID입니다.',
  INVALID_EXPENSE_ID: '유효하지 않은 지출결의서 ID입니다.',
  INVALID_ATTACHMENT_ID: '유효하지 않은 첨부파일 ID입니다.',
  INVALID_PUBLIC_ID: '유효하지 않은 publicId입니다.',
  INVALID_CONTENT_TYPE: 'Content-Type이 application/json이어야 합니다.',
  INVALID_JSON: '요청 본문이 유효한 JSON이 아닙니다.',
  INVALID_URL: '유효하지 않은 URL입니다.',
  INVALID_HTTPS_URL: '유효한 HTTPS URL이어야 합니다.',
  INVALID_FORMAT: '유효하지 않은 이미지 형식입니다.',
  REQUIRED_FIELDS_MISSING: '필수 필드가 누락되었습니다.',
  PUBLIC_ID_EMPTY: 'publicId가 비어있습니다.',
  PUBLIC_ID_TOO_LONG: 'publicId가 너무 깁니다.',

  // Permission errors
  ATTACHMENT_NOT_OWNED: '이 첨부파일은 해당 지출결의서에 속하지 않습니다.',
  FORBIDDEN: '권한이 없습니다.',

  // Operation errors
  UPLOAD_FAILED: '파일 업로드에 실패했습니다.',
  DELETE_FAILED: '삭제에 실패했습니다.',
  SAVE_FAILED: '저장에 실패했습니다.',
  FETCH_FAILED: '데이터를 불러오는데 실패했습니다.',
  UPDATE_FAILED: '수정에 실패했습니다.',
  ATTACHMENT_CREATE_FAILED: '첨부파일 추가에 실패했습니다.',
  ATTACHMENT_DELETE_FAILED: '첨부파일 삭제에 실패했습니다.',
  ATTACHMENT_FETCH_FAILED: '첨부파일 목록을 불러오는데 실패했습니다.',

  // Cloudinary errors
  CLOUDINARY_UPLOAD_FAILED: 'Cloudinary 업로드에 실패했습니다.',
  CLOUDINARY_DELETE_FAILED: 'Cloudinary 삭제에 실패했습니다.',
  IMAGE_NOT_FOUND: '삭제할 이미지를 찾을 수 없습니다.',
  IMAGE_DELETE_FAILED: '이미지 삭제에 실패했습니다.',

  // Database errors
  RESOURCE_ALREADY_EXISTS: '이미 존재하는 리소스입니다.',
  ATTACHMENT_ALREADY_EXISTS: '이미 존재하는 첨부파일입니다.',
  REFERENCED_RESOURCE_NOT_FOUND: '참조된 리소스가 존재하지 않습니다.',

  // Generic errors
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
  INTERNAL_SERVER_ERROR: '서버 내부 오류가 발생했습니다.',
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
