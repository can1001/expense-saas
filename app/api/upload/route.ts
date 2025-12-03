import { NextRequest, NextResponse } from 'next/server';
import { uploadImage } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 허용되는 이미지 MIME 타입
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

// 허용되는 파일 확장자
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// 파일 크기 제한 (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// POST /api/upload - 파일 업로드
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // 파일 존재 여부 확인
    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size === 0) {
      return NextResponse.json(
        { error: '빈 파일은 업로드할 수 없습니다.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: '파일 크기는 5MB를 초과할 수 없습니다.',
          maxSize: MAX_FILE_SIZE,
          actualSize: file.size
        },
        { status: 400 }
      );
    }

    // 파일 타입 검증 (MIME 타입)
    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { 
          error: '지원하지 않는 파일 형식입니다. 이미지 파일만 업로드 가능합니다.',
          allowedTypes: ALLOWED_MIME_TYPES,
          receivedType: file.type
        },
        { status: 400 }
      );
    }

    // 파일 확장자 검증
    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some(ext => 
      fileName.endsWith(ext)
    );
    
    if (!hasValidExtension) {
      return NextResponse.json(
        { 
          error: '지원하지 않는 파일 확장자입니다.',
          allowedExtensions: ALLOWED_EXTENSIONS
        },
        { status: 400 }
      );
    }

    // 파일명 검증 (보안)
    if (file.name.length > 255) {
      return NextResponse.json(
        { error: '파일명이 너무 깁니다. (최대 255자)' },
        { status: 400 }
      );
    }

    // File을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cloudinary에 업로드
    const result: any = await uploadImage(buffer, file.name, {
      folder: 'expense-receipts',
      resource_type: 'auto',
    });

    // 업로드 결과 검증
    if (!result || !result.public_id || !result.secure_url) {
      return NextResponse.json(
        { error: '업로드는 완료되었지만 응답 데이터가 올바르지 않습니다.' },
        { status: 500 }
      );
    }

    // 업로드 결과 반환
    return NextResponse.json({
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
    console.error('File upload error:', error);
    
    // Cloudinary 관련 에러 처리
    if (error.http_code) {
      return NextResponse.json(
        {
          error: 'Cloudinary 업로드에 실패했습니다.',
          details: error.message,
          httpCode: error.http_code
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: '파일 업로드에 실패했습니다.',
        details: error.message || '알 수 없는 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
