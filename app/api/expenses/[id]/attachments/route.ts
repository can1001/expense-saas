/**
 * 첨부파일 관리 API
 *
 * POST /api/expenses/[id]/attachments - 첨부파일 추가
 * GET /api/expenses/[id]/attachments - 첨부파일 목록 조회
 */

import { prisma } from '@/lib/prisma';
import {
  handleApiError,
  ApiError,
  parseJsonRequest,
  validateRequiredFields,
  validateUrl,
  successResponse,
} from '@/lib/api/error-handler';
import { validateExpenseId } from '@/lib/validators/id-validator';
import { isAllowedFormat, FILE_VALIDATION } from '@/lib/constants/file-validation';
import { ERROR_MESSAGES } from '@/lib/constants/error-messages';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * POST /api/expenses/[id]/attachments - 첨부파일 추가
 */
const handlePost: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;

    // expenseId 검증
    validateExpenseId(id);

    // JSON 요청 본문 파싱 및 검증
    const body = await parseJsonRequest(request);

    // 필수 필드 검증
    validateRequiredFields(body, [
      'publicId',
      'url',
      'secureUrl',
      'format',
      'fileName',
      'fileSize',
    ]);

    const { publicId, url, secureUrl, format, fileName, fileSize, width, height } = body;

    // publicId 검증
    if (typeof publicId !== 'string' || publicId.trim().length === 0) {
      throw new ApiError(ERROR_MESSAGES.PUBLIC_ID_EMPTY, 400);
    }

    if (publicId.length > FILE_VALIDATION.MAX_PUBLIC_ID_LENGTH) {
      throw new ApiError(ERROR_MESSAGES.PUBLIC_ID_TOO_LONG, 400, {
        maxLength: FILE_VALIDATION.MAX_PUBLIC_ID_LENGTH,
        actualLength: publicId.length,
      });
    }

    // URL 검증
    validateUrl(url, false); // HTTP 허용
    validateUrl(secureUrl, true); // HTTPS만 허용

    // 이미지 포맷 검증
    if (!isAllowedFormat(format)) {
      throw new ApiError(ERROR_MESSAGES.INVALID_FORMAT, 400, {
        allowedFormats: FILE_VALIDATION.ALLOWED_FORMATS,
        receivedFormat: format,
      });
    }

    // fileName 검증
    if (typeof fileName !== 'string' || fileName.trim().length === 0) {
      throw new ApiError('파일명이 비어있습니다.', 400);
    }

    if (fileName.length > FILE_VALIDATION.MAX_FILENAME_LENGTH) {
      throw new ApiError(ERROR_MESSAGES.FILENAME_TOO_LONG, 400);
    }

    // fileSize 검증
    if (typeof fileSize !== 'number' || fileSize <= 0) {
      throw new ApiError('파일 크기는 0보다 커야 합니다.', 400);
    }

    // width/height 검증 (선택사항)
    if (width !== undefined && (typeof width !== 'number' || width <= 0)) {
      throw new ApiError('이미지 너비는 0보다 커야 합니다.', 400);
    }

    if (height !== undefined && (typeof height !== 'number' || height <= 0)) {
      throw new ApiError('이미지 높이는 0보다 커야 합니다.', 400);
    }

    // 지출결의서 존재 여부 확인
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!expense) {
      throw new ApiError(ERROR_MESSAGES.EXPENSE_NOT_FOUND, 404);
    }

    // 첨부파일 생성
    const attachment = await prisma.expenseAttachment.create({
      data: {
        expenseId: id,
        publicId: publicId.trim(),
        url: url.trim(),
        secureUrl: secureUrl.trim(),
        format: format.toLowerCase(),
        fileName: fileName.trim(),
        fileSize: Math.floor(fileSize),
        width: width ? Math.floor(width) : null,
        height: height ? Math.floor(height) : null,
      },
    });

    return successResponse(attachment, 201);
  } catch (error: any) {
    return handleApiError(error);
  }
};

/**
 * GET /api/expenses/[id]/attachments - 첨부파일 목록 조회
 */
const handleGet: UserApiHandler = async (request, { params }) => {
  try {
    const { id } = await params!;

    // expenseId 검증
    validateExpenseId(id);

    // 지출결의서 존재 여부 확인
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!expense) {
      throw new ApiError(ERROR_MESSAGES.EXPENSE_NOT_FOUND, 404);
    }

    // 첨부파일 목록 조회
    const attachments = await prisma.expenseAttachment.findMany({
      where: { expenseId: id },
      orderBy: { createdAt: 'asc' },
    });

    return successResponse(attachments);
  } catch (error: any) {
    return handleApiError(error);
  }
};

export const POST = withAuth(handlePost);
export const GET = withAuth(handleGet);
