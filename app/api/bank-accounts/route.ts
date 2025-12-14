/**
 * 저장된 은행 계좌 API
 *
 * GET  /api/bank-accounts - 저장된 계좌 목록 조회
 * POST /api/bank-accounts - 새 계좌 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { savedBankAccountSchema } from '@/lib/schemas/bank-account-schema';
import { handleApiError, ApiError, successResponse } from '@/lib/api/error-handler';

/**
 * GET /api/bank-accounts - 저장된 계좌 목록 조회
 */
export async function GET() {
  try {
    const accounts = await prisma.savedBankAccount.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return successResponse({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/bank-accounts - 새 계좌 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 유효성 검증
    const validatedData = savedBankAccountSchema.parse(body);

    // 기본 계좌로 설정하는 경우, 기존 기본 계좌 해제
    if (validatedData.isDefault) {
      await prisma.savedBankAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    // 새 계좌 생성
    const account = await prisma.savedBankAccount.create({
      data: {
        bankName: validatedData.bankName,
        accountNumber: validatedData.accountNumber,
        accountHolder: validatedData.accountHolder,
        nickname: validatedData.nickname || null,
        isDefault: validatedData.isDefault || false,
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
}
