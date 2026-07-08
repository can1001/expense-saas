/**
 * 첨부파일 삭제 API
 *
 * DELETE /api/expenses/[id]/attachments/[attachmentId] - 첨부파일 삭제
 */

import { prisma } from '@/lib/prisma';
import { deleteImage } from '@/lib/cloudinary';
import {
  handleApiError,
  ApiError,
  successMessageResponse,
} from '@/lib/api/error-handler';
import { validateExpenseId, validateAttachmentId } from '@/lib/validators/id-validator';
import { ERROR_MESSAGES } from '@/lib/constants/error-messages';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * DELETE /api/expenses/[id]/attachments/[attachmentId] - 첨부파일 삭제
 */
const handleDelete: UserApiHandler = async (request, { params }) => {
  try {
    const { id, attachmentId } = await params! as { id: string; attachmentId: string };

    // ID 검증
    validateExpenseId(id);
    validateAttachmentId(attachmentId);

    // 지출결의서 존재 여부 확인
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!expense) {
      throw new ApiError(ERROR_MESSAGES.EXPENSE_NOT_FOUND, 404);
    }

    // 첨부파일 정보 가져오기 및 소유권 확인
    const attachment = await prisma.expenseAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new ApiError(ERROR_MESSAGES.ATTACHMENT_NOT_FOUND, 404);
    }

    // 첨부파일이 해당 지출결의서에 속하는지 확인
    if (attachment.expenseId !== id) {
      throw new ApiError(ERROR_MESSAGES.ATTACHMENT_NOT_OWNED, 403);
    }

    // Cloudinary에서 이미지 삭제
    let cloudinaryDeleted = false;
    try {
      const deleteResult = await deleteImage(attachment.publicId);
      if (deleteResult.result === 'ok') {
        cloudinaryDeleted = true;
      }
    } catch (cloudinaryError: any) {
      console.error('Error deleting image from Cloudinary:', cloudinaryError);
      // Cloudinary 삭제 실패해도 DB는 삭제 진행 (이미 삭제되었을 수 있음)
    }

    // 데이터베이스에서 첨부파일 삭제
    await prisma.expenseAttachment.delete({
      where: { id: attachmentId },
    });

    return successMessageResponse(
      '첨부파일이 성공적으로 삭제되었습니다.',
      { cloudinaryDeleted, attachmentId }
    );
  } catch (error: any) {
    return handleApiError(error);
  }
};

export const DELETE = withAuth(handleDelete);
