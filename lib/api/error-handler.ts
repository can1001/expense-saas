/**
 * API 에러 핸들러
 *
 * 모든 API 라우트에서 사용할 수 있는 중앙화된 에러 처리 유틸리티
 */

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ERROR_MESSAGES } from '@/lib/constants/error-messages';

/**
 * 커스텀 API 에러 클래스
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 에러 응답 타입
 */
interface ErrorResponse {
  error: string;
  details?: any;
  [key: string]: any;
}

/**
 * Prisma 에러를 API 에러로 변환
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): ApiError {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      return new ApiError(ERROR_MESSAGES.RESOURCE_ALREADY_EXISTS, 409, {
        fields: error.meta?.target,
      });

    case 'P2025':
      // Record not found
      return new ApiError(ERROR_MESSAGES.RESOURCE_NOT_FOUND, 404);

    case 'P2003':
      // Foreign key constraint failed
      return new ApiError(ERROR_MESSAGES.REFERENCED_RESOURCE_NOT_FOUND, 404, {
        field: error.meta?.field_name,
      });

    case 'P2014':
      // Invalid relation
      return new ApiError(ERROR_MESSAGES.INVALID_ID, 400);

    default:
      return new ApiError(ERROR_MESSAGES.INTERNAL_SERVER_ERROR, 500, {
        code: error.code,
      });
  }
}

/**
 * Cloudinary 에러를 API 에러로 변환
 */
function handleCloudinaryError(error: any): ApiError {
  if (error.http_code === 404 || error.error?.http_code === 404) {
    return new ApiError(ERROR_MESSAGES.IMAGE_NOT_FOUND, 404, {
      details: error.message,
    });
  }

  return new ApiError(ERROR_MESSAGES.CLOUDINARY_UPLOAD_FAILED, 500, {
    details: error.message,
    httpCode: error.http_code || error.error?.http_code,
  });
}

/**
 * 에러를 적절한 HTTP 응답으로 변환
 */
export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  console.error('API Error:', error);

  // ApiError (커스텀 에러)
  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      error: error.message,
    };

    if (error.details) {
      response.details = error.details;
    }

    return NextResponse.json(response, { status: error.statusCode });
  }

  // Prisma 에러
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const apiError = handlePrismaError(error);
    const response: ErrorResponse = {
      error: apiError.message,
    };

    if (apiError.details) {
      response.details = apiError.details;
    }

    return NextResponse.json(response, { status: apiError.statusCode });
  }

  // Prisma Validation 에러
  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.REQUIRED_FIELDS_MISSING,
        details: error.message,
      },
      { status: 400 }
    );
  }

  // JSON 파싱 에러
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.INVALID_JSON,
      },
      { status: 400 }
    );
  }

  // Cloudinary 에러 (error.http_code 또는 error.error?.http_code가 있는 경우)
  if (error && typeof error === 'object' && ('http_code' in error || 'error' in error)) {
    const apiError = handleCloudinaryError(error);
    return NextResponse.json(
      {
        error: apiError.message,
        details: apiError.details,
      },
      { status: apiError.statusCode }
    );
  }

  // 일반 Error
  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        details: error.message,
      },
      { status: 500 }
    );
  }

  // 알 수 없는 에러
  return NextResponse.json(
    {
      error: ERROR_MESSAGES.UNKNOWN_ERROR,
    },
    { status: 500 }
  );
}

/**
 * JSON 요청 본문을 검증하고 파싱
 */
export async function parseJsonRequest(request: Request): Promise<any> {
  const contentType = request.headers.get('content-type');

  if (!contentType || !contentType.includes('application/json')) {
    throw new ApiError(ERROR_MESSAGES.INVALID_CONTENT_TYPE, 400);
  }

  try {
    const body = await request.json();
    return body;
  } catch {
    throw new ApiError(ERROR_MESSAGES.INVALID_JSON, 400);
  }
}

/**
 * 필수 필드 검증
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): void {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    throw new ApiError(ERROR_MESSAGES.REQUIRED_FIELDS_MISSING, 400, {
      missingFields,
    });
  }
}

/**
 * URL 검증
 */
export function validateUrl(url: string, httpsOnly: boolean = false): void {
  try {
    const parsedUrl = new URL(url);

    if (httpsOnly && parsedUrl.protocol !== 'https:') {
      throw new ApiError(ERROR_MESSAGES.INVALID_HTTPS_URL, 400);
    }
  } catch {
    throw new ApiError(
      httpsOnly ? ERROR_MESSAGES.INVALID_HTTPS_URL : ERROR_MESSAGES.INVALID_URL,
      400
    );
  }
}

/**
 * 성공 응답 생성 헬퍼
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * 성공 메시지 응답 생성 헬퍼
 */
export function successMessageResponse(
  message: string,
  additionalData?: Record<string, any>,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      message,
      ...additionalData,
    },
    { status }
  );
}
