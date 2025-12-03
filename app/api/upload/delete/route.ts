import { NextRequest, NextResponse } from 'next/server';
import { deleteImage } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE /api/upload/delete - Cloudinary 이미지 삭제
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicId } = body;

    if (!publicId) {
      return NextResponse.json(
        { error: 'publicId가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // Cloudinary에서 이미지 삭제
    const result = await deleteImage(publicId);

    if (result.result === 'ok') {
      return NextResponse.json({
        success: true,
        message: '이미지가 성공적으로 삭제되었습니다.',
      });
    } else {
      return NextResponse.json(
        {
          error: '이미지 삭제에 실패했습니다.',
          result
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Image delete error:', error);
    return NextResponse.json(
      {
        error: '이미지 삭제에 실패했습니다.',
        details: error.message
      },
      { status: 500 }
    );
  }
}
