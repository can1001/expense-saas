/**
 * API 응답 핸들러
 *
 * 표준화된 API 응답 포맷을 생성하는 유틸리티 함수들
 */

import { NextResponse } from 'next/server';
import type {
  ApiResponse,
  ApiError as ApiErrorType,
  FieldError,
  PaginationMeta,
  PaginatedApiResponse,
} from '@/lib/types';

/**
 * 현재 타임스탬프 생성
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 성공 응답 생성
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    message?: string;
    code?: string;
    status?: number;
  }
): NextResponse<ApiResponse<T>> {
  const { message, code = 'SUCCESS', status = 200 } = options ?? {};

  const response: ApiResponse<T> = {
    success: true,
    code,
    data,
    timestamp: getTimestamp(),
  };

  if (message) {
    response.message = message;
  }

  return NextResponse.json(response, { status });
}

/**
 * 페이지네이션 응답 생성
 */
export function apiPaginatedSuccess<T>(
  data: T[],
  pagination: PaginationMeta,
  options?: {
    message?: string;
    code?: string;
  }
): NextResponse<PaginatedApiResponse<T>> {
  const { message, code = 'SUCCESS' } = options ?? {};

  const response: PaginatedApiResponse<T> = {
    success: true,
    code,
    data,
    meta: {
      pagination,
    },
    timestamp: getTimestamp(),
  };

  if (message) {
    response.message = message;
  }

  return NextResponse.json(response, { status: 200 });
}

/**
 * 생성 성공 응답 (201 Created)
 */
export function apiCreated<T>(
  data: T,
  options?: {
    message?: string;
    code?: string;
  }
): NextResponse<ApiResponse<T>> {
  return apiSuccess(data, {
    ...options,
    code: options?.code ?? 'CREATED',
    status: 201,
  });
}

/**
 * 에러 응답 생성
 */
export function apiError(
  message: string,
  options?: {
    type?: ApiErrorType['type'];
    code?: string;
    status?: number;
    details?: unknown;
    fields?: FieldError[];
  }
): NextResponse<ApiResponse<never>> {
  const {
    type = 'UNKNOWN',
    code = 'ERROR',
    status = 500,
    details,
    fields,
  } = options ?? {};

  const errorInfo: ApiErrorType = {
    type,
    message,
  };

  if (details !== undefined) {
    errorInfo.details = details;
  }

  if (fields && fields.length > 0) {
    errorInfo.fields = fields;
  }

  const response: ApiResponse<never> = {
    success: false,
    code,
    message,
    error: errorInfo,
    timestamp: getTimestamp(),
  };

  return NextResponse.json(response, { status });
}

/**
 * Not Found 에러 (404)
 */
export function apiNotFound(
  message: string = '리소스를 찾을 수 없습니다.'
): NextResponse<ApiResponse<never>> {
  return apiError(message, {
    type: 'NOT_FOUND',
    code: 'NOT_FOUND',
    status: 404,
  });
}

/**
 * Validation 에러 (400)
 */
export function apiValidationError(
  message: string,
  fields?: FieldError[]
): NextResponse<ApiResponse<never>> {
  return apiError(message, {
    type: 'VALIDATION',
    code: 'VALIDATION_ERROR',
    status: 400,
    fields,
  });
}

/**
 * Unauthorized 에러 (401)
 */
export function apiUnauthorized(
  message: string = '인증이 필요합니다.'
): NextResponse<ApiResponse<never>> {
  return apiError(message, {
    type: 'UNAUTHORIZED',
    code: 'UNAUTHORIZED',
    status: 401,
  });
}

/**
 * Forbidden 에러 (403)
 */
export function apiForbidden(
  message: string = '접근 권한이 없습니다.'
): NextResponse<ApiResponse<never>> {
  return apiError(message, {
    type: 'FORBIDDEN',
    code: 'FORBIDDEN',
    status: 403,
  });
}

/**
 * Server Error (500)
 */
export function apiServerError(
  message: string = '서버 오류가 발생했습니다.',
  details?: unknown
): NextResponse<ApiResponse<never>> {
  return apiError(message, {
    type: 'SERVER_ERROR',
    code: 'SERVER_ERROR',
    status: 500,
    details,
  });
}

/**
 * 페이지네이션 메타 정보 계산 헬퍼
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
