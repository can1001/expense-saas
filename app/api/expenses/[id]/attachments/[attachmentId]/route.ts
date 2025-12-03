import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteImage } from '@/lib/cloudinary';

// DELETE /api/expenses/[id]/attachments/[attachmentId] - 첨부파일 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params;

    // ID 형식 검증
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json(
        { error: '유효하지 않은 지출결의서 ID입니다.' },
        { status: 400 }
      );
    }

    if (!attachmentId || typeof attachmentId !== 'string' || attachmentId.trim().length === 0) {
      return NextResponse.json(
        { error: '유효하지 않은 첨부파일 ID입니다.' },
        { status: 400 }
      );
    }

    // 지출결의서 존재 여부 확인
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!expense) {
      return NextResponse.json(
        { error: '지출결의서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 첨부파일 정보 가져오기 및 소유권 확인
    const attachment = await prisma.expenseAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: '첨부파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 첨부파일이 해당 지출결의서에 속하는지 확인
    if (attachment.expenseId !== id) {
      return NextResponse.json(
        { error: '이 첨부파일은 해당 지출결의서에 속하지 않습니다.' },
        { status: 403 }
      );
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

    return NextResponse.json({ 
      success: true,
      message: '첨부파일이 성공적으로 삭제되었습니다.',
      cloudinaryDeleted,
      attachmentId,
    });
  } catch (error: any) {
    console.error('Error deleting attachment:', error);

    // Prisma 에러 처리
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: '삭제할 첨부파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        error: '첨부파일 삭제에 실패했습니다.',
        details: error.message || '알 수 없는 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
