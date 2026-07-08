/**
 * 개별 은행 계좌 API
 *
 * GET    /api/bank-accounts/[id] - 계좌 상세 조회
 * PUT    /api/bank-accounts/[id] - 계좌 수정
 * DELETE /api/bank-accounts/[id] - 계좌 삭제
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateBankAccountSchema } from '@/lib/schemas/bank-account-schema';
import {
  handleApiError,
  ApiError,
  successResponse,
  successMessageResponse,
} from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/bank-accounts/[id] - 계좌 상세 조회
 */
const handleGet: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;

    const account = await prisma.savedBankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new ApiError('저장된 계좌를 찾을 수 없습니다.', 404);
    }

    // 소유자 확인
    if (account.userId !== user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    return successResponse(account);
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * PUT /api/bank-accounts/[id] - 계좌 수정
 */
const handlePut: UserApiHandler = async (request, { params, user }) => {
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

    // 소유자 확인
    if (existingAccount.userId !== user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 유효성 검증
    const validatedData = updateBankAccountSchema.parse(body);

    // 기본 계좌로 설정하는 경우, 기존 기본 계좌 해제 (현재 사용자의 계좌만)
    if (validatedData.isDefault && !existingAccount.isDefault) {
      await prisma.savedBankAccount.updateMany({
        where: { userId: user.id, isDefault: true, id: { not: id } },
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
  } catch (error: unknown) {
    // 중복 계좌번호 에러 처리
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: '이미 등록된 계좌번호입니다.' },
        { status: 409 }
      );
    }

    // Zod 검증 에러 처리
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
      const zodError = error as { errors: Array<{ path: string[]; message: string }> };
      const errorMessages = zodError.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return NextResponse.json(
        { error: '입력 데이터가 유효하지 않습니다.', details: errorMessages },
        { status: 400 }
      );
    }

    return handleApiError(error);
  }
};

/**
 * DELETE /api/bank-accounts/[id] - 계좌 삭제
 */
const handleDelete: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;

    // 계좌 존재 여부 확인
    const account = await prisma.savedBankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new ApiError('저장된 계좌를 찾을 수 없습니다.', 404);
    }

    // 소유자 확인
    if (account.userId !== user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 계좌 삭제
    await prisma.savedBankAccount.delete({
      where: { id },
    });

    return successMessageResponse('계좌가 성공적으로 삭제되었습니다.');
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
