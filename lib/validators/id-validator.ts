/**
 * ID 검증 유틸리티
 *
 * Prisma CUID 형식의 ID 검증 로직
 */

import { ApiError } from '@/lib/api/error-handler';
import { ERROR_MESSAGES } from '@/lib/constants/error-messages';

/**
 * CUID 형식 검증 정규식
 * Prisma의 cuid()는 25자 길이의 문자열을 생성
 * 형식: c[lowercase letters and numbers]
 */
const CUID_REGEX = /^c[a-z0-9]{24}$/;

/**
 * CUID 형식인지 확인
 */
export function isCuid(id: string): boolean {
  return typeof id === 'string' && CUID_REGEX.test(id);
}

/**
 * ID가 유효한 CUID인지 검증하고, 아니면 에러 throw
 *
 * @param id - 검증할 ID
 * @param errorMessage - 사용할 에러 메시지 (기본값: INVALID_ID)
 * @throws {ApiError} ID가 유효하지 않으면 400 에러
 */
export function validateId(
  id: string,
  errorMessage: string = ERROR_MESSAGES.INVALID_ID
): void {
  if (!id || !isCuid(id)) {
    throw new ApiError(errorMessage, 400);
  }
}

/**
 * Expense ID 검증
 */
export function validateExpenseId(id: string): void {
  validateId(id, ERROR_MESSAGES.INVALID_EXPENSE_ID);
}

/**
 * Attachment ID 검증
 */
export function validateAttachmentId(id: string): void {
  validateId(id, ERROR_MESSAGES.INVALID_ATTACHMENT_ID);
}

/**
 * 여러 ID를 한 번에 검증
 *
 * @param ids - 검증할 ID 배열
 * @param errorMessage - 사용할 에러 메시지
 * @throws {ApiError} 하나라도 유효하지 않으면 400 에러
 */
export function validateIds(
  ids: string[],
  errorMessage: string = ERROR_MESSAGES.INVALID_ID
): void {
  const invalidIds = ids.filter(id => !isCuid(id));

  if (invalidIds.length > 0) {
    throw new ApiError(errorMessage, 400, {
      invalidIds,
    });
  }
}

/**
 * publicId 검증 (Cloudinary)
 */
export function validatePublicId(publicId: string): void {
  if (!publicId || typeof publicId !== 'string') {
    throw new ApiError(ERROR_MESSAGES.PUBLIC_ID_EMPTY, 400);
  }

  if (publicId.trim().length === 0) {
    throw new ApiError(ERROR_MESSAGES.PUBLIC_ID_EMPTY, 400);
  }

  if (publicId.length > 500) {
    throw new ApiError(ERROR_MESSAGES.PUBLIC_ID_TOO_LONG, 400, {
      maxLength: 500,
      actualLength: publicId.length,
    });
  }
}
