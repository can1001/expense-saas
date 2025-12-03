import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteImage } from '@/lib/cloudinary';

// POST /api/expenses/[id]/attachments - 첨부파일 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // expenseId 형식 검증
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json(
        { error: '유효하지 않은 지출결의서 ID입니다.' },
        { status: 400 }
      );
    }

    // Content-Type 확인
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type이 application/json이어야 합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const { publicId, url, secureUrl, format, fileName, fileSize, width, height } = body;

    // 필수 필드 검증
    const requiredFields = { publicId, url, secureUrl, format, fileName, fileSize };
    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          error: '필수 필드가 누락되었습니다.',
          missingFields
        },
        { status: 400 }
      );
    }

    // 필드 타입 및 형식 검증
    if (typeof publicId !== 'string' || publicId.trim().length === 0) {
      return NextResponse.json(
        { error: 'publicId는 비어있지 않은 문자열이어야 합니다.' },
        { status: 400 }
      );
    }

    if (typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json(
        { error: 'url은 유효한 HTTP URL이어야 합니다.' },
        { status: 400 }
      );
    }

    if (typeof secureUrl !== 'string' || !secureUrl.startsWith('https')) {
      return NextResponse.json(
        { error: 'secureUrl은 유효한 HTTPS URL이어야 합니다.' },
        { status: 400 }
      );
    }

    if (typeof format !== 'string' || !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(format.toLowerCase())) {
      return NextResponse.json(
        { error: 'format은 유효한 이미지 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    if (typeof fileName !== 'string' || fileName.trim().length === 0) {
      return NextResponse.json(
        { error: 'fileName은 비어있지 않은 문자열이어야 합니다.' },
        { status: 400 }
      );
    }

    if (typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json(
        { error: 'fileSize는 0보다 큰 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    if (width !== undefined && (typeof width !== 'number' || width <= 0)) {
      return NextResponse.json(
        { error: 'width는 0보다 큰 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    if (height !== undefined && (typeof height !== 'number' || height <= 0)) {
      return NextResponse.json(
        { error: 'height는 0보다 큰 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    // 지출결의서 존재 여부 확인
    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      return NextResponse.json(
        { error: '지출결의서를 찾을 수 없습니다.' },
        { status: 404 }
      );
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

    return NextResponse.json(attachment, { status: 201 });
  } catch (error: any) {
    console.error('Error creating attachment:', error);

    // Prisma 에러 처리
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          error: '이미 존재하는 첨부파일입니다.',
        },
        { status: 409 }
      );
    }

    if (error.code === 'P2003') {
      return NextResponse.json(
        {
          error: '존재하지 않는 지출결의서입니다.',
        },
        { status: 404 }
      );
    }

    // JSON 파싱 에러 처리
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: '요청 본문이 유효한 JSON이 아닙니다.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: '첨부파일 추가에 실패했습니다.',
        details: error.message || '알 수 없는 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// GET /api/expenses/[id]/attachments - 첨부파일 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // expenseId 형식 검증
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json(
        { error: '유효하지 않은 지출결의서 ID입니다.' },
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

    const attachments = await prisma.expenseAttachment.findMany({
      where: { expenseId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(attachments);
  } catch (error: any) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json(
      { 
        error: '첨부파일 목록을 불러오는데 실패했습니다.',
        details: error.message || '알 수 없는 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}
