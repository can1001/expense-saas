/**
 * 지출 템플릿 API
 *
 * GET  /api/expense-templates - 현재 사용자의 템플릿 목록 조회
 * POST /api/expense-templates - 새 템플릿 생성
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, successResponse, ApiError } from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { z, ZodError } from 'zod';

// 템플릿 생성 스키마
const createTemplateSchema = z.object({
  name: z.string().min(1, '템플릿 이름을 입력하세요').max(50, '이름은 50자 이하여야 합니다'),
  budgetCategory: z.string().min(1, '예산(항)을 선택하세요'),
  budgetSubcategory: z.string().min(1, '예산(목)을 선택하세요'),
  budgetDetail: z.string().min(1, '세목을 선택하세요'),
  description: z.string().optional(),
  defaultAmount: z.number().int().positive().optional(),
});

// 사용자당 최대 템플릿 수
const MAX_TEMPLATES_PER_USER = 20;

/**
 * GET /api/expense-templates - 현재 사용자의 템플릿 목록 조회
 */
const handleGet: UserApiHandler = async (request, { user }) => {
  try {
    const templates = await prisma.expenseTemplate.findMany({
      where: { userId: user.id },
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return successResponse({ templates });
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * POST /api/expense-templates - 새 템플릿 생성
 */
const handlePost: UserApiHandler = async (request, { user }) => {
  try {
    const body = await request.json();

    // 유효성 검증
    const validatedData = createTemplateSchema.parse(body);

    // 최대 개수 확인
    const existingCount = await prisma.expenseTemplate.count({
      where: { userId: user.id },
    });

    if (existingCount >= MAX_TEMPLATES_PER_USER) {
      throw new ApiError(
        `최대 ${MAX_TEMPLATES_PER_USER}개의 템플릿만 저장할 수 있습니다.`,
        400
      );
    }

    // 새 템플릿 생성
    const template = await prisma.expenseTemplate.create({
      data: {
        userId: user.id,
        name: validatedData.name,
        budgetCategory: validatedData.budgetCategory,
        budgetSubcategory: validatedData.budgetSubcategory,
        budgetDetail: validatedData.budgetDetail,
        description: validatedData.description || null,
        defaultAmount: validatedData.defaultAmount || null,
      },
    });

    return successResponse(template, 201);
  } catch (error) {
    // Zod 검증 에러 처리
    if (error instanceof ZodError) {
      const errorMessages = error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
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
