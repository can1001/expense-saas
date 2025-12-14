/**
 * 개별 은행 계좌 API
 *
 * GET    /api/bank-accounts/[id] - 계좌 상세 조회
 * PUT    /api/bank-accounts/[id] - 계좌 수정
 * DELETE /api/bank-accounts/[id] - 계좌 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateBankAccountSchema } from '@/lib/schemas/bank-account-schema';
import {
  handleApiError,
  ApiError,
  successResponse,
  successMessageResponse,
} from '@/lib/api/error-handler';

/**
 * GET /api/bank-accounts/[id] - 계좌 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const account = await prisma.savedBankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new ApiError('저장된 계좌를 찾을 수 없습니다.', 404);
    }

    return successResponse(account);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/bank-accounts/[id] - 계좌 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 계좌 존재 여부 확인
    const existingAccount = await prisma.savedBankAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      throw new ApiError('저장된 계좌를 찾을 수 없습니다.', 404);
    }

    // 유효성 검증
    const validatedData = updateBankAccountSchema.parse(body);

    // 기본 계좌로 설정하는 경우, 기존 기본 계좌 해제
    if (validatedData.isDefault && !existingAccount.isDefault) {
      await prisma.savedBankAccount.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // 계좌 수정
    const account = await prisma.savedBankAccount.update({
      where: { id },
      data: {
        ...(validatedData.bankName && { bankName: validatedData.bankName }),
        ...(validatedData.accountNumber && { accountNumber: validatedData.accountNumber }),
        ...(validatedData.accountHolder && { accountHolder: validatedData.accountHolder }),
        ...(validatedData.nickname !== undefined && { nickname: validatedData.nickname || null }),
        ...(validatedData.isDefault !== undefined && { isDefault: validatedData.isDefault }),
      },
    });

    return successResponse(account);
  } catch (error: any) {
    // 중복 계좌번호 에러 처리
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '이미 등록된 계좌번호입니다.' },
        { status: 409 }
      );
    }

    // Zod 검증 에러 처리
    if (error.name === 'ZodError' && error.errors) {
      const errorMessages = error.errors
        .map((err: any) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return NextResponse.json(
        { error: '입력 데이터가 유효하지 않습니다.', details: errorMessages },
        { status: 400 }
      );
    }

    return handleApiError(error);
  }
}

/**
 * DELETE /api/bank-accounts/[id] - 계좌 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 계좌 존재 여부 확인
    const account = await prisma.savedBankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new ApiError('저장된 계좌를 찾을 수 없습니다.', 404);
    }

    // 계좌 삭제
    await prisma.savedBankAccount.delete({
      where: { id },
    });

    return successMessageResponse('계좌가 성공적으로 삭제되었습니다.');
  } catch (error) {
    return handleApiError(error);
  }
}
