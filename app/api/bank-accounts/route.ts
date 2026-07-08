/**
 * 저장된 은행 계좌 API
 *
 * GET  /api/bank-accounts - 현재 사용자의 저장된 계좌 목록 조회
 * POST /api/bank-accounts - 새 계좌 저장
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { savedBankAccountSchema } from '@/lib/schemas/bank-account-schema';
import { handleApiError, successResponse } from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';

/**
 * GET /api/bank-accounts - 현재 사용자의 저장된 계좌 목록 조회
 */
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const accounts = await prisma.savedBankAccount.findMany({
      where: { userId: user.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return successResponse({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * POST /api/bank-accounts - 새 계좌 저장
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const body = await request.json();

    // 유효성 검증
    const validatedData = savedBankAccountSchema.parse(body);

    // 첫 번째 계좌인 경우 자동으로 기본 계좌로 설정
    const existingCount = await prisma.savedBankAccount.count({
      where: { userId: user.id },
    });
    const shouldBeDefault = existingCount === 0 ? true : validatedData.isDefault || false;

    // 기본 계좌로 설정하는 경우, 기존 기본 계좌 해제 (현재 사용자의 계좌만)
    if (shouldBeDefault) {
      await prisma.savedBankAccount.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // 새 계좌 생성
    const account = await prisma.savedBankAccount.create({
      data: {
        userId: user.id,
        bankName: validatedData.bankName,
        accountNumber: validatedData.accountNumber,
        accountHolder: validatedData.accountHolder,
        nickname: validatedData.nickname || null,
        isDefault: shouldBeDefault,
      },
    });

    return successResponse(account, 201);
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
};

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
