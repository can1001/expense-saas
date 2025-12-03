import { NextRequest, NextResponse } from 'next/server';
import { deleteImage } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE /api/upload/delete - Cloudinary 이미지 삭제
export async function DELETE(request: NextRequest) {
  try {
    // Content-Type 확인
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type이 application/json이어야 합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { publicId } = body;

    // publicId 검증
    if (!publicId) {
      return NextResponse.json(
        { error: 'publicId가 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    if (typeof publicId !== 'string') {
      return NextResponse.json(
        { error: 'publicId는 문자열이어야 합니다.' },
        { status: 400 }
      );
    }

    if (publicId.trim().length === 0) {
      return NextResponse.json(
        { error: 'publicId가 비어있습니다.' },
        { status: 400 }
      );
    }

    // publicId 형식 검증 (기본적인 검증)
    if (publicId.length > 500) {
      return NextResponse.json(
        { error: 'publicId가 너무 깁니다.' },
        { status: 400 }
      );
    }

    // Cloudinary에서 이미지 삭제
    const result = await deleteImage(publicId);

    // Cloudinary 응답 검증
    if (!result) {
      return NextResponse.json(
        {
          error: '이미지 삭제 응답을 받지 못했습니다.',
        },
        { status: 500 }
      );
    }

    if (result.result === 'ok') {
      return NextResponse.json({
        success: true,
        message: '이미지가 성공적으로 삭제되었습니다.',
        publicId: publicId,
      });
    } else if (result.result === 'not found') {
      return NextResponse.json(
        {
          error: '삭제할 이미지를 찾을 수 없습니다.',
          publicId: publicId,
        },
        { status: 404 }
      );
    } else {
      return NextResponse.json(
        {
          error: '이미지 삭제에 실패했습니다.',
          result: result.result,
          publicId: publicId,
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Image delete error:', error);
    
    // JSON 파싱 에러 처리
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: '요청 본문이 유효한 JSON이 아닙니다.',
        },
        { status: 400 }
      );
    }

    // Cloudinary 관련 에러 처리
    if (error.http_code) {
      return NextResponse.json(
        {
          error: 'Cloudinary 삭제에 실패했습니다.',
          details: error.message,
          httpCode: error.http_code
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: '이미지 삭제에 실패했습니다.',
        details: error.message || '알 수 없는 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
