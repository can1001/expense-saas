/**
 * 개별 템플릿 API
 *
 * GET    /api/expense-templates/[id] - 템플릿 상세 조회
 * PUT    /api/expense-templates/[id] - 템플릿 수정
 * DELETE /api/expense-templates/[id] - 템플릿 삭제
 * POST   /api/expense-templates/[id]/use - 템플릿 사용 (usageCount 증가)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  handleApiError,
  ApiError,
  successResponse,
  successMessageResponse,
} from '@/lib/api/error-handler';
import { withAuth, UserApiHandler } from '@/lib/auth/user';
import { z, ZodError } from 'zod';

// 템플릿 수정 스키마
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  budgetCategory: z.string().min(1).optional(),
  budgetSubcategory: z.string().min(1).optional(),
  budgetDetail: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  defaultAmount: z.number().int().positive().nullable().optional(),
});

/**
 * GET /api/expense-templates/[id] - 템플릿 상세 조회
 */
const handleGet: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;

    const template = await prisma.expenseTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new ApiError('템플릿을 찾을 수 없습니다.', 404);
    }

    // 소유자 확인
    if (template.userId !== user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    return successResponse(template);
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * PUT /api/expense-templates/[id] - 템플릿 수정
 */
const handlePut: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    // 템플릿 존재 여부 확인
    const existingTemplate = await prisma.expenseTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      throw new ApiError('템플릿을 찾을 수 없습니다.', 404);
    }

    // 소유자 확인
    if (existingTemplate.userId !== user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 유효성 검증
    const validatedData = updateTemplateSchema.parse(body);

    // 템플릿 수정
    const template = await prisma.expenseTemplate.update({
      where: { id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.budgetCategory && { budgetCategory: validatedData.budgetCategory }),
        ...(validatedData.budgetSubcategory && { budgetSubcategory: validatedData.budgetSubcategory }),
        ...(validatedData.budgetDetail && { budgetDetail: validatedData.budgetDetail }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.defaultAmount !== undefined && { defaultAmount: validatedData.defaultAmount }),
      },
    });

    return successResponse(template);
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

/**
 * DELETE /api/expense-templates/[id] - 템플릿 삭제
 */
const handleDelete: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;

    // 템플릿 존재 여부 확인
    const template = await prisma.expenseTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new ApiError('템플릿을 찾을 수 없습니다.', 404);
    }

    // 소유자 확인
    if (template.userId !== user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 템플릿 삭제
    await prisma.expenseTemplate.delete({
      where: { id },
    });

    return successMessageResponse('템플릿이 성공적으로 삭제되었습니다.');
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * POST /api/expense-templates/[id] - 템플릿 사용 (usageCount 증가)
 */
const handlePost: UserApiHandler = async (request, { params, user }) => {
  try {
    const { id } = await params;

    // 템플릿 존재 여부 확인
    const existingTemplate = await prisma.expenseTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      throw new ApiError('템플릿을 찾을 수 없습니다.', 404);
    }

    // 소유자 확인
    if (existingTemplate.userId !== user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // usageCount 증가
    const template = await prisma.expenseTemplate.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });

    return successResponse(template);
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const DELETE = withAuth(handleDelete);
export const POST = withAuth(handlePost);
