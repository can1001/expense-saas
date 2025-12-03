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
    const body = await request.json();

    const { publicId, url, secureUrl, format, fileName, fileSize, width, height } = body;

    // 필수 필드 검증
    if (!publicId || !url || !secureUrl || !format || !fileName || !fileSize) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
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
        publicId,
        url,
        secureUrl,
        format,
        fileName,
        fileSize,
        width,
        height,
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error: any) {
    console.error('Error creating attachment:', error);
    return NextResponse.json(
      {
        error: '첨부파일 추가에 실패했습니다.',
        details: error.message
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

    const attachments = await prisma.expenseAttachment.findMany({
      where: { expenseId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json(
      { error: '첨부파일 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
