import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteImage } from '@/lib/cloudinary';

// DELETE /api/expenses/[id]/attachments/[attachmentId] - 첨부파일 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { attachmentId } = await params;

    // 첨부파일 정보 가져오기
    const attachment = await prisma.expenseAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: '첨부파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Cloudinary에서 이미지 삭제
    try {
      await deleteImage(attachment.publicId);
    } catch (cloudinaryError) {
      console.error('Error deleting image from Cloudinary:', cloudinaryError);
      // Cloudinary 삭제 실패해도 DB는 삭제 진행
    }

    // 데이터베이스에서 첨부파일 삭제
    await prisma.expenseAttachment.delete({
      where: { id: attachmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json(
      { error: '첨부파일 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
