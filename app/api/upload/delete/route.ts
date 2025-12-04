/**
 * Cloudinary 이미지 삭제 API
 *
 * DELETE /api/upload/delete - Cloudinary에서 이미지 삭제
 */

import { NextRequest } from 'next/server';
import { deleteImage } from '@/lib/cloudinary';
import {
  handleApiError,
  ApiError,
  parseJsonRequest,
  successMessageResponse,
} from '@/lib/api/error-handler';
import { validatePublicId } from '@/lib/validators/id-validator';
import { ERROR_MESSAGES } from '@/lib/constants/error-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/upload/delete - Cloudinary 이미지 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    // JSON 요청 본문 파싱 및 검증
    const body = await parseJsonRequest(request);
    const { publicId } = body;

    // publicId 검증
    validatePublicId(publicId);

    // Cloudinary에서 이미지 삭제
    const result = await deleteImage(publicId);

    // Cloudinary 응답 검증
    if (!result) {
      throw new ApiError(ERROR_MESSAGES.DELETE_FAILED, 500, {
        reason: 'No response from Cloudinary',
      });
    }

    if (result.result === 'ok') {
      return successMessageResponse(
        '이미지가 성공적으로 삭제되었습니다.',
        { publicId }
      );
    } else if (result.result === 'not found') {
      throw new ApiError(ERROR_MESSAGES.IMAGE_NOT_FOUND, 404, { publicId });
    } else {
      throw new ApiError(ERROR_MESSAGES.IMAGE_DELETE_FAILED, 400, {
        result: result.result,
        publicId,
      });
    }
  } catch (error: any) {
    return handleApiError(error);
  }
}
