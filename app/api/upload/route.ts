/**
 * 파일 업로드 API
 *
 * POST /api/upload - Cloudinary에 이미지 업로드
 */

import { NextRequest } from 'next/server';
import { uploadImage } from '@/lib/cloudinary';
import {
  handleApiError,
  ApiError,
  successResponse,
} from '@/lib/api/error-handler';
import {
  FILE_VALIDATION,
  isAllowedMimeType,
  isAllowedExtension,
  isValidFileSize,
} from '@/lib/constants/file-validation';
import { ERROR_MESSAGES } from '@/lib/constants/error-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload - 파일 업로드
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // 파일 존재 여부 확인
    if (!file) {
      throw new ApiError(ERROR_MESSAGES.FILE_NOT_PROVIDED, 400);
    }

    // 파일 크기 검증
    if (file.size === 0) {
      throw new ApiError(ERROR_MESSAGES.FILE_EMPTY, 400);
    }

    if (!isValidFileSize(file.size)) {
      throw new ApiError(ERROR_MESSAGES.FILE_TOO_LARGE, 400, {
        maxSize: FILE_VALIDATION.MAX_FILE_SIZE,
        actualSize: file.size,
      });
    }

    // 파일 타입 검증 (MIME 타입)
    if (!file.type || !isAllowedMimeType(file.type.toLowerCase())) {
      throw new ApiError(ERROR_MESSAGES.FILE_INVALID_TYPE, 400, {
        allowedTypes: FILE_VALIDATION.ALLOWED_MIME_TYPES,
        receivedType: file.type,
      });
    }

    // 파일 확장자 검증
    if (!isAllowedExtension(file.name)) {
      throw new ApiError(ERROR_MESSAGES.FILE_INVALID_EXTENSION, 400, {
        allowedExtensions: FILE_VALIDATION.ALLOWED_EXTENSIONS,
      });
    }

    // 파일명 검증 (보안)
    if (file.name.length > FILE_VALIDATION.MAX_FILENAME_LENGTH) {
      throw new ApiError(ERROR_MESSAGES.FILENAME_TOO_LONG, 400, {
        maxLength: FILE_VALIDATION.MAX_FILENAME_LENGTH,
        actualLength: file.name.length,
      });
    }

    // File을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cloudinary에 업로드
    const result: any = await uploadImage(buffer, file.name, {
      folder: FILE_VALIDATION.CLOUDINARY_FOLDER,
      resource_type: 'auto',
    });

    // 업로드 결과 검증
    if (!result || !result.public_id || !result.secure_url) {
      throw new ApiError(ERROR_MESSAGES.UPLOAD_FAILED, 500, {
        reason: 'Invalid response from Cloudinary',
      });
    }

    // 업로드 결과 반환
    return successResponse({
      success: true,
      data: {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        fileName: file.name,
      },
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
